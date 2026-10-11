using System.Globalization;
using System.Text.Json;

namespace Farmacia.InventoryAgent;

public static class WebhookParser
{
    private static string Value(JsonElement element, string name) => element.ValueKind==JsonValueKind.Object && element.TryGetProperty(name, out var value) ? value.ValueKind == JsonValueKind.String ? value.GetString() ?? "" : value.ValueKind == JsonValueKind.Number ? value.GetRawText() : "" : "";
    public static ApprovalEvent? Telegram(JsonElement root, AgentOptions options)
    {
        if (root.ValueKind!=JsonValueKind.Object || !root.TryGetProperty("update_id", out var update) || update.ValueKind!=JsonValueKind.Number || !update.TryGetInt64(out var updateId) || updateId < 0 || !root.TryGetProperty("callback_query", out var callback) || callback.ValueKind!=JsonValueKind.Object || Value(callback,"id").Length is <1 or >256) return null;
        if (!callback.TryGetProperty("from", out var from) || !callback.TryGetProperty("message", out var message) || message.ValueKind!=JsonValueKind.Object || !message.TryGetProperty("chat", out var chat)) return null;
        var actor = Value(from,"id"); var chatId = Value(chat,"id"); var token = Value(callback,"data"); var context = Value(message,"message_id");
        if (actor != options.Telegram.ManagerUserId || chatId != options.Telegram.ManagerChatId || !AgentSecurity.ValidToken(token) || context.Length is < 1 or > 256) return null;
        return new("telegram",options.Telegram.BotToken.Split(':')[0]+":"+updateId.ToString(CultureInfo.InvariantCulture),token,actor,chatId,context);
    }
    public static string TelegramCallbackId(JsonElement root) => root.ValueKind==JsonValueKind.Object && root.TryGetProperty("callback_query",out var callback) ? Value(callback,"id") : "";
    public static IEnumerable<ApprovalEvent> WhatsApp(JsonElement root, AgentOptions options)
    {
        var cfg=options.WhatsApp;
        if (root.ValueKind!=JsonValueKind.Object || Value(root,"object")!="whatsapp_business_account" || !root.TryGetProperty("entry",out var entries) || entries.ValueKind!=JsonValueKind.Array) yield break;
        foreach(var entry in entries.EnumerateArray())
        {
            if(entry.ValueKind!=JsonValueKind.Object || Value(entry,"id")!=cfg.WabaId || !entry.TryGetProperty("changes",out var changes) || changes.ValueKind!=JsonValueKind.Array)continue;
            foreach(var change in changes.EnumerateArray())
            {
                if(change.ValueKind!=JsonValueKind.Object || Value(change,"field")!="messages" || !change.TryGetProperty("value",out var value) || value.ValueKind!=JsonValueKind.Object || !value.TryGetProperty("metadata",out var metadata) || Value(metadata,"phone_number_id")!=cfg.PhoneNumberId || !value.TryGetProperty("messages",out var messages) || messages.ValueKind!=JsonValueKind.Array)continue;
                foreach(var message in messages.EnumerateArray())
                {
                    var actor=Value(message,"from");var id=Value(message,"id");
                    if(message.ValueKind!=JsonValueKind.Object || actor!=cfg.ManagerNumber || id.Length is < 1 or > 200 || !message.TryGetProperty("context",out var context))continue;
                    var contextId=Value(context,"id");var token="";
                    if(Value(message,"type")=="button" && message.TryGetProperty("button",out var button))token=Value(button,"payload");
                    else if(Value(message,"type")=="interactive" && message.TryGetProperty("interactive",out var interactive) && Value(interactive,"type")=="button_reply" && interactive.TryGetProperty("button_reply",out var reply))token=Value(reply,"id");
                    if(AgentSecurity.ValidToken(token) && contextId.Length is > 0 and <= 256)yield return new("whatsapp",cfg.PhoneNumberId+":"+id,token,actor,actor,contextId);
                }
            }
        }
    }
}
