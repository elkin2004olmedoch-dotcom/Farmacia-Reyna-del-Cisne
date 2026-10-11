using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace Farmacia.InventoryAgent;

public sealed class EmailStrategy(AgentOptions options) : INotificationStrategy
{
    public string Channel => "email";
    public async Task<DeliveryResult> SendAsync(OutboxMessage message, CancellationToken cancellationToken)
    {
        var cfg = options.Email;
        if (!cfg.Enabled) return new(DeliveryState.PermanentFailure, "EMAIL_DISABLED");
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(30));
        using var client = new SmtpClient();
        var submissionStarted = false;
        try
        {
            var mail = new MimeMessage { Subject = message.Subject, MessageId = message.Id.ToString("N") + "@inventory-agent.invalid", Body = new TextPart("plain") { Text = message.Body } };
            mail.From.Add(MailboxAddress.Parse(cfg.From)); mail.To.Add(MailboxAddress.Parse(message.Target));
            await client.ConnectAsync(cfg.Host, cfg.Port, cfg.ImplicitTls ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls, timeout.Token);
            if (!string.IsNullOrEmpty(cfg.OAuthAccessToken)) await client.AuthenticateAsync(new SaslMechanismOAuth2(cfg.Username, cfg.OAuthAccessToken), timeout.Token);
            else await client.AuthenticateAsync(cfg.Username, cfg.Password, timeout.Token);
            submissionStarted = true;
            await client.SendAsync(mail, timeout.Token);
            // SendAsync completed the SMTP acknowledgement. A later QUIT failure
            // must not turn an accepted order into a blind retry.
            try { await client.DisconnectAsync(true, timeout.Token); } catch { }
            return new(DeliveryState.Sent, "SMTP_ACCEPTED", mail.MessageId);
        }
        catch (SmtpCommandException ex) when (ex.ErrorCode is SmtpErrorCode.MessageNotAccepted or SmtpErrorCode.RecipientNotAccepted or SmtpErrorCode.SenderNotAccepted)
        { return new((int)ex.StatusCode is >= 400 and < 500 ? DeliveryState.SafeToRetry : DeliveryState.PermanentFailure, "SMTP_REJECTED"); }
        catch (MailKit.Security.AuthenticationException) { return new(DeliveryState.PermanentFailure, "SMTP_AUTHENTICATION"); }
        catch (FormatException) { return new(DeliveryState.PermanentFailure, "EMAIL_ADDRESS_INVALID"); }
        catch (Exception) { return new(submissionStarted ? DeliveryState.Ambiguous : DeliveryState.SafeToRetry, submissionStarted ? "SMTP_DELIVERY_UNKNOWN" : "SMTP_CONNECTION_FAILED"); }
    }
}

public abstract class HttpNotificationStrategy(HttpClient? client = null) : INotificationStrategy, IDisposable
{
    // A direct client deliberately avoids IHttpClientFactory URI logging:
    // Telegram includes a secret in its Bot API path.
    protected readonly HttpClient Client = client ?? new(new SocketsHttpHandler { PooledConnectionLifetime = TimeSpan.FromMinutes(5), AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(30), MaxResponseContentBufferSize = 131072 };
    public abstract string Channel { get; }
    public abstract Task<DeliveryResult> SendAsync(OutboxMessage message, CancellationToken cancellationToken);
    protected static DeliveryResult Rejected(HttpResponseMessage response) => new(response.StatusCode == System.Net.HttpStatusCode.TooManyRequests ? DeliveryState.SafeToRetry : (int)response.StatusCode >= 500 ? DeliveryState.Ambiguous : DeliveryState.PermanentFailure, "CHANNEL_HTTP_REJECTED");
    public void Dispose() => Client.Dispose();
}

public sealed class TelegramStrategy(AgentOptions options,HttpClient? client = null) : HttpNotificationStrategy(client)
{
    public override string Channel => "telegram";
    public override async Task<DeliveryResult> SendAsync(OutboxMessage message, CancellationToken cancellationToken)
    {
        if (!options.Telegram.Enabled) return new(DeliveryState.PermanentFailure, "TELEGRAM_DISABLED");
        if (message.Kind is not ("gerente" or "gerente_aviso")) return new(DeliveryState.PermanentFailure, "TELEGRAM_MANAGER_ONLY");
        if (message.Target != options.Telegram.ManagerChatId) return new(DeliveryState.PermanentFailure,"MANAGER_TARGET_CHANGED");
        if (message.Kind == "gerente" && (!AgentSecurity.ValidToken(message.ApproveToken!) || !AgentSecurity.ValidToken(message.RejectToken!))) return new(DeliveryState.PermanentFailure, "APPROVAL_TOKEN_INVALID");
        try
        {
            object payload = message.Kind == "gerente"
                ? new { chat_id = message.Target, text = message.Body, reply_markup = new { inline_keyboard = new[] { new[] { new { text = "[Aprobar Pedido]", callback_data = message.ApproveToken }, new { text = "[Ignorar]", callback_data = message.RejectToken } } } } }
                : new { chat_id = message.Target, text = message.Body };
            using var response = await Client.PostAsJsonAsync($"https://api.telegram.org/bot{options.Telegram.BotToken}/sendMessage", payload, cancellationToken);
            if (!response.IsSuccessStatusCode) return Rejected(response);
            using var result = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
            if (!result.RootElement.TryGetProperty("ok", out var ok) || !ok.GetBoolean()) return new(DeliveryState.PermanentFailure, "TELEGRAM_REJECTED");
            var id = result.RootElement.GetProperty("result").GetProperty("message_id").GetInt64().ToString(System.Globalization.CultureInfo.InvariantCulture);
            return new(DeliveryState.Sent, "TELEGRAM_ACCEPTED", id);
        }
        catch (Exception) { return new(DeliveryState.Ambiguous, "TELEGRAM_DELIVERY_UNKNOWN"); }
    }
    public async Task AcknowledgeAsync(string callbackId, CancellationToken ct)
    {
        if (!options.Telegram.Enabled || callbackId.Length is <1 or >256) return;
        try { using var response = await Client.PostAsJsonAsync($"https://api.telegram.org/bot{options.Telegram.BotToken}/answerCallbackQuery", new { callback_query_id = callbackId, text = "Respuesta recibida. Revisa el estado de la solicitud." }, ct); } catch { }
    }
}

public sealed class WhatsAppStrategy(AgentOptions options,HttpClient? client = null) : HttpNotificationStrategy(client)
{
    public override string Channel => "whatsapp";
    public override async Task<DeliveryResult> SendAsync(OutboxMessage message, CancellationToken cancellationToken)
    {
        var cfg = options.WhatsApp;
        if (!cfg.Enabled || !cfg.EligibilityConfirmed) return new(DeliveryState.PermanentFailure, "WHATSAPP_DISABLED");
        // This pharmacy integration only supports internal manager approval.
        // Healthcare purchase orders cannot be enabled by a config checkbox.
        if (message.Kind is not ("gerente" or "gerente_aviso")) return new(DeliveryState.PermanentFailure, "PHARMACY_WHATSAPP_ORDER_REQUIRES_REVIEW");
        if (message.Target != cfg.ManagerNumber) return new(DeliveryState.PermanentFailure,"MANAGER_TARGET_CHANGED");
        if (message.Kind == "gerente" && (!AgentSecurity.ValidToken(message.ApproveToken!) || !AgentSecurity.ValidToken(message.RejectToken!))) return new(DeliveryState.PermanentFailure, "APPROVAL_TOKEN_INVALID");
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"https://graph.facebook.com/{cfg.GraphVersion}/{cfg.PhoneNumberId}/messages");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", cfg.AccessToken);
            var components = new List<object> { new { type="body",parameters=new[]{new{type="text",text=System.Text.RegularExpressions.Regex.Replace(message.Body,"\\s+"," ").Trim()}}} };
            if(message.Kind=="gerente"){
                components.Add(new{type="button",sub_type="quick_reply",index="0",parameters=new[]{new{type="payload",payload=message.ApproveToken}}});
                components.Add(new{type="button",sub_type="quick_reply",index="1",parameters=new[]{new{type="payload",payload=message.RejectToken}}});
            }
            request.Content=JsonContent.Create(new{messaging_product="whatsapp",to=message.Target,type="template",template=new{name=message.Kind=="gerente"?cfg.TemplateName:cfg.NoticeTemplateName,language=new{code=cfg.TemplateLanguage},components}});
            using var response = await Client.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode) return Rejected(response);
            using var result = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
            var id = result.RootElement.GetProperty("messages")[0].GetProperty("id").GetString();
            return id is null ? new(DeliveryState.Ambiguous, "WHATSAPP_DELIVERY_UNKNOWN") : new(DeliveryState.Sent, "WHATSAPP_ACCEPTED", id);
        }
        catch (Exception) { return new(DeliveryState.Ambiguous, "WHATSAPP_DELIVERY_UNKNOWN"); }
    }
}
