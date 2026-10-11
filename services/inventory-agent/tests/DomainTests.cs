using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Farmacia.InventoryAgent;
using Xunit;

namespace InventoryAgent.Tests;

public sealed class DomainTests
{
    [Fact] public void Default_configuration_has_no_automation_or_send_capability()
    { var options=new AgentOptions();options.Validate();Assert.False(options.Enabled);Assert.False(options.Email.Enabled);Assert.False(options.Telegram.Enabled);Assert.False(options.WhatsApp.Enabled); }
    [Fact] public void Callback_token_fits_exact_Telegram_byte_limit_and_is_unpredictable()
    {var a=AgentSecurity.Token();var b=AgentSecurity.Token();Assert.NotEqual(a,b);Assert.True(AgentSecurity.ValidToken(a));Assert.Equal(64,Encoding.UTF8.GetByteCount(a));Assert.False(AgentSecurity.ValidToken("a:"+a));Assert.Equal(32,AgentSecurity.HashToken(a).Length);}
    [Fact] public void Meta_signature_authenticates_the_exact_raw_bytes()
    {var body=Encoding.UTF8.GetBytes("{\"dato\": 1}");var secret=new string('s',32);var signature="sha256="+Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret),body));Assert.True(AgentSecurity.VerifyMeta(body,signature,secret));Assert.False(AgentSecurity.VerifyMeta(Encoding.UTF8.GetBytes("{\"dato\":1}"),signature,secret));Assert.False(AgentSecurity.VerifyMeta(body,"sha256=00",secret));Assert.False(AgentSecurity.VerifyMeta(body,signature,"wrong"));}
    [Fact] public void Disabled_secret_never_authenticates_an_empty_header()
    {Assert.False(AgentSecurity.Equal("", ""));Assert.False(AgentSecurity.Equal(null,null));Assert.True(AgentSecurity.Equal("secret","secret"));Assert.False(AgentSecurity.Equal("secret","Secret"));}
    [Theory][InlineData("primordial")][InlineData("intermedio")][InlineData("bajo")]
    public void Only_requested_priority_values_are_valid(string priority)=>new RestockConfig("med","prov",10,30,true,priority).Validate();
    [Theory][InlineData("intermedia")][InlineData("baja")][InlineData("urgent")][InlineData("")]
    public void Other_priority_values_are_rejected(string priority)=>Assert.Throws<ArgumentException>(()=>new RestockConfig("med","prov",10,30,true,priority).Validate());
    [Fact] public void Restocking_does_not_subtract_expired_stock_twice()
    {var item=new InventoryItem("med","Prueba",7,2,3,new(2026,10,15),"prov","Proveedor","a@example.com",20,30,true,"intermedio",5);Assert.True(RestockPolicy.NeedsRestock(item));Assert.Equal(16,RestockPolicy.Quantity(item));Assert.Equal("caducidad",RestockPolicy.Reason(item));}
    [Fact] public void Minimum_is_inclusive_and_disabled_items_are_ignored()
    {var item=new InventoryItem("med","Prueba",5,5,0,null,"prov","Proveedor","a@example.com",20,30,true,"primordial");Assert.True(RestockPolicy.NeedsRestock(item));Assert.False(RestockPolicy.NeedsRestock(item with {Stock=6}));Assert.False(RestockPolicy.NeedsRestock(item with {Enabled=false}));}
    [Fact] public void Snapshot_changes_when_supplier_or_priority_changes_even_with_same_email()
    {var item=new InventoryItem("med","Prueba",1,5,0,null,"prov","Proveedor","a@example.com",20,30,true,"intermedio");Assert.NotEqual(RestockPolicy.Fingerprint(item),RestockPolicy.Fingerprint(item with{SupplierId="other"}));Assert.NotEqual(RestockPolicy.Fingerprint(item),RestockPolicy.Fingerprint(item with{Priority="primordial"}));}
    [Fact] public void Ecuador_day_and_schedule_do_not_depend_on_machine_timezone()
    {var now=new DateTimeOffset(2026,10,12,4,59,0,TimeSpan.Zero);Assert.Equal(new DateOnly(2026,10,11),AgentClock.Day(now));Assert.Equal(new DateTimeOffset(2026,10,12,13,0,0,TimeSpan.Zero),AgentClock.NextDaily(now,8));Assert.Equal(new DateTimeOffset(2026,10,13,13,0,0,TimeSpan.Zero),AgentClock.NextDaily(new(2026,10,12,13,0,0,TimeSpan.Zero),8));}
    [Theory][InlineData("Host=db.example.com;Username=test;Password=synthetic;SSL Mode=Require")][InlineData("Host=db.example.com;Username=test;Password=synthetic;SSL Mode=Disable")]
    public void Remote_database_must_verify_certificate_and_host(string connection)=>Assert.Throws<ArgumentException>(()=>new AgentOptions{ConnectionString=connection}.Validate());
    [Fact] public void Local_ci_database_is_explicitly_allowed_without_remote_tls()
    {new AgentOptions{ConnectionString="Host=localhost;Username=test;Password=synthetic;SSL Mode=Disable"}.Validate();}
    [Fact] public void Parser_never_accepts_free_text_ok_or_delivery_status_as_approval()
    {using var json=JsonDocument.Parse("{\"object\":\"whatsapp_business_account\",\"entry\":[]}");Assert.Empty(WebhookParser.WhatsApp(json.RootElement,new AgentOptions()));using var telegram=JsonDocument.Parse("{\"update_id\":1,\"message\":{\"text\":\"OK\"}}");Assert.Null(WebhookParser.Telegram(telegram.RootElement,new AgentOptions()));}
}
