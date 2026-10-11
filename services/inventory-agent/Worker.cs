namespace Farmacia.InventoryAgent;

public static class AgentClock
{
    // Ecuador continental uses UTC-5; inventory dates are pharmacy local dates.
    public static DateOnly Day(DateTimeOffset now) => DateOnly.FromDateTime(now.UtcDateTime.AddHours(-5));
    public static DateTimeOffset NextDaily(DateTimeOffset now, int hour)
    {
        var local = now.ToOffset(TimeSpan.FromHours(-5));
        var next = new DateTimeOffset(local.Year, local.Month, local.Day, hour, 0, 0, TimeSpan.FromHours(-5));
        return (next <= now ? next.AddDays(1) : next).ToUniversalTime();
    }
}

public sealed class DailyInventoryWorker(AgentOptions options, IAgentRepository repository, TimeProvider clock, ILogger<DailyInventoryWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Enabled) return;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var now = clock.GetUtcNow();
                var items = await repository.InventoryAsync(AgentClock.Day(now), stoppingToken);
                await repository.ResolveRecoveredAsync(items, now, stoppingToken);
                foreach (var item in items) await repository.CreateEpisodeAsync(item, options, now, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception) { logger.LogError("INVENTORY_SCAN_FAILED: revisar conexión, permisos y configuración privada."); }
            var scheduledAt = clock.GetUtcNow();
            try { await Task.Delay(AgentClock.NextDaily(scheduledAt, options.DailyHour) - scheduledAt, clock, stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}

public sealed class OutboxWorker(AgentOptions options, IAgentRepository repository, IEnumerable<INotificationStrategy> strategies, TimeProvider clock, ILogger<OutboxWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Enabled) return;
        var channels = strategies.ToDictionary(s => s.Channel, StringComparer.Ordinal);
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(options.OutboxPollSeconds), clock);
        do
        {
            try
            {
                for (var count = 0; count < 20 && !stoppingToken.IsCancellationRequested; count++)
                {
                    var message = await repository.LeaseAsync(clock.GetUtcNow(), stoppingToken);
                    if (message is null) break;
                    DeliveryResult result;
                    try { result = channels.TryGetValue(message.Channel, out var strategy) ? await strategy.SendAsync(message, stoppingToken) : new(DeliveryState.PermanentFailure, "CHANNEL_UNCONFIGURED"); }
                    catch (Exception) { result = new(DeliveryState.Ambiguous, "DELIVERY_UNKNOWN"); }
                    // Once leased, a cancelled send can be ambiguous. Persist this
                    // with a short independent token; crashed leases also become Review.
                    using var finish = new CancellationTokenSource(TimeSpan.FromSeconds(10));
                    await repository.FinishAsync(message, result, clock.GetUtcNow(), finish.Token);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception) { logger.LogError("OUTBOX_PROCESS_FAILED: revisar el registro de auditoría; no reenviar a ciegas."); }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
