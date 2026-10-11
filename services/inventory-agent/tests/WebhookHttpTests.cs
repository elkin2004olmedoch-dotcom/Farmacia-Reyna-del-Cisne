using System.Collections.Concurrent;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Farmacia.InventoryAgent;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Xunit;

[assembly: WebApplicationFactoryContentRoot("Farmacia.InventoryAgent, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null", "../../../../", "InventoryAgent.csproj", "0")]

namespace Farmacia.InventoryAgent.Tests;

public sealed class WebhookHttpTests
{
    private const string AdminKey = "synthetic_admin_key_for_tests_00000000";
    private const string TelegramSecret = "synthetic_telegram_secret_00000000";
    private const string MetaSecret = "synthetic_meta_secret_for_tests_00000000";
    private const string VerifyToken = "synthetic_verify_token_for_tests_00000000";
    private static readonly string Token = new('a', 64);

    [Fact]
    public async Task Health_is_public_uncached_and_does_not_query_database()
    {
        using var app = new TestApp(); using var client = app.CreateClient();
        var response = await client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("automationEnabled", body); Assert.DoesNotContain(AdminKey, body);
        Assert.Equal(0, app.Repository.Reads);
    }

    [Theory]
    [InlineData(null)] [InlineData("Bearer wrong")] [InlineData("Basic synthetic")]
    public async Task Admin_rejects_missing_or_wrong_key(string? authorization)
    {
        using var app = new TestApp(); using var client = app.CreateClient();
        if (authorization is not null) client.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", authorization);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/admin/inventario")).StatusCode);
        Assert.Equal(0, app.Repository.Reads);
    }

    [Fact]
    public async Task Admin_configured_key_can_read_inventory()
    {
        using var app = new TestApp(); using var client = app.CreateClient();
        client.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", "Bearer " + AdminKey);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/admin/inventario")).StatusCode);
        Assert.Equal(1, app.Repository.Reads);
    }

    [Fact]
    public async Task Unconfigured_admin_fails_closed()
    {
        using var app = new TestApp(new() { ["InventoryAgent:Enabled"] = "false", ["InventoryAgent:AdminApiKey"] = "" });
        using var client = app.CreateClient();
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await client.GetAsync("/admin/inventario")).StatusCode);
        Assert.Equal(0, app.Repository.Reads);
    }

    [Theory]
    [InlineData(null)] [InlineData("wrong")]
    public async Task Telegram_rejects_bad_webhook_secret_before_processing(string? secret)
    {
        using var app = new TestApp(); using var client = app.CreateClient();
        var response = await TelegramPost(client, TelegramPayload(), secret);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Empty(app.Repository.Approvals); Assert.Equal(0, app.Acknowledgements);
    }

    [Fact]
    public async Task Telegram_valid_callback_processes_and_acknowledges_using_simulated_transport()
    {
        using var app = new TestApp(); using var client = app.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await TelegramPost(client, TelegramPayload(), TelegramSecret)).StatusCode);
        var action = Assert.Single(app.Repository.Approvals);
        Assert.Equal("telegram", action.Channel); Assert.Equal(Token, action.Token);
        Assert.Equal("42", action.ActorId); Assert.Equal("12345:7", action.ExternalId);
        Assert.Equal(1, app.Acknowledgements);
    }

    [Theory]
    [InlineData("43", "42")] [InlineData("42", "43")]
    public async Task Telegram_ignores_other_users_or_chats(string actor, string chat)
    {
        using var app = new TestApp(); using var client = app.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await TelegramPost(client, TelegramPayload(actor, chat), TelegramSecret)).StatusCode);
        Assert.Empty(app.Repository.Approvals); Assert.Equal(0, app.Acknowledgements);
    }

    [Fact]
    public async Task WhatsApp_verification_requires_secret_and_returns_plain_challenge()
    {
        using var app = new TestApp(); using var client = app.CreateClient();
        var response = await client.GetAsync("/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=fixture_challenge&hub.verify_token=" + VerifyToken);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("fixture_challenge", await response.Content.ReadAsStringAsync());
        Assert.Equal("text/plain", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=x&hub.verify_token=wrong")).StatusCode);
    }

    [Fact]
    public async Task WhatsApp_valid_signature_processes_allowed_manager_and_context()
    {
        using var app = new TestApp(); using var client = app.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await MetaPost(client, WhatsAppPayload())).StatusCode);
        var action = Assert.Single(app.Repository.Approvals);
        Assert.Equal("whatsapp", action.Channel); Assert.Equal("20:synthetic_incoming", action.ExternalId);
        Assert.Equal("synthetic_outgoing", action.ContextId); Assert.Equal(Token, action.Token);
    }

    [Theory]
    [InlineData(false)] [InlineData(true)]
    public async Task WhatsApp_rejects_missing_signature_or_changed_raw_body(bool tampered)
    {
        using var app = new TestApp(); using var client = app.CreateClient();
        var body = WhatsAppPayload();
        var response = await MetaPost(client, tampered ? body + " " : body, tampered ? Signature(body) : "");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode); Assert.Empty(app.Repository.Approvals);
    }

    [Theory]
    [InlineData("11", "20", "593999999999", true)]
    [InlineData("10", "21", "593999999999", true)]
    [InlineData("10", "20", "593888888888", true)]
    [InlineData("10", "20", "593999999999", false)]
    public async Task WhatsApp_ignores_other_businesses_managers_or_missing_context(string waba, string phone, string manager, bool context)
    {
        using var app = new TestApp(); using var client = app.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await MetaPost(client, WhatsAppPayload(waba, phone, manager, context))).StatusCode);
        Assert.Empty(app.Repository.Approvals);
    }

    [Theory]
    [InlineData("telegram")] [InlineData("whatsapp")]
    public async Task Disabled_automation_exposes_no_webhook(string channel)
    {
        using var app = new TestApp(new() { ["InventoryAgent:Enabled"] = "false" }); using var client = app.CreateClient();
        var response = channel == "telegram" ? await TelegramPost(client, TelegramPayload(), TelegramSecret) : await MetaPost(client, WhatsAppPayload());
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode); Assert.Empty(app.Repository.Approvals);
    }

    [Theory]
    [InlineData("telegram")] [InlineData("whatsapp")]
    public async Task Malformed_JSON_is_rejected_without_a_decision(string channel)
    {
        using var app = new TestApp(); using var client = app.CreateClient();
        var response = channel == "telegram" ? await TelegramPost(client, "{", TelegramSecret) : await MetaPost(client, "{");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode); Assert.Empty(app.Repository.Approvals);
    }

    [Fact]
    public async Task Oversized_body_is_rejected_before_parsing()
    {
        using var app = new TestApp(); using var client = app.CreateClient();
        var response = await TelegramPost(client, new string('x', 131073), TelegramSecret);
        Assert.Contains(response.StatusCode, new[] { HttpStatusCode.BadRequest, HttpStatusCode.RequestEntityTooLarge });
        Assert.Empty(app.Repository.Approvals);
    }

    [Theory]
    [InlineData("telegram")] [InlineData("whatsapp")]
    public async Task Early_callback_requests_retry_without_confirming_or_acknowledging_a_decision(string channel)
    {
        using var app = new TestApp(); app.Repository.ContextPending = true; using var client = app.CreateClient();
        var response = channel == "telegram" ? await TelegramPost(client, TelegramPayload(), TelegramSecret) : await MetaPost(client, WhatsAppPayload());
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Empty(app.Repository.Approvals); Assert.Equal(0, app.Acknowledgements);
        Assert.DoesNotContain(Token, await response.Content.ReadAsStringAsync());
    }

    private static string TelegramPayload(string actor = "42", string chat = "42") => JsonSerializer.Serialize(new { update_id = 7, callback_query = new { id = "synthetic_callback", from = new { id = actor }, message = new { message_id = 123, chat = new { id = chat } }, data = Token } });
    private static string WhatsAppPayload(string waba = "10", string phone = "20", string manager = "593999999999", bool context = true) => JsonSerializer.Serialize(new { @object = "whatsapp_business_account", entry = new[] { new { id = waba, changes = new[] { new { field = "messages", value = new { metadata = new { phone_number_id = phone }, messages = new[] { new { from = manager, id = "synthetic_incoming", type = "button", context = context ? new { id = "synthetic_outgoing" } : null, button = new { payload = Token } } } } } } } } });
    private static string Signature(string body) => "sha256=" + Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(MetaSecret), Encoding.UTF8.GetBytes(body))).ToLowerInvariant();
    private static async Task<HttpResponseMessage> TelegramPost(HttpClient client, string body, string? secret)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/webhooks/telegram") { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        if (secret is not null) request.Headers.TryAddWithoutValidation("X-Telegram-Bot-Api-Secret-Token", secret);
        return await client.SendAsync(request);
    }
    private static async Task<HttpResponseMessage> MetaPost(HttpClient client, string body, string? signature = null)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/webhooks/whatsapp") { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        request.Headers.TryAddWithoutValidation("X-Hub-Signature-256", signature ?? Signature(body));
        return await client.SendAsync(request);
    }

    private sealed class TestApp(Dictionary<string, string?>? overrides = null) : WebApplicationFactory<Program>
    {
        public FakeRepository Repository { get; } = new();
        public int Acknowledgements;
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Production");
            var settings = new Dictionary<string, string?> {
                    ["InventoryAgent:Enabled"] = "true", ["InventoryAgent:ConnectionString"] = "Host=localhost;Database=synthetic;Username=synthetic;Password=synthetic", ["InventoryAgent:AdminApiKey"] = AdminKey,
                    ["InventoryAgent:Telegram:Enabled"] = "true", ["InventoryAgent:Telegram:BotToken"] = "12345:synthetic_bot_token_00000000000", ["InventoryAgent:Telegram:WebhookSecret"] = TelegramSecret, ["InventoryAgent:Telegram:ManagerUserId"] = "42", ["InventoryAgent:Telegram:ManagerChatId"] = "42",
                    ["InventoryAgent:WhatsApp:Enabled"] = "true", ["InventoryAgent:WhatsApp:EligibilityConfirmed"] = "true", ["InventoryAgent:WhatsApp:AccessToken"] = "synthetic_access_token_00000000000", ["InventoryAgent:WhatsApp:AppSecret"] = MetaSecret, ["InventoryAgent:WhatsApp:VerifyToken"] = VerifyToken, ["InventoryAgent:WhatsApp:PhoneNumberId"] = "20", ["InventoryAgent:WhatsApp:WabaId"] = "10", ["InventoryAgent:WhatsApp:ManagerNumber"] = "593999999999", ["InventoryAgent:WhatsApp:TemplateName"] = "synthetic_alert", ["InventoryAgent:WhatsApp:NoticeTemplateName"] = "synthetic_notice"
                };
                if (overrides is not null) foreach (var pair in overrides) settings[pair.Key] = pair.Value;
                builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(settings));
            builder.ConfigureTestServices(services => {
                var testOptions = new ConfigurationBuilder().AddInMemoryCollection(settings).Build().GetSection("InventoryAgent").Get<AgentOptions>()!; testOptions.Validate();
                services.RemoveAll<AgentOptions>(); services.AddSingleton(testOptions);
                foreach (var hosted in services.Where(d => d.ServiceType == typeof(IHostedService) && d.ImplementationType is not null && (d.ImplementationType == typeof(DailyInventoryWorker) || d.ImplementationType == typeof(OutboxWorker))).ToArray()) services.Remove(hosted);
                services.RemoveAll<IAgentRepository>(); services.AddSingleton<IAgentRepository>(Repository);
                services.RemoveAll<TelegramStrategy>();
                services.AddSingleton(sp => new TelegramStrategy(sp.GetRequiredService<AgentOptions>(), new HttpClient(new FakeTelegramHandler(() => Interlocked.Increment(ref Acknowledgements)))));
            });
        }
    }
    private sealed class FakeTelegramHandler(Action received) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Assert.EndsWith("/answerCallbackQuery", request.RequestUri!.AbsolutePath); received();
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"ok\":true,\"result\":true}") });
        }
    }
    private sealed class FakeRepository : IAgentRepository
    {
        public int Reads;
        public bool ContextPending;
        public ConcurrentQueue<ApprovalEvent> Approvals { get; } = new();
        public Task<IReadOnlyList<InventoryItem>> InventoryAsync(DateOnly today, CancellationToken ct) { Interlocked.Increment(ref Reads); return Task.FromResult<IReadOnlyList<InventoryItem>>(Array.Empty<InventoryItem>()); }
        public Task<string> ApproveAsync(ApprovalEvent input, DateTimeOffset now, CancellationToken ct) { if (ContextPending) throw new PendingApprovalContextException(); Approvals.Enqueue(input); return Task.FromResult("aprobado"); }
        public Task SaveConfigAsync(RestockConfig input, CancellationToken ct) { input.Validate(); return Task.CompletedTask; }
        public Task<object> ListRequestsAsync(CancellationToken ct) => Task.FromResult<object>(Array.Empty<object>());
        public Task<bool> CreateEpisodeAsync(InventoryItem item, AgentOptions options, DateTimeOffset now, CancellationToken ct) => Task.FromResult(false);
        public Task ResolveRecoveredAsync(IReadOnlyList<InventoryItem> inventory, DateTimeOffset now, CancellationToken ct) => Task.CompletedTask;
        public Task<OutboxMessage?> LeaseAsync(DateTimeOffset now, CancellationToken ct) => Task.FromResult<OutboxMessage?>(null);
        public Task FinishAsync(OutboxMessage item, DeliveryResult result, DateTimeOffset now, CancellationToken ct) => Task.CompletedTask;
        public Task ReviewAsync(Guid requestId, string result, bool confirmedNoReceipt, string actor, DateTimeOffset now, CancellationToken ct) => Task.CompletedTask;
    }
}
