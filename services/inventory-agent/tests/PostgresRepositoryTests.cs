using Farmacia.InventoryAgent;
using Npgsql;
using Xunit;

namespace InventoryAgent.Tests;

public sealed class PostgresFactAttribute : FactAttribute
{
    public PostgresFactAttribute(){if(string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("INVENTORY_AGENT_TEST_CONNECTION")))Skip="Requires an explicitly supplied isolated PostgreSQL test connection; no production fallback.";}
}

// Every fixture owns a random schema. Neither setup nor cleanup references real
// public pharmacy rows; Integrated uses a second, synthetic source schema.
public sealed class AgentDatabase : IAsyncDisposable
{
    public static readonly DateTimeOffset Now=new(2026,10,11,15,0,0,TimeSpan.Zero);
    public string Schema {get;}="ia_test_"+Guid.NewGuid().ToString("N");
    public string SourceSchema {get;}
    public AgentOptions Options {get;}
    public PostgresAgentRepository Repository {get;}
    private readonly string _connection;
    private AgentDatabase(string mode)
    {
        _connection=Environment.GetEnvironmentVariable("INVENTORY_AGENT_TEST_CONNECTION")??throw new InvalidOperationException("Explicit test connection required.");
        SourceSchema=Schema+"_src";
        Options=new AgentOptions{Enabled=true,SourceMode=mode,Schema=Schema,ConnectionString=_connection,AdminApiKey=new string('k',40),
            Email=new(){Enabled=true,From="pruebas@example.com",Username="pruebas@example.com",Password="synthetic-password-only"},
            Telegram=new(){Enabled=true,BotToken="12345:"+new string('t',32),WebhookSecret=new string('s',40),ManagerUserId="998877",ManagerChatId="998877"},
            WhatsApp=new(){Enabled=true,EligibilityConfirmed=true,AccessToken=new string('a',40),AppSecret=new string('b',40),VerifyToken=new string('v',40),PhoneNumberId="12345",WabaId="67890",ManagerNumber="593999999999",TemplateName="test_restock",NoticeTemplateName="test_notice"}};
        Repository=new PostgresAgentRepository(Options);
    }
    public static async Task<AgentDatabase> Create(string mode="Standalone")
    {
        var db=new AgentDatabase(mode);
        try
        {
            if(mode=="Integrated")await db.Exec($"""
            CREATE SCHEMA "{db.SourceSchema}";
            CREATE TABLE "{db.SourceSchema}"."Producto"("id" TEXT PRIMARY KEY,"nombre" TEXT NOT NULL,"stock" INT NOT NULL,"stockMinimo" INT NOT NULL,"activo" BOOLEAN NOT NULL);
            CREATE TABLE "{db.SourceSchema}"."Proveedor"("id" TEXT PRIMARY KEY,"nombre" TEXT NOT NULL,"email" TEXT,"activo" BOOLEAN NOT NULL);
            CREATE TABLE "{db.SourceSchema}"."Lote"("id" TEXT PRIMARY KEY,"productoId" TEXT NOT NULL,"stock" INT NOT NULL,"vencimiento" TEXT NOT NULL);
            """);
            await db.Exec(db.Script(mode=="Integrated"?"002-integrated.sql":"001-schema.sql"));
            await db.Exec(db.Script("003-agent.sql"));
            return db;
        }
        catch{await db.DisposeAsync();throw;}
    }
    private string Script(string filename)
    {
        var root=new DirectoryInfo(AppContext.BaseDirectory);
        while(root is not null && !File.Exists(Path.Combine(root.FullName,"services","inventory-agent","sql",filename)))root=root.Parent;
        if(root is null)throw new InvalidOperationException("Source SQL missing in test checkout.");
        return File.ReadAllText(Path.Combine(root.FullName,"services","inventory-agent","sql",filename)).Replace("inventory_agent",Schema,StringComparison.Ordinal).Replace("public.\"",'"'+SourceSchema+"\".\"",StringComparison.Ordinal);
    }
    public async Task<int> Exec(string sql,params(string Name,object Value)[] parameters)
    {await using var connection=new NpgsqlConnection(_connection);await connection.OpenAsync();await using var command=new NpgsqlCommand(sql,connection){CommandTimeout=30};foreach(var p in parameters)command.Parameters.AddWithValue(p.Name,p.Value);return await command.ExecuteNonQueryAsync();}
    public async Task<T> Scalar<T>(string sql)
    {await using var connection=new NpgsqlConnection(_connection);await connection.OpenAsync();await using var command=new NpgsqlCommand(sql,connection);return (T)Convert.ChangeType((await command.ExecuteScalarAsync())!,typeof(T));}
    public string SourceTable(string standalone,string integrated)=>$"\"{(Options.SourceMode=="Standalone"?Schema:SourceSchema)}\".\"{(Options.SourceMode=="Standalone"?standalone:integrated)}\"";
    public async Task Seed(string priority="primordial",int stock=2,int minimum=5)
    {
        await Exec($"INSERT INTO {SourceTable("Medicamentos","Producto")} (\"id\",\"nombre\",\"stock\",\"stockMinimo\",\"activo\") VALUES('med','Medicamento ficticio',@stock,@minimum,TRUE);INSERT INTO {SourceTable("Proveedores","Proveedor")} (\"id\",\"nombre\",\"email\",\"activo\") VALUES('prov','Proveedor sintético','proveedor@example.com',TRUE)",("stock",stock),("minimum",minimum));
        await Repository.SaveConfigAsync(new("med","prov",20,30,true,priority),CancellationToken.None);
    }
    public async Task<InventoryItem> Item()=>Assert.Single(await Repository.InventoryAsync(AgentClock.Day(Now),CancellationToken.None));
    public Task<long> Count(string table)=>Scalar<long>($"SELECT count(*) FROM \"{Schema}\".\"{table}\"");
    public Task<string> State()=>Scalar<string>($"SELECT \"estado\" FROM \"{Schema}\".\"SolicitudesReposicion\" WHERE \"resueltaAt\" IS NULL");
    public async Task<Guid> RequestId()
    {await using var connection=new NpgsqlConnection(_connection);await connection.OpenAsync();await using var command=new NpgsqlCommand($"SELECT \"id\" FROM \"{Schema}\".\"SolicitudesReposicion\" WHERE \"resueltaAt\" IS NULL",connection);return (Guid)(await command.ExecuteScalarAsync())!;}
    public async Task<List<ApprovalEvent>> DeliverManagerMessages(bool failTelegram=false)
    {
        var events=new List<ApprovalEvent>();
        for(var i=0;i<2;i++)
        {
            var message=Assert.IsType<OutboxMessage>(await Repository.LeaseAsync(Now,CancellationToken.None));Assert.Equal("gerente",message.Kind);
            var context="context-"+message.Channel;var fail=failTelegram&&message.Channel=="telegram";
            await Repository.FinishAsync(message,new(fail?DeliveryState.PermanentFailure:DeliveryState.Sent,fail?"TEST_REJECTED":"TEST_ACCEPTED",context),Now,CancellationToken.None);
            if(!fail)events.Add(new(message.Channel,"synthetic-update-"+message.Channel,message.ApproveToken!,message.Channel=="telegram"?Options.Telegram.ManagerUserId:Options.WhatsApp.ManagerNumber,message.Target,context));
        }
        return events;
    }
    public async ValueTask DisposeAsync()
    {
        Repository.Dispose();
        if(!System.Text.RegularExpressions.Regex.IsMatch(Schema,"^ia_test_[a-f0-9]{32}$") || SourceSchema!=Schema+"_src")throw new InvalidOperationException("Refusing unsafe test cleanup.");
        await Exec($"DROP SCHEMA IF EXISTS \"{Schema}\" CASCADE;DROP SCHEMA IF EXISTS \"{SourceSchema}\" CASCADE");
    }
}

public sealed class PostgresRepositoryTests
{
    private static CancellationToken Ct=>CancellationToken.None;
    [PostgresFact] public async Task Configuration_validates_references_target_and_records_nullable_request_audit()
    {
        await using var db=await AgentDatabase.Create();await db.Seed();Assert.Equal(1,await db.Count("AuditoriaPedidos"));
        await Assert.ThrowsAsync<ArgumentException>(()=>db.Repository.SaveConfigAsync(new("med","prov",5,30,true,"primordial"),Ct));
        await Assert.ThrowsAsync<ArgumentException>(()=>db.Repository.SaveConfigAsync(new("missing","prov",20,30,true,"primordial"),Ct));
        await Assert.ThrowsAsync<ArgumentException>(()=>db.Repository.SaveConfigAsync(new("med","missing",20,30,true,"primordial"),Ct));
    }
    [PostgresFact] public async Task Integrated_inventory_reads_source_once_and_invalid_legacy_dates_fail_closed()
    {
        await using var db=await AgentDatabase.Create("Integrated");await db.Seed(stock:20);
        await db.Exec($"INSERT INTO {db.SourceTable("Lotes","Lote")} VALUES('expired','med',4,'2026-10-10'),('near','med',3,'2026-10-20'),('invalid','med',2,'not-a-date'),('valid','med',5,'2027-01-01')");
        var item=await db.Item();Assert.Equal(14,item.Stock);Assert.Equal(6,item.ExpiredStock);Assert.Equal(3,item.ExpiringStock);Assert.Equal(9,RestockPolicy.Quantity(item));
        Assert.Equal(20,await db.Scalar<int>($"SELECT \"stock\" FROM {db.SourceTable("Medicamentos","Producto")} WHERE \"id\"='med'"));
    }
    [PostgresFact] public async Task Standalone_direct_expiry_is_operational_and_aggregate_lots_cannot_exceed_physical_stock()
    {
        await using var db=await AgentDatabase.Create();await db.Seed(stock:8);await db.Exec($"UPDATE {db.SourceTable("Medicamentos","Producto")} SET \"fechaCaducidad\"='2026-10-10' WHERE \"id\"='med'");
        var item=await db.Item();Assert.Equal(0,item.Stock);Assert.Equal(8,item.ExpiredStock);
        var error=await Assert.ThrowsAsync<PostgresException>(()=>db.Exec($"INSERT INTO {db.SourceTable("Lotes","Lote")} VALUES('too-many','med',9,'2027-01-01')"));Assert.Equal("23514",error.SqlState);
        Assert.Equal(0,await db.Count("Lotes"));
        await db.Exec($"INSERT INTO {db.SourceTable("Lotes","Lote")} VALUES('valid-lot','med',6,'2027-01-01')");
        Assert.Equal("23514",(await Assert.ThrowsAsync<PostgresException>(()=>db.Exec($"UPDATE {db.SourceTable("Medicamentos","Producto")} SET \"stock\"=5 WHERE \"id\"='med'"))).SqlState);
        Assert.Equal(8,await db.Scalar<int>($"SELECT \"stock\" FROM {db.SourceTable("Medicamentos","Producto")} WHERE \"id\"='med'"));
        await db.Exec($"BEGIN;UPDATE {db.SourceTable("Medicamentos","Producto")} SET \"stock\"=7 WHERE \"id\"='med';UPDATE {db.SourceTable("Lotes","Lote")} SET \"stock\"=7 WHERE \"id\"='valid-lot';COMMIT");
        Assert.Equal(7,await db.Scalar<int>($"SELECT \"stock\" FROM {db.SourceTable("Lotes","Lote")} WHERE \"id\"='valid-lot'"));
    }
    [PostgresFact] public async Task Primordial_is_automatic_deduplicated_and_notices_exist_only_after_smtp_acceptance()
    {
        await using var db=await AgentDatabase.Create();await db.Seed();var item=await db.Item();
        var results=await Task.WhenAll(Enumerable.Range(0,4).Select(_=>db.Repository.CreateEpisodeAsync(item,db.Options,AgentDatabase.Now,Ct)));
        Assert.Equal(1,results.Count(x=>x));Assert.Equal(1,await db.Count("SolicitudesReposicion"));Assert.Equal(1,await db.Count("Outbox"));Assert.Equal(0,await db.Count("Aprobaciones"));Assert.Equal("EnCola",await db.State());
        var email=Assert.IsType<OutboxMessage>(await db.Repository.LeaseAsync(AgentDatabase.Now,Ct));Assert.Equal("proveedor",email.Kind);Assert.Contains("Estimado proveedor:",email.Body);Assert.Contains("Cantidad solicitada: 18",email.Body);
        await db.Repository.FinishAsync(email,new(DeliveryState.Sent,"SMTP_ACCEPTED","synthetic-message"),AgentDatabase.Now,Ct);
        Assert.Equal("Enviada",await db.State());Assert.Equal(3,await db.Count("Outbox"));var notice=Assert.IsType<OutboxMessage>(await db.Repository.LeaseAsync(AgentDatabase.Now,Ct));Assert.Equal("gerente_aviso",notice.Kind);Assert.Null(notice.ApproveToken);Assert.Null(notice.RejectToken);Assert.Equal(2,(await db.Item()).Stock);
        Assert.False(await db.Repository.CreateEpisodeAsync(item,db.Options,AgentDatabase.Now.AddDays(1),Ct));
    }
    [PostgresFact] public async Task Both_channels_share_one_request_and_concurrent_approvals_create_one_supplier_email()
    {
        await using var db=await AgentDatabase.Create();await db.Seed("intermedio");await db.Repository.CreateEpisodeAsync(await db.Item(),db.Options,AgentDatabase.Now,Ct);
        Assert.Equal(4,await db.Count("Aprobaciones"));var actions=await db.DeliverManagerMessages();var results=await Task.WhenAll(actions.Select(a=>db.Repository.ApproveAsync(a,AgentDatabase.Now,Ct)));
        Assert.Single(results,x=>x=="EnCola");Assert.Equal(3,await db.Count("Outbox"));Assert.Equal("EnCola",await db.State());
        Assert.Equal("replayed",await db.Repository.ApproveAsync(actions[0],AgentDatabase.Now,Ct));
        Assert.Equal(1,await db.Scalar<long>($"SELECT count(*) FROM \"{db.Schema}\".\"Outbox\" WHERE \"tipo\"='proveedor'"));
    }
    [PostgresFact] public async Task Telegram_delivery_failure_does_not_block_WhatsApp_approval()
    {
        await using var db=await AgentDatabase.Create();await db.Seed("bajo");await db.Repository.CreateEpisodeAsync(await db.Item(),db.Options,AgentDatabase.Now,Ct);
        var action=Assert.Single(await db.DeliverManagerMessages(failTelegram:true));Assert.Equal("whatsapp",action.Channel);Assert.Equal("PendienteAprobacion",await db.State());Assert.Equal("EnCola",await db.Repository.ApproveAsync(action,AgentDatabase.Now,Ct));
    }
    [PostgresFact] public async Task Early_approval_retries_after_context_is_persisted_without_consuming_webhook()
    {
        await using var db=await AgentDatabase.Create();await db.Seed("intermedio");await db.Repository.CreateEpisodeAsync(await db.Item(),db.Options,AgentDatabase.Now,Ct);
        var manager=Assert.IsType<OutboxMessage>(await db.Repository.LeaseAsync(AgentDatabase.Now,Ct));Assert.Equal("gerente",manager.Kind);
        var action=new ApprovalEvent(manager.Channel,"early-callback",manager.ApproveToken!,manager.Channel=="telegram"?db.Options.Telegram.ManagerUserId:db.Options.WhatsApp.ManagerNumber,manager.Target,"message-visible-before-finish");
        await Assert.ThrowsAsync<PendingApprovalContextException>(()=>db.Repository.ApproveAsync(action,AgentDatabase.Now,Ct));Assert.Equal(0,await db.Count("WebhookInbox"));
        await db.Repository.FinishAsync(manager,new(DeliveryState.Sent,"TEST_ACCEPTED",action.ContextId),AgentDatabase.Now,Ct);
        Assert.Equal("EnCola",await db.Repository.ApproveAsync(action,AgentDatabase.Now,Ct));Assert.Equal(1,await db.Count("WebhookInbox"));Assert.Equal("replayed",await db.Repository.ApproveAsync(action,AgentDatabase.Now,Ct));
        Assert.Equal(1,await db.Scalar<long>($"SELECT count(*) FROM \"{db.Schema}\".\"Outbox\" WHERE \"tipo\"='proveedor'"));
    }
    [PostgresFact] public async Task Wrong_actor_context_and_expired_approval_never_create_supplier_order()
    {
        await using var db=await AgentDatabase.Create();await db.Seed("intermedio");await db.Repository.CreateEpisodeAsync(await db.Item(),db.Options,AgentDatabase.Now,Ct);var action=(await db.DeliverManagerMessages())[0];
        Assert.Equal("ignored",await db.Repository.ApproveAsync(action with{ExternalId="wrong-user",ActorId="1"},AgentDatabase.Now,Ct));
        Assert.Equal("ignored",await db.Repository.ApproveAsync(action with{ExternalId="wrong-context",ContextId="other"},AgentDatabase.Now,Ct));
        Assert.Equal("ignored",await db.Repository.ApproveAsync(action with{ExternalId="expired"},AgentDatabase.Now.AddDays(2),Ct));
        Assert.Equal(0,await db.Scalar<long>($"SELECT count(*) FROM \"{db.Schema}\".\"Outbox\" WHERE \"tipo\"='proveedor'"));
    }
    [PostgresFact] public async Task Changed_supplier_with_same_email_invalidates_existing_approval()
    {
        await using var db=await AgentDatabase.Create();await db.Seed("intermedio");await db.Repository.CreateEpisodeAsync(await db.Item(),db.Options,AgentDatabase.Now,Ct);var action=(await db.DeliverManagerMessages())[0];
        await db.Exec($"INSERT INTO {db.SourceTable("Proveedores","Proveedor")} (\"id\",\"nombre\",\"email\",\"activo\") VALUES('other','Proveedor distinto','proveedor@example.com',TRUE)");await db.Repository.SaveConfigAsync(new("med","other",20,30,true,"intermedio"),Ct);
        Assert.Equal("Revision",await db.Repository.ApproveAsync(action,AgentDatabase.Now,Ct));Assert.Equal(0,await db.Scalar<long>($"SELECT count(*) FROM \"{db.Schema}\".\"Outbox\" WHERE \"tipo\"='proveedor'"));
    }
    [PostgresFact] public async Task Restocked_source_prevents_stale_creation_and_dispatch()
    {
        await using var db=await AgentDatabase.Create();await db.Seed();var stale=await db.Item();await db.Exec($"UPDATE {db.SourceTable("Medicamentos","Producto")} SET \"stock\"=20 WHERE \"id\"='med'");Assert.False(await db.Repository.CreateEpisodeAsync(stale,db.Options,AgentDatabase.Now,Ct));
        await db.Exec($"UPDATE {db.SourceTable("Medicamentos","Producto")} SET \"stock\"=2 WHERE \"id\"='med'");await db.Repository.CreateEpisodeAsync(await db.Item(),db.Options,AgentDatabase.Now,Ct);await db.Exec($"UPDATE {db.SourceTable("Medicamentos","Producto")} SET \"stock\"=20 WHERE \"id\"='med'");Assert.Null(await db.Repository.LeaseAsync(AgentDatabase.Now,Ct));Assert.Equal("Revision",await db.State());
    }
    [PostgresFact] public async Task Unknown_smtp_result_requires_review_and_never_retries_or_rearms_blindly()
    {
        await using var db=await AgentDatabase.Create();await db.Seed();await db.Repository.CreateEpisodeAsync(await db.Item(),db.Options,AgentDatabase.Now,Ct);var email=Assert.IsType<OutboxMessage>(await db.Repository.LeaseAsync(AgentDatabase.Now,Ct));
        await db.Repository.FinishAsync(email,new(DeliveryState.Ambiguous,"SMTP_DELIVERY_UNKNOWN"),AgentDatabase.Now,Ct);Assert.Equal("Revision",await db.State());Assert.Null(await db.Repository.LeaseAsync(AgentDatabase.Now.AddDays(1),Ct));
        await Assert.ThrowsAsync<ArgumentException>(()=>db.Repository.ReviewAsync(email.RequestId,"rearmar",false,"admin",AgentDatabase.Now,Ct));
        await Assert.ThrowsAsync<ArgumentException>(()=>db.Repository.ReviewAsync(email.RequestId,"no-recibida-confirmada",false,"admin",AgentDatabase.Now,Ct));
        await db.Repository.ReviewAsync(email.RequestId,"no-recibida-confirmada",true,"admin",AgentDatabase.Now,Ct);Assert.Equal("EnCola",await db.State());Assert.IsType<OutboxMessage>(await db.Repository.LeaseAsync(AgentDatabase.Now,Ct));
    }
    [PostgresFact] public async Task Safe_pre_submission_errors_have_bounded_retry_and_expired_lease_is_ambiguous()
    {
        await using var db=await AgentDatabase.Create();await db.Seed();await db.Repository.CreateEpisodeAsync(await db.Item(),db.Options,AgentDatabase.Now,Ct);var email=Assert.IsType<OutboxMessage>(await db.Repository.LeaseAsync(AgentDatabase.Now,Ct));await db.Repository.FinishAsync(email,new(DeliveryState.SafeToRetry,"SMTP_CONNECTION_FAILED"),AgentDatabase.Now,Ct);
        Assert.Null(await db.Repository.LeaseAsync(AgentDatabase.Now.AddSeconds(1),Ct));var second=Assert.IsType<OutboxMessage>(await db.Repository.LeaseAsync(AgentDatabase.Now.AddMinutes(3),Ct));Assert.Equal(2,second.Attempts);
        Assert.Null(await db.Repository.LeaseAsync(AgentDatabase.Now.AddMinutes(6),Ct));Assert.Equal("Revision",await db.State());
    }
    [PostgresFact] public async Task Safe_failed_delivery_and_changed_inventory_can_rearm_only_with_explicit_confirmation()
    {
        await using var db=await AgentDatabase.Create();await db.Seed();await db.Repository.CreateEpisodeAsync(await db.Item(),db.Options,AgentDatabase.Now,Ct);var email=Assert.IsType<OutboxMessage>(await db.Repository.LeaseAsync(AgentDatabase.Now,Ct));
        await db.Repository.FinishAsync(email,new(DeliveryState.SafeToRetry,"SMTP_CONNECTION_FAILED"),AgentDatabase.Now,Ct);await db.Exec($"UPDATE {db.SourceTable("Medicamentos","Producto")} SET \"stock\"=1 WHERE \"id\"='med'");
        Assert.Null(await db.Repository.LeaseAsync(AgentDatabase.Now.AddMinutes(3),Ct));Assert.Equal("Revision",await db.State());
        await Assert.ThrowsAsync<ArgumentException>(()=>db.Repository.ReviewAsync(email.RequestId,"rearmar",false,"admin",AgentDatabase.Now.AddMinutes(3),Ct));
        await db.Repository.ReviewAsync(email.RequestId,"rearmar",true,"admin",AgentDatabase.Now.AddMinutes(3),Ct);
        Assert.True(await db.Repository.CreateEpisodeAsync(await db.Item(),db.Options,AgentDatabase.Now.AddMinutes(3),Ct));var fresh=Assert.IsType<OutboxMessage>(await db.Repository.LeaseAsync(AgentDatabase.Now.AddMinutes(3),Ct));Assert.NotEqual(email.RequestId,fresh.RequestId);Assert.Contains("Cantidad solicitada: 19",fresh.Body);
    }
    [PostgresFact] public async Task Configuration_correction_can_explicitly_rearm_a_never_sent_episode()
    {
        await using var db=await AgentDatabase.Create();await db.Seed();db.Options.Email.Enabled=false;await db.Repository.CreateEpisodeAsync(await db.Item(),db.Options,AgentDatabase.Now,Ct);Assert.Equal("Revision",await db.State());Assert.Equal(0,await db.Count("Outbox"));
        await db.Repository.ReviewAsync(await db.RequestId(),"rearmar",false,"admin",AgentDatabase.Now,Ct);db.Options.Email.Enabled=true;Assert.True(await db.Repository.CreateEpisodeAsync(await db.Item(),db.Options,AgentDatabase.Now,Ct));Assert.Equal(2,await db.Count("SolicitudesReposicion"));Assert.Equal(1,await db.Count("Outbox"));
    }
    [PostgresFact] public async Task Disabling_configuration_is_not_stock_recovery_and_does_not_reopen_unknown_smtp_order()
    {
        await using var db=await AgentDatabase.Create();await db.Seed();await db.Repository.CreateEpisodeAsync(await db.Item(),db.Options,AgentDatabase.Now,Ct);var email=Assert.IsType<OutboxMessage>(await db.Repository.LeaseAsync(AgentDatabase.Now,Ct));await db.Repository.FinishAsync(email,new(DeliveryState.Ambiguous,"SMTP_DELIVERY_UNKNOWN"),AgentDatabase.Now,Ct);
        await db.Repository.SaveConfigAsync(new("med","prov",20,30,false,"primordial"),Ct);await db.Repository.ResolveRecoveredAsync(await db.Repository.InventoryAsync(AgentClock.Day(AgentDatabase.Now),Ct),AgentDatabase.Now,Ct);Assert.Equal("Revision",await db.State());
        await db.Repository.SaveConfigAsync(new("med","prov",20,30,true,"primordial"),Ct);Assert.False(await db.Repository.CreateEpisodeAsync(await db.Item(),db.Options,AgentDatabase.Now,Ct));Assert.Equal(1,await db.Count("Outbox"));
    }
    [PostgresFact] public async Task Database_constraints_reject_null_manager_tokens_and_invalid_priorities()
    {
        await using var db=await AgentDatabase.Create();await db.Seed("intermedio");await db.Repository.CreateEpisodeAsync(await db.Item(),db.Options,AgentDatabase.Now,Ct);
        Assert.Equal("23514",(await Assert.ThrowsAsync<PostgresException>(()=>db.Exec($"UPDATE \"{db.Schema}\".\"Outbox\" SET \"approveToken\"=NULL WHERE \"tipo\"='gerente'"))).SqlState);
        Assert.Equal("23514",(await Assert.ThrowsAsync<PostgresException>(()=>db.Exec($"UPDATE \"{db.Schema}\".\"ConfiguracionReposicion\" SET \"prioridad\"='baja'"))).SqlState);
    }
}
