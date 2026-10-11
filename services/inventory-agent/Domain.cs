using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Farmacia.InventoryAgent;

public sealed class AgentOptions
{
    public bool Enabled { get; set; }
    public string SourceMode { get; set; } = "Integrated";
    public string Schema { get; set; } = "inventory_agent";
    public string ConnectionString { get; set; } = "";
    public string AdminApiKey { get; set; } = "";
    public int DailyHour { get; set; } = 8;
    public int ExpiryAlertDays { get; set; } = 30;
    public int ApprovalHours { get; set; } = 24;
    public int OutboxPollSeconds { get; set; } = 30;
    public EmailOptions Email { get; set; } = new();
    public TelegramOptions Telegram { get; set; } = new();
    public WhatsAppOptions WhatsApp { get; set; } = new();
    public void Validate()
    {
        if (!Regex.IsMatch(Schema, "^[a-z][a-z0-9_]{0,62}$") || !new[] { "Integrated", "Standalone" }.Contains(SourceMode)) throw new ArgumentException("Configuración de fuente inválida.");
        if (DailyHour is < 0 or > 23 || ExpiryAlertDays is < 0 or > 365 || ApprovalHours is < 1 or > 168 || OutboxPollSeconds is < 10 or > 3600) throw new ArgumentException("Límites del agente inválidos.");
        if (Enabled && (string.IsNullOrWhiteSpace(ConnectionString) || AdminApiKey.Length < 32)) throw new ArgumentException("El agente habilitado requiere conexión y clave administrativa privada.");
        if (!string.IsNullOrWhiteSpace(ConnectionString))
        {
            var connection = new Npgsql.NpgsqlConnectionStringBuilder(ConnectionString);
            var local = connection.Host is "localhost" or "127.0.0.1" or "::1";
            if (!local && connection.SslMode != Npgsql.SslMode.VerifyFull) throw new ArgumentException("PostgreSQL remoto requiere SSL VerifyFull.");
        }
        if (Telegram.Enabled && (!Regex.IsMatch(Telegram.BotToken,"^[0-9]{1,20}:[A-Za-z0-9_-]{20,100}$") || Telegram.WebhookSecret.Length is < 32 or > 256 || !Regex.IsMatch(Telegram.WebhookSecret, "^[A-Za-z0-9_-]+$") || !Regex.IsMatch(Telegram.ManagerUserId, "^[0-9]{1,20}$") || !Regex.IsMatch(Telegram.ManagerChatId, "^-?[0-9]{1,20}$"))) throw new ArgumentException("Telegram requiere secretos y un gerente autorizado.");
        if (WhatsApp.Enabled && (!WhatsApp.EligibilityConfirmed || WhatsApp.AccessToken.Length < 20 || WhatsApp.AppSecret.Length < 32 || WhatsApp.VerifyToken.Length < 32 || !Regex.IsMatch(WhatsApp.ManagerNumber, "^[1-9][0-9]{7,14}$") || !Regex.IsMatch(WhatsApp.PhoneNumberId, "^[0-9]+$") || !Regex.IsMatch(WhatsApp.WabaId, "^[0-9]+$") || !Regex.IsMatch(WhatsApp.GraphVersion, "^v[0-9]{1,2}\\.0$") || !Regex.IsMatch(WhatsApp.TemplateName, "^[a-z0-9_]{1,512}$") || !Regex.IsMatch(WhatsApp.NoticeTemplateName, "^[a-z0-9_]{1,512}$") || !Regex.IsMatch(WhatsApp.TemplateLanguage, "^[a-z]{2}(?:_[A-Z]{2})?$"))) throw new ArgumentException("WhatsApp requiere elegibilidad confirmada, plantillas aprobadas, secretos y gerente autorizado.");
        if (Email.Enabled && (Email.Host != "smtp.gmail.com" || Email.Port is not (465 or 587) || Email.ImplicitTls != (Email.Port == 465) || !Email.From.Contains('@') || string.IsNullOrWhiteSpace(Email.Username) || string.IsNullOrWhiteSpace(Email.Password + Email.OAuthAccessToken))) throw new ArgumentException("SMTP Gmail requiere TLS y configuración privada completa.");
    }
}
public sealed class EmailOptions { public bool Enabled { get; set; } public string Host { get; set; } = "smtp.gmail.com"; public int Port { get; set; } = 587; public string From { get; set; } = ""; public string Username { get; set; } = ""; public string Password { get; set; } = ""; public string OAuthAccessToken { get; set; } = ""; public bool ImplicitTls { get; set; } }
public sealed class TelegramOptions { public bool Enabled { get; set; } public string BotToken { get; set; } = ""; public string WebhookSecret { get; set; } = ""; public string ManagerUserId { get; set; } = ""; public string ManagerChatId { get; set; } = ""; }
public sealed class WhatsAppOptions { public bool Enabled { get; set; } public bool EligibilityConfirmed { get; set; } public string AccessToken { get; set; } = ""; public string AppSecret { get; set; } = ""; public string VerifyToken { get; set; } = ""; public string PhoneNumberId { get; set; } = ""; public string WabaId { get; set; } = ""; public string ManagerNumber { get; set; } = ""; public string GraphVersion { get; set; } = "v26.0"; public string TemplateName { get; set; } = ""; public string NoticeTemplateName { get; set; } = ""; public string TemplateLanguage { get; set; } = "es"; }

public sealed record InventoryItem(string Id, string Name, int Stock, int Minimum, int ExpiringStock, DateOnly? Expiry, string? SupplierId, string? SupplierName, string? SupplierEmail, int TargetStock, int AlertDays, bool Enabled, string Priority, int ExpiredStock = 0);
public sealed record RestockConfig(string ProductoId, string ProveedorId, int StockObjetivo, int DiasAlerta, bool Habilitado, string Prioridad)
{
    public void Validate()
    {
        if (!Regex.IsMatch(ProductoId ?? "", "^[A-Za-z0-9_-]{1,80}$") || !Regex.IsMatch(ProveedorId ?? "", "^[A-Za-z0-9_-]{1,80}$") || StockObjetivo is < 1 or > 100000 || DiasAlerta is < 0 or > 365) throw new ArgumentException("Revisa producto, proveedor y stock objetivo.");
        if (!new[] { "primordial", "intermedio", "bajo" }.Contains(Prioridad)) throw new ArgumentException("Prioridad inválida.");
    }
}
public static class RestockPolicy
{
    public static bool NeedsRestock(InventoryItem item) => item.Enabled && (item.Stock <= item.Minimum || item.ExpiringStock > 0 || item.ExpiredStock > 0);
    public static int Quantity(InventoryItem item) => Math.Clamp(Math.Max(item.TargetStock - Math.Max(item.Stock - item.ExpiringStock, 0), 1), 1, 100000);
    public static string Reason(InventoryItem item) => item.Stock <= item.Minimum && item.ExpiringStock + item.ExpiredStock > 0 ? "stock y caducidad" : item.ExpiringStock + item.ExpiredStock > 0 ? "caducidad" : "stock mínimo";
    public static string Fingerprint(InventoryItem item) => AgentSecurity.ActorHash(System.Text.Json.JsonSerializer.Serialize(item));
}
public static class AgentSecurity
{
    public static string Token() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
    public static bool ValidToken(string token) => Regex.IsMatch(token ?? "", "^[a-f0-9]{64}$");
    public static byte[] HashToken(string token) => SHA256.HashData(Encoding.UTF8.GetBytes(token));
    public static bool Equal(string? left, string? right) => !string.IsNullOrEmpty(left) && !string.IsNullOrEmpty(right) && CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(left)), SHA256.HashData(Encoding.UTF8.GetBytes(right)));
    public static bool VerifyMeta(ReadOnlySpan<byte> body, string? signature, string secret)
    {
        if (string.IsNullOrEmpty(secret) || signature is null || !Regex.IsMatch(signature, "^sha256=[a-fA-F0-9]{64}$")) return false;
        return CryptographicOperations.FixedTimeEquals(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), body), Convert.FromHexString(signature[7..]));
    }
    public static string ActorHash(string actor) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(actor))).ToLowerInvariant();
}
public sealed record ApprovalEvent(string Channel, string ExternalId, string Token, string ActorId, string ChatId, string ContextId);
public sealed class PendingApprovalContextException() : Exception("APPROVAL_CONTEXT_PENDING");
public sealed record OutboxMessage(Guid Id, Guid RequestId, string Kind, string Channel, string Target, string Subject, string Body, string? ApproveToken, string? RejectToken, int Attempts, Guid LeaseOwner);
public enum DeliveryState { Sent, SafeToRetry, Ambiguous, PermanentFailure }
public sealed record DeliveryResult(DeliveryState State, string Code, string? ProviderMessageId = null);
public interface INotificationStrategy { string Channel { get; } Task<DeliveryResult> SendAsync(OutboxMessage message, CancellationToken cancellationToken); }
public interface IAgentRepository
{
    Task<IReadOnlyList<InventoryItem>> InventoryAsync(DateOnly today, CancellationToken ct);
    Task SaveConfigAsync(RestockConfig input, CancellationToken ct);
    Task<object> ListRequestsAsync(CancellationToken ct);
    Task<bool> CreateEpisodeAsync(InventoryItem item, AgentOptions options, DateTimeOffset now, CancellationToken ct);
    Task ResolveRecoveredAsync(IReadOnlyList<InventoryItem> inventory, DateTimeOffset now, CancellationToken ct);
    Task<string> ApproveAsync(ApprovalEvent input, DateTimeOffset now, CancellationToken ct);
    Task<OutboxMessage?> LeaseAsync(DateTimeOffset now, CancellationToken ct);
    Task FinishAsync(OutboxMessage item, DeliveryResult result, DateTimeOffset now, CancellationToken ct);
    Task ReviewAsync(Guid requestId, string result, bool confirmedNoReceipt, string actor, DateTimeOffset now, CancellationToken ct);
}
