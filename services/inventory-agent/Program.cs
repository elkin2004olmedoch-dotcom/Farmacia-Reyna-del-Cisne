using System.Text.Json;
using System.Threading.RateLimiting;
using Farmacia.InventoryAgent;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.RateLimiting;

var builder=WebApplication.CreateBuilder(args);
// Framework exception logging can include provider errors or request fragments.
// The API below emits fixed codes; private connection/credential errors stay private.
builder.Logging.AddFilter("Microsoft.AspNetCore.Diagnostics.ExceptionHandlerMiddleware",LogLevel.None);
builder.WebHost.ConfigureKestrel(server=>server.Limits.MaxRequestBodySize=131072);
var options=builder.Configuration.GetSection("InventoryAgent").Get<AgentOptions>()??new AgentOptions();
options.Validate();
builder.Services.AddSingleton(options);
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<IAgentRepository,PostgresAgentRepository>();
builder.Services.AddSingleton<EmailStrategy>();
builder.Services.AddSingleton<TelegramStrategy>();
builder.Services.AddSingleton<WhatsAppStrategy>();
builder.Services.AddSingleton<INotificationStrategy>(sp=>sp.GetRequiredService<EmailStrategy>());
builder.Services.AddSingleton<INotificationStrategy>(sp=>sp.GetRequiredService<TelegramStrategy>());
builder.Services.AddSingleton<INotificationStrategy>(sp=>sp.GetRequiredService<WhatsAppStrategy>());
builder.Services.AddHostedService<DailyInventoryWorker>();
builder.Services.AddHostedService<OutboxWorker>();
builder.Services.AddRateLimiter(limiter=>{
    limiter.RejectionStatusCode=429;
    limiter.AddPolicy("private",context=>RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString()??"local",_=>new FixedWindowRateLimiterOptions{PermitLimit=120,Window=TimeSpan.FromMinutes(1),QueueLimit=0}));
});
var app=builder.Build();
app.UseExceptionHandler(error=>error.Run(async context=>{
    var exception=context.Features.Get<IExceptionHandlerFeature>()?.Error;
    context.Response.StatusCode=exception is ArgumentException or JsonException?400:503;
    await context.Response.WriteAsJsonAsync(new{error=exception is ArgumentException?"INVALID_INPUT":"AGENT_OPERATION_UNAVAILABLE"});
}));
app.Use(async(context,next)=>{context.Response.Headers.CacheControl="no-store"; await next();});
app.UseRateLimiter();
app.MapGet("/health",(AgentOptions cfg)=>Results.Ok(new{status="ok",automationEnabled=cfg.Enabled,sourceMode=cfg.SourceMode}));
var admin=app.MapGroup("/admin").RequireRateLimiting("private");
admin.AddEndpointFilter(async(invocation,next)=>{
    var ctx=invocation.HttpContext;var cfg=ctx.RequestServices.GetRequiredService<AgentOptions>();
    if(cfg.AdminApiKey.Length<32)return Results.Json(new{error="ADMIN_UNCONFIGURED"},statusCode:503);
    var header=ctx.Request.Headers.Authorization.ToString();
    if(!header.StartsWith("Bearer ",StringComparison.Ordinal) || !AgentSecurity.Equal(header[7..],cfg.AdminApiKey))return Results.Unauthorized();
    return await next(invocation);
});
admin.MapGet("/inventario",async(IAgentRepository repository,TimeProvider clock,CancellationToken ct)=>Results.Ok(await repository.InventoryAsync(AgentClock.Day(clock.GetUtcNow()),ct)));
admin.MapGet("/solicitudes",async(IAgentRepository repository,CancellationToken ct)=>Results.Ok(await repository.ListRequestsAsync(ct)));
admin.MapPut("/configuracion",async(RestockConfig input,IAgentRepository repository,CancellationToken ct)=>{await repository.SaveConfigAsync(input,ct);return Results.Ok(new{saved=true});});
admin.MapPost("/solicitudes/{id:guid}/revision",async(Guid id,ReviewInput input,IAgentRepository repository,TimeProvider clock,CancellationToken ct)=>{await repository.ReviewAsync(id,input.Resultado,input.ConfirmadoSinRecepcion,"admin",clock.GetUtcNow(),ct);return Results.Ok(new{saved=true});});
app.MapPost("/webhooks/telegram",async(HttpContext ctx,AgentOptions cfg,IAgentRepository repository,TelegramStrategy telegram,TimeProvider clock)=>{
    if(!cfg.Enabled || !cfg.Telegram.Enabled)return Results.NotFound();
    if(!AgentSecurity.Equal(ctx.Request.Headers["X-Telegram-Bot-Api-Secret-Token"].ToString(),cfg.Telegram.WebhookSecret))return Results.Unauthorized();
    using var document=await ReadBody(ctx.Request,ctx.RequestAborted);
    var action=WebhookParser.Telegram(document.RootElement,cfg);
    if(action is not null){await repository.ApproveAsync(action,clock.GetUtcNow(),ctx.RequestAborted);await telegram.AcknowledgeAsync(WebhookParser.TelegramCallbackId(document.RootElement),ctx.RequestAborted);}
    return Results.Ok(new{received=true});
}).RequireRateLimiting("private");
app.MapGet("/webhooks/whatsapp",(HttpRequest request,AgentOptions cfg)=>{
    if(!cfg.Enabled || !cfg.WhatsApp.Enabled || !cfg.WhatsApp.EligibilityConfirmed)return Results.NotFound();
    var challenge=request.Query["hub.challenge"].ToString();
    return request.Query["hub.mode"]=="subscribe" && challenge.Length is >0 and <=256 && AgentSecurity.Equal(request.Query["hub.verify_token"],cfg.WhatsApp.VerifyToken)?Results.Text(challenge,"text/plain"):Results.Unauthorized();
}).RequireRateLimiting("private");
app.MapPost("/webhooks/whatsapp",async(HttpContext ctx,AgentOptions cfg,IAgentRepository repository,TimeProvider clock)=>{
    if(!cfg.Enabled || !cfg.WhatsApp.Enabled || !cfg.WhatsApp.EligibilityConfirmed)return Results.NotFound();
    var bytes=await ReadBytes(ctx.Request,ctx.RequestAborted);
    if(!AgentSecurity.VerifyMeta(bytes,ctx.Request.Headers["X-Hub-Signature-256"],cfg.WhatsApp.AppSecret))return Results.Unauthorized();
    using var document=JsonDocument.Parse(bytes);
    foreach(var action in WebhookParser.WhatsApp(document.RootElement,cfg))await repository.ApproveAsync(action,clock.GetUtcNow(),ctx.RequestAborted);
    return Results.Ok(new{received=true});
}).RequireRateLimiting("private");
app.Run();

static async Task<byte[]> ReadBytes(HttpRequest request,CancellationToken ct)
{
    if(request.ContentLength>131072)throw new ArgumentException("BODY_TOO_LARGE");
    using var memory=new MemoryStream();var buffer=new byte[8192];int read;
    while((read=await request.Body.ReadAsync(buffer,ct))>0){if(memory.Length+read>131072)throw new ArgumentException("BODY_TOO_LARGE");await memory.WriteAsync(buffer.AsMemory(0,read),ct);}
    return memory.ToArray();
}
static async Task<JsonDocument> ReadBody(HttpRequest request,CancellationToken ct)=>JsonDocument.Parse(await ReadBytes(request,ct));
public sealed record ReviewInput(string Resultado,bool ConfirmadoSinRecepcion);
public partial class Program { }
