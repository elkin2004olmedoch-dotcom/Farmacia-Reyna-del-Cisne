using System.Net;
using System.Text;
using System.Text.Json;
using Farmacia.InventoryAgent;
using Xunit;

namespace Farmacia.InventoryAgent.Tests;

public sealed class NotificationContractTests
{
    private static readonly string ApproveToken = new('a', 64);
    private static readonly string RejectToken = new('b', 64);
    private const string TelegramResponse = "{\"ok\":true,\"result\":{\"message_id\":12345}}";
    private const string WhatsAppResponse = "{\"messages\":[{\"id\":\"synthetic-message-id\"}]}";

    [Fact]
    public async Task Telegram_manager_approval_has_two_exact_buttons_and_configured_destination()
    {
        var options = Options();
        using var handler = new CapturingHandler(HttpStatusCode.OK, TelegramResponse);
        using var strategy = new TelegramStrategy(options, Client(handler));
        var message = Message(options, "telegram", "gerente");

        var result = await strategy.SendAsync(message, CancellationToken.None);

        Assert.Equal(DeliveryState.Sent, result.State);
        Assert.Equal("TELEGRAM_ACCEPTED", result.Code);
        Assert.Equal("12345", result.ProviderMessageId);
        Assert.Equal("telegram", strategy.Channel);
        var request = Assert.Single(handler.Requests);
        Assert.Equal(HttpMethod.Post, request.Method);
        Assert.Equal("api.telegram.org", request.Uri.Host);
        Assert.EndsWith("/sendMessage", request.Uri.AbsolutePath);
        using var json = JsonDocument.Parse(request.Body);
        var payload = json.RootElement;
        Assert.Equal(options.Telegram.ManagerChatId, payload.GetProperty("chat_id").GetString());
        Assert.Equal(message.Body, payload.GetProperty("text").GetString());
        var rows = payload.GetProperty("reply_markup").GetProperty("inline_keyboard");
        Assert.Equal(1, rows.GetArrayLength());
        var buttons = rows[0];
        Assert.Equal(2, buttons.GetArrayLength());
        Assert.Equal("[Aprobar Pedido]", buttons[0].GetProperty("text").GetString());
        Assert.Equal(ApproveToken, buttons[0].GetProperty("callback_data").GetString());
        Assert.Equal("[Ignorar]", buttons[1].GetProperty("text").GetString());
        Assert.Equal(RejectToken, buttons[1].GetProperty("callback_data").GetString());
        Assert.All(buttons.EnumerateArray(), button =>
            Assert.Equal(64, Encoding.UTF8.GetByteCount(button.GetProperty("callback_data").GetString()!)));
    }

    [Fact]
    public async Task Telegram_manager_notice_has_no_approval_buttons_or_tokens()
    {
        var options = Options();
        using var handler = new CapturingHandler(HttpStatusCode.OK, TelegramResponse);
        using var strategy = new TelegramStrategy(options, Client(handler));

        var result = await strategy.SendAsync(Message(options, "telegram", "gerente_aviso"), CancellationToken.None);

        Assert.Equal(DeliveryState.Sent, result.State);
        var request = Assert.Single(handler.Requests);
        using var json = JsonDocument.Parse(request.Body);
        Assert.Equal(options.Telegram.ManagerChatId, json.RootElement.GetProperty("chat_id").GetString());
        Assert.False(json.RootElement.TryGetProperty("reply_markup", out _));
        Assert.DoesNotContain(ApproveToken, request.Body);
        Assert.DoesNotContain(RejectToken, request.Body);
    }

    [Fact]
    public async Task WhatsApp_manager_approval_uses_approved_template_and_two_quick_reply_payloads()
    {
        var options = Options();
        using var handler = new CapturingHandler(HttpStatusCode.OK, WhatsAppResponse);
        using var strategy = new WhatsAppStrategy(options, Client(handler));
        var message = Message(options, "whatsapp", "gerente") with { Body = "Solicitud sintética.\n  Revisar inventario.\t Aprobar o ignorar." };

        var result = await strategy.SendAsync(message, CancellationToken.None);

        Assert.Equal(DeliveryState.Sent, result.State);
        Assert.Equal("WHATSAPP_ACCEPTED", result.Code);
        Assert.Equal("synthetic-message-id", result.ProviderMessageId);
        Assert.Equal("whatsapp", strategy.Channel);
        var request = Assert.Single(handler.Requests);
        Assert.Equal(HttpMethod.Post, request.Method);
        Assert.Equal("graph.facebook.com", request.Uri.Host);
        Assert.Equal($"/{options.WhatsApp.GraphVersion}/{options.WhatsApp.PhoneNumberId}/messages", request.Uri.AbsolutePath);
        Assert.Equal("Bearer", request.AuthorizationScheme);
        Assert.Equal(options.WhatsApp.AccessToken, request.AuthorizationParameter);
        using var json = JsonDocument.Parse(request.Body);
        var payload = json.RootElement;
        Assert.Equal("whatsapp", payload.GetProperty("messaging_product").GetString());
        Assert.Equal(options.WhatsApp.ManagerNumber, payload.GetProperty("to").GetString());
        Assert.Equal("template", payload.GetProperty("type").GetString());
        var template = payload.GetProperty("template");
        Assert.Equal(options.WhatsApp.TemplateName, template.GetProperty("name").GetString());
        Assert.Equal(options.WhatsApp.TemplateLanguage, template.GetProperty("language").GetProperty("code").GetString());
        var components = template.GetProperty("components");
        Assert.Equal(3, components.GetArrayLength());
        Assert.Equal("body", components[0].GetProperty("type").GetString());
        Assert.Equal("Solicitud sintética. Revisar inventario. Aprobar o ignorar.", components[0].GetProperty("parameters")[0].GetProperty("text").GetString());
        AssertQuickReply(components[1], "0", ApproveToken);
        AssertQuickReply(components[2], "1", RejectToken);
    }

    [Fact]
    public async Task WhatsApp_manager_notice_uses_distinct_template_without_buttons()
    {
        var options = Options();
        using var handler = new CapturingHandler(HttpStatusCode.OK, WhatsAppResponse);
        using var strategy = new WhatsAppStrategy(options, Client(handler));

        var result = await strategy.SendAsync(Message(options, "whatsapp", "gerente_aviso"), CancellationToken.None);

        Assert.Equal(DeliveryState.Sent, result.State);
        var request = Assert.Single(handler.Requests);
        using var json = JsonDocument.Parse(request.Body);
        var template = json.RootElement.GetProperty("template");
        Assert.Equal(options.WhatsApp.ManagerNumber, json.RootElement.GetProperty("to").GetString());
        Assert.Equal(options.WhatsApp.NoticeTemplateName, template.GetProperty("name").GetString());
        Assert.NotEqual(options.WhatsApp.TemplateName, template.GetProperty("name").GetString());
        var component = Assert.Single(template.GetProperty("components").EnumerateArray());
        Assert.Equal("body", component.GetProperty("type").GetString());
        Assert.DoesNotContain(ApproveToken, request.Body);
        Assert.DoesNotContain(RejectToken, request.Body);
    }

    [Theory]
    [InlineData("telegram", false, true, "TELEGRAM_DISABLED")]
    [InlineData("whatsapp", false, true, "WHATSAPP_DISABLED")]
    [InlineData("whatsapp", true, false, "WHATSAPP_DISABLED")]
    public async Task Disabled_or_ineligible_channels_never_call_provider(string channel, bool enabled, bool eligible, string code)
    {
        var options = Options();
        options.Telegram.Enabled = enabled;
        options.WhatsApp.Enabled = enabled;
        options.WhatsApp.EligibilityConfirmed = eligible;
        using var handler = new CapturingHandler(HttpStatusCode.OK, SuccessResponse(channel));
        using var strategy = Strategy(channel, options, handler);

        var result = await strategy.SendAsync(Message(options, channel, "gerente"), CancellationToken.None);

        Assert.Equal(DeliveryState.PermanentFailure, result.State);
        Assert.Equal(code, result.Code);
        Assert.Null(result.ProviderMessageId);
        Assert.Empty(handler.Requests);
    }

    [Theory]
    [InlineData("telegram", "proveedor", "TELEGRAM_MANAGER_ONLY")]
    [InlineData("whatsapp", "proveedor", "PHARMACY_WHATSAPP_ORDER_REQUIRES_REVIEW")]
    [InlineData("telegram", "manager", "TELEGRAM_MANAGER_ONLY")]
    [InlineData("whatsapp", "manager", "PHARMACY_WHATSAPP_ORDER_REQUIRES_REVIEW")]
    public async Task Supplier_and_unsupported_kinds_are_blocked_before_http(string channel, string kind, string code)
    {
        var options = Options();
        using var handler = new CapturingHandler(HttpStatusCode.OK, SuccessResponse(channel));
        using var strategy = Strategy(channel, options, handler);

        var result = await strategy.SendAsync(Message(options, channel, kind), CancellationToken.None);

        Assert.Equal(DeliveryState.PermanentFailure, result.State);
        Assert.Equal(code, result.Code);
        Assert.Empty(handler.Requests);
    }

    [Theory]
    [InlineData("telegram", "approve", null)]
    [InlineData("telegram", "approve", "short")]
    [InlineData("telegram", "approve", "uppercase")]
    [InlineData("telegram", "reject", "long")]
    [InlineData("telegram", "reject", "nonhex")]
    [InlineData("whatsapp", "approve", null)]
    [InlineData("whatsapp", "approve", "short")]
    [InlineData("whatsapp", "approve", "uppercase")]
    [InlineData("whatsapp", "reject", "long")]
    [InlineData("whatsapp", "reject", "nonhex")]
    public async Task Approval_requires_both_exact_lowercase_hex_64_tokens(string channel, string action, string? invalidKind)
    {
        var options = Options();
        using var handler = new CapturingHandler(HttpStatusCode.OK, SuccessResponse(channel));
        using var strategy = Strategy(channel, options, handler);
        string? invalidToken = invalidKind switch
        {
            "short" => new string('a', 63),
            "long" => new string('a', 65),
            "uppercase" => new string('A', 64),
            "nonhex" => new string('g', 64),
            _ => null
        };
        var message = Message(options, channel, "gerente");
        message = action == "approve" ? message with { ApproveToken = invalidToken } : message with { RejectToken = invalidToken };

        var result = await strategy.SendAsync(message, CancellationToken.None);

        Assert.Equal(DeliveryState.PermanentFailure, result.State);
        Assert.Equal("APPROVAL_TOKEN_INVALID", result.Code);
        Assert.Empty(handler.Requests);
    }

    [Theory]
    [InlineData("telegram", 429, DeliveryState.SafeToRetry)]
    [InlineData("whatsapp", 429, DeliveryState.SafeToRetry)]
    [InlineData("telegram", 500, DeliveryState.Ambiguous)]
    [InlineData("whatsapp", 500, DeliveryState.Ambiguous)]
    [InlineData("telegram", 400, DeliveryState.PermanentFailure)]
    [InlineData("whatsapp", 400, DeliveryState.PermanentFailure)]
    public async Task Http_rejection_distinguishes_safe_retry_from_uncertain_delivery(string channel, int status, DeliveryState expectedState)
    {
        var options = Options();
        using var handler = new CapturingHandler((HttpStatusCode)status, "{\"error\":\"synthetic provider error\"}");
        using var strategy = Strategy(channel, options, handler);

        var result = await strategy.SendAsync(Message(options, channel, "gerente"), CancellationToken.None);

        Assert.Equal(expectedState, result.State);
        Assert.Equal("CHANNEL_HTTP_REJECTED", result.Code);
        Assert.Null(result.ProviderMessageId);
        // A strategy reports one attempt; the durable outbox controls retries.
        Assert.Single(handler.Requests);
        Assert.DoesNotContain(ApproveToken, result.Code);
        Assert.DoesNotContain(options.WhatsApp.AccessToken, result.Code);
    }

    [Theory]
    [InlineData("telegram", "TELEGRAM_DELIVERY_UNKNOWN")]
    [InlineData("whatsapp", "WHATSAPP_DELIVERY_UNKNOWN")]
    public async Task Transport_failure_after_submission_is_ambiguous_without_automatic_resend(string channel, string code)
    {
        var options = Options();
        using var handler = new CapturingHandler(HttpStatusCode.OK, SuccessResponse(channel), throwAfterCapture: true);
        using var strategy = Strategy(channel, options, handler);

        var result = await strategy.SendAsync(Message(options, channel, "gerente"), CancellationToken.None);

        Assert.Equal(DeliveryState.Ambiguous, result.State);
        Assert.Equal(code, result.Code);
        Assert.Null(result.ProviderMessageId);
        Assert.Single(handler.Requests);
        Assert.DoesNotContain("synthetic transport error", result.Code);
    }

    [Theory]
    [InlineData("telegram", "{\"ok\":false,\"description\":\"synthetic rejection\"}", DeliveryState.PermanentFailure, "TELEGRAM_REJECTED")]
    [InlineData("whatsapp", "{\"messages\":[{\"id\":null}]}", DeliveryState.Ambiguous, "WHATSAPP_DELIVERY_UNKNOWN")]
    public async Task A_success_status_alone_does_not_prove_provider_acceptance(string channel, string body, DeliveryState expectedState, string code)
    {
        var options = Options();
        using var handler = new CapturingHandler(HttpStatusCode.OK, body);
        using var strategy = Strategy(channel, options, handler);

        var result = await strategy.SendAsync(Message(options, channel, "gerente"), CancellationToken.None);

        Assert.Equal(expectedState, result.State);
        Assert.Equal(code, result.Code);
        Assert.Null(result.ProviderMessageId);
        Assert.Single(handler.Requests);
    }

    private static void AssertQuickReply(JsonElement component, string index, string token)
    {
        Assert.Equal("button", component.GetProperty("type").GetString());
        Assert.Equal("quick_reply", component.GetProperty("sub_type").GetString());
        Assert.Equal(index, component.GetProperty("index").GetString());
        var parameter = Assert.Single(component.GetProperty("parameters").EnumerateArray());
        Assert.Equal("payload", parameter.GetProperty("type").GetString());
        Assert.Equal(token, parameter.GetProperty("payload").GetString());
    }

    private static HttpNotificationStrategy Strategy(string channel, AgentOptions options, CapturingHandler handler) =>
        channel == "telegram" ? new TelegramStrategy(options, Client(handler)) : new WhatsAppStrategy(options, Client(handler));

    private static HttpClient Client(CapturingHandler handler) => new(handler)
    {
        // The handler intercepts every absolute provider URI; no socket is opened.
        BaseAddress = new Uri("http://127.0.0.1/"),
        Timeout = TimeSpan.FromSeconds(5)
    };

    private static string SuccessResponse(string channel) => channel == "telegram" ? TelegramResponse : WhatsAppResponse;

    private static OutboxMessage Message(AgentOptions options, string channel, string kind) => new(
        Guid.Parse("10000000-0000-0000-0000-000000000001"),
        Guid.Parse("10000000-0000-0000-0000-000000000002"),
        kind,
        channel,
        channel == "telegram" ? options.Telegram.ManagerChatId : options.WhatsApp.ManagerNumber,
        "Solicitud sintética de inventario",
        "Solicitud sintética. Revisar inventario.",
        ApproveToken,
        RejectToken,
        0,
        Guid.Parse("10000000-0000-0000-0000-000000000003"));

    private static AgentOptions Options() => new()
    {
        Telegram = new()
        {
            Enabled = true,
            BotToken = "1000000000:synthetic-telegram-test-token-only",
            WebhookSecret = "synthetic_webhook_secret_0000000000000000",
            ManagerUserId = "1000000001",
            ManagerChatId = "-1000000002"
        },
        WhatsApp = new()
        {
            Enabled = true,
            EligibilityConfirmed = true,
            AccessToken = "synthetic-whatsapp-test-access-token-only",
            AppSecret = "synthetic-app-secret-0000000000000000",
            VerifyToken = "synthetic-verify-token-00000000000000",
            PhoneNumberId = "100000000000001",
            WabaId = "100000000000002",
            ManagerNumber = "593999000001",
            GraphVersion = "v26.0",
            TemplateName = "synthetic_inventory_approval",
            NoticeTemplateName = "synthetic_inventory_notice",
            TemplateLanguage = "es"
        }
    };

    private sealed record CapturedRequest(HttpMethod Method, Uri Uri, string Body, string? AuthorizationScheme, string? AuthorizationParameter);

    private sealed class CapturingHandler(HttpStatusCode status, string responseBody, bool throwAfterCapture = false) : HttpMessageHandler
    {
        public List<CapturedRequest> Requests { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var body = request.Content is null ? "" : await request.Content.ReadAsStringAsync(cancellationToken);
            Requests.Add(new(request.Method, request.RequestUri!, body, request.Headers.Authorization?.Scheme, request.Headers.Authorization?.Parameter));
            if (throwAfterCapture) throw new HttpRequestException("synthetic transport error after submission");
            return new HttpResponseMessage(status)
            {
                Content = new StringContent(responseBody, Encoding.UTF8, "application/json")
            };
        }
    }
}
