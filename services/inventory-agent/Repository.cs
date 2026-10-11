using System.Data;
using Npgsql;
using NpgsqlTypes;
using MimeKit;

namespace Farmacia.InventoryAgent;

public sealed class PostgresAgentRepository : IAgentRepository, IDisposable
{
    private readonly AgentOptions _options;
    private readonly NpgsqlDataSource? _source;
    private readonly string _schema;
    public PostgresAgentRepository(AgentOptions options)
    {
        options.Validate(); _options = options;
        // Only a validated startup identifier is substituted. API data is always
        // parameterized; callers cannot choose table names or SQL fragments.
        _schema = '"' + options.Schema + '"';
        if (!string.IsNullOrWhiteSpace(options.ConnectionString)) _source = NpgsqlDataSource.Create(options.ConnectionString);
    }
    public void Dispose() => _source?.Dispose();
    private async Task<NpgsqlConnection> Open(CancellationToken ct)
    {
        if (_source is null) throw new InvalidOperationException("AGENT_DATABASE_UNCONFIGURED");
        var connection = await _source.OpenConnectionAsync(ct);
        try
        {
            await using var command = Command(connection, null, $"SELECT \"modo\" FROM {_schema}.\"ModoFuente\" WHERE \"id\"=TRUE");
            if (!string.Equals(await command.ExecuteScalarAsync(ct) as string, _options.SourceMode, StringComparison.Ordinal)) throw new InvalidOperationException("AGENT_SOURCE_MODE_MISMATCH");
            return connection;
        }
        catch { await connection.DisposeAsync(); throw; }
    }
    private static NpgsqlCommand Command(NpgsqlConnection connection, NpgsqlTransaction? transaction, string sql, params (string Name, object? Value)[] values)
    {
        var command = new NpgsqlCommand(sql, connection, transaction) { CommandTimeout = 15 };
        foreach (var (name, value) in values)
        {
            var parameter = new NpgsqlParameter { ParameterName = name, Value = value ?? DBNull.Value };
            if (value is null or DBNull) parameter.NpgsqlDbType = name=="request"?NpgsqlDbType.Uuid:NpgsqlDbType.Text;
            command.Parameters.Add(parameter);
        }
        return command;
    }
    private static async Task<int> Execute(NpgsqlConnection connection, NpgsqlTransaction? tx, string sql, CancellationToken ct, params (string Name, object? Value)[] values)
    { await using var command = Command(connection, tx, sql, values); return await command.ExecuteNonQueryAsync(ct); }
    private static string? Optional(NpgsqlDataReader reader, int index) => reader.IsDBNull(index) ? null : reader.GetString(index);
    private async Task<IReadOnlyList<InventoryItem>> Inventory(NpgsqlConnection connection, NpgsqlTransaction? tx, DateOnly today, CancellationToken ct)
    {
        var sql = $"""
        SELECT m."id",m."nombre",greatest(0,m."stock"-coalesce(l.expired,0)-CASE WHEN coalesce(l.total,0)=0 AND m."fechaCaducidad"<@today THEN m."stock" ELSE 0 END)::int,m."stockMinimo",
        coalesce(l.expiring,0)::int+CASE WHEN coalesce(l.total,0)=0 AND m."fechaCaducidad" BETWEEN @today AND @today+coalesce(c."diasAlerta",m."diasAlertaCaducidad",@days) THEN m."stock" ELSE 0 END,
        coalesce(l.expiry,m."fechaCaducidad"),p."id",p."nombre",p."email",coalesce(c."stockObjetivo",greatest(1,m."stockMinimo"*2)),coalesce(c."diasAlerta",m."diasAlertaCaducidad",@days),coalesce(c."habilitado",FALSE),coalesce(c."prioridad",m."prioridad"),
        coalesce(l.expired,0)::int+CASE WHEN coalesce(l.total,0)=0 AND m."fechaCaducidad"<@today THEN m."stock" ELSE 0 END
        FROM {_schema}."Medicamentos" m LEFT JOIN {_schema}."ConfiguracionReposicion" c ON c."productoId"=m."id"
        LEFT JOIN {_schema}."Proveedores" p ON p."id"=c."proveedorId" AND p."activo"=TRUE
        LEFT JOIN LATERAL (SELECT sum("stock") AS total,sum("stock") FILTER(WHERE "vencimiento"<@today OR "vencimiento" IS NULL) AS expired,
        sum("stock") FILTER(WHERE "vencimiento">=@today AND "vencimiento"<=@today+coalesce(c."diasAlerta",m."diasAlertaCaducidad",@days)) AS expiring,
        min("vencimiento") FILTER(WHERE "stock">0) AS expiry FROM {_schema}."Lotes" WHERE "productoId"=m."id" AND "stock">0) l ON TRUE
        WHERE m."activo"=TRUE ORDER BY m."id"
        """;
        await using var command = Command(connection, tx, sql, ("today", today), ("days", _options.ExpiryAlertDays));
        await using var reader = await command.ExecuteReaderAsync(ct); var items = new List<InventoryItem>();
        while (await reader.ReadAsync(ct)) items.Add(new(reader.GetString(0), reader.GetString(1), reader.GetInt32(2), reader.GetInt32(3), reader.GetInt32(4), reader.IsDBNull(5) ? null : reader.GetFieldValue<DateOnly>(5), Optional(reader,6),Optional(reader,7),Optional(reader,8),reader.GetInt32(9),reader.GetInt32(10),reader.GetBoolean(11),reader.GetString(12),reader.GetInt32(13)));
        return items;
    }
    public async Task<IReadOnlyList<InventoryItem>> InventoryAsync(DateOnly today, CancellationToken ct)
    { await using var connection = await Open(ct); return await Inventory(connection, null, today, ct); }
    public async Task SaveConfigAsync(RestockConfig input, CancellationToken ct)
    {
        input.Validate(); await using var connection = await Open(ct); await using var tx = await connection.BeginTransactionAsync(ct);
        await using (var valid = Command(connection, tx, $"SELECT m.\"stockMinimo\" FROM {_schema}.\"Medicamentos\" m,{_schema}.\"Proveedores\" p WHERE m.\"id\"=@product AND m.\"activo\"=TRUE AND p.\"id\"=@supplier AND p.\"activo\"=TRUE",("product",input.ProductoId),("supplier",input.ProveedorId)))
        { var minimum = await valid.ExecuteScalarAsync(ct); if (minimum is null || input.StockObjetivo <= Convert.ToInt32(minimum)) throw new ArgumentException("Producto/proveedor inexistente o stock objetivo no supera al mínimo."); }
        await Execute(connection,tx,$"""
        INSERT INTO {_schema}."ConfiguracionReposicion" ("productoId","proveedorId","stockObjetivo","diasAlerta","habilitado","prioridad") VALUES(@product,@supplier,@target,@days,@enabled,@priority)
        ON CONFLICT("productoId") DO UPDATE SET "proveedorId"=@supplier,"stockObjetivo"=@target,"diasAlerta"=@days,"habilitado"=@enabled,"prioridad"=@priority,"updatedAt"=NOW()
        """,ct,("product",input.ProductoId),("supplier",input.ProveedorId),("target",input.StockObjetivo),("days",input.DiasAlerta),("enabled",input.Habilitado),("priority",input.Prioridad));
        await Audit(connection,tx,null,"ConfiguracionGuardada","admin",input.ProductoId,DateTimeOffset.UtcNow,ct); await tx.CommitAsync(ct);
    }
    public async Task<object> ListRequestsAsync(CancellationToken ct)
    {
        await using var connection = await Open(ct); await using var command = Command(connection,null,$"SELECT \"id\",\"productoNombre\",\"cantidad\",\"prioridad\",\"motivo\",\"estado\",\"codigoRevision\",\"createdAt\",\"resueltaAt\" FROM {_schema}.\"SolicitudesReposicion\" ORDER BY \"createdAt\" DESC LIMIT 100");
        await using var reader = await command.ExecuteReaderAsync(ct); var rows = new List<object>();
        while (await reader.ReadAsync(ct)) rows.Add(new { id=reader.GetGuid(0),producto=reader.GetString(1),cantidad=reader.GetInt32(2),prioridad=reader.GetString(3),motivo=reader.GetString(4),estado=reader.GetString(5),codigoRevision=Optional(reader,6),createdAt=reader.GetDateTime(7),resueltaAt=reader.IsDBNull(8)?(DateTime?)null:reader.GetDateTime(8) });
        return rows;
    }
    private async Task Audit(NpgsqlConnection connection,NpgsqlTransaction tx,Guid? request,string type,string actor,string detail,DateTimeOffset now,CancellationToken ct)
    { await Execute(connection,tx,$"INSERT INTO {_schema}.\"AuditoriaPedidos\" (\"id\",\"solicitudId\",\"evento\",\"actorHash\",\"detalle\",\"createdAt\") VALUES(@id,@request,@event,@actor,@detail,@now)",ct,("id",Guid.NewGuid()),("request",request),("event",type),("actor",AgentSecurity.ActorHash(actor)),("detail",detail),("now",now)); }
    private async Task Enqueue(NpgsqlConnection connection,NpgsqlTransaction tx,Guid request,string kind,string channel,string target,string subject,string body,string? approve,string? reject,DateTimeOffset now,CancellationToken ct)
    { await Execute(connection,tx,$"""
      INSERT INTO {_schema}."Outbox" ("id","solicitudId","tipo","canal","destino","asunto","cuerpo","approveToken","rejectToken","estado","nextAttemptAt")
      VALUES(@id,@request,@kind,@channel,@target,@subject,@body,@approve,@reject,'Pending',@now) ON CONFLICT("solicitudId","tipo","canal") DO NOTHING
      """,ct,("id",Guid.NewGuid()),("request",request),("kind",kind),("channel",channel),("target",target),("subject",subject),("body",body),("approve",approve),("reject",reject),("now",now)); }
    private static string SupplierBody(Guid id,string product,int quantity,string reason) => $"Estimado proveedor:\n\nLa farmacia Reina del Cisne solicita cotización y reposición según la solicitud {id}.\nProducto: {product}\nCantidad solicitada: {quantity}\nMotivo: {reason}\n\nPor favor confirme disponibilidad, precio, plazo de entrega y recepción de esta solicitud. El correo no registra ingreso de inventario.\n\nAtentamente,\nGestión de inventario de la farmacia Reina del Cisne.";
    private IEnumerable<(string Channel,string Actor,string Chat)> Managers()
    {
        if (_options.Telegram.Enabled) yield return ("telegram",_options.Telegram.ManagerUserId,_options.Telegram.ManagerChatId);
        if (_options.WhatsApp.Enabled && _options.WhatsApp.EligibilityConfirmed) yield return ("whatsapp",_options.WhatsApp.ManagerNumber,_options.WhatsApp.ManagerNumber);
    }
    public async Task<bool> CreateEpisodeAsync(InventoryItem item,AgentOptions options,DateTimeOffset now,CancellationToken ct)
    {
        if (!options.Enabled || !RestockPolicy.NeedsRestock(item)) return false;
        var automatic=item.Priority=="primordial";var recipientValid=MailboxAddress.TryParse(item.SupplierEmail,out _) && item.SupplierId is not null;
        var managers=Managers().ToArray();var state=!recipientValid || !options.Email.Enabled || (!automatic && managers.Length==0)?"Revision":automatic?"EnCola":"PendienteAprobacion";
        var code=state=="Revision"?(!recipientValid?"SUPPLIER_EMAIL_REQUIRED":!options.Email.Enabled?"EMAIL_DISABLED":"MANAGER_CHANNEL_REQUIRED"):null;
        var id=Guid.NewGuid();var expires=now.AddHours(options.ApprovalHours);var quantity=RestockPolicy.Quantity(item);var reason=RestockPolicy.Reason(item);
        await using var connection=await Open(ct);await using var tx=await connection.BeginTransactionAsync(ct);
        var fresh=(await Inventory(connection,tx,AgentClock.Day(now),ct)).FirstOrDefault(current=>current.Id==item.Id);
        if(fresh is null || !RestockPolicy.NeedsRestock(fresh) || RestockPolicy.Fingerprint(fresh)!=RestockPolicy.Fingerprint(item)){await tx.CommitAsync(ct);return false;}
        var inserted=await Execute(connection,tx,$"""
        INSERT INTO {_schema}."SolicitudesReposicion" ("id","productoId","proveedorId","productoNombre","proveedorNombre","emailProveedor","stockSnapshot","cantidad","prioridad","motivo","estado","createdAt","expiresAt","codigoRevision","riesgoSnapshot")
        VALUES(@id,@product,@supplier,@name,@supplierName,@email,@stock,@qty,@priority,@reason,@state,@now,@expiry,@code,@risk)
        ON CONFLICT("productoId") WHERE "resueltaAt" IS NULL DO NOTHING
        """,ct,("id",id),("product",item.Id),("supplier",item.SupplierId),("name",item.Name),("supplierName",item.SupplierName),("email",item.SupplierEmail),("stock",item.Stock),("qty",quantity),("priority",item.Priority),("reason",reason),("state",state),("now",now),("expiry",expires),("code",code),("risk",RestockPolicy.Fingerprint(item)));
        if(inserted==0){await tx.CommitAsync(ct);return false;}
        await Audit(connection,tx,id,automatic?"DecisionAutomaticaPrimordial":"SolicitudCreada","daily-worker",state,now,ct);
        if(state=="EnCola")await Enqueue(connection,tx,id,"proveedor","email",item.SupplierEmail!,"Reposición farmacia "+id,SupplierBody(id,item.Name,quantity,reason),null,null,now,ct);
        if(state=="PendienteAprobacion")foreach(var manager in managers)
        {
            var approve=AgentSecurity.Token();var reject=AgentSecurity.Token();
            foreach(var token in new[]{(Token:approve,Action:"aprobar"),(Token:reject,Action:"ignorar")})await Execute(connection,tx,$"INSERT INTO {_schema}.\"Aprobaciones\" (\"id\",\"solicitudId\",\"tokenHash\",\"accion\",\"canal\",\"actorId\",\"chatId\",\"expiresAt\") VALUES(@id,@request,@hash,@action,@channel,@actor,@chat,@expiry)",ct,("id",Guid.NewGuid()),("request",id),("hash",AgentSecurity.HashToken(token.Token)),("action",token.Action),("channel",manager.Channel),("actor",manager.Actor),("chat",manager.Chat),("expiry",expires));
            await Enqueue(connection,tx,id,"gerente",manager.Channel,manager.Chat,"Revisión de reposición",$"Solicitud {id}. Prioridad {item.Priority}. Cantidad {quantity}. Motivo: {reason}. Revisa los datos del proveedor y producto en el panel antes de decidir.",approve,reject,now,ct);
        }
        await tx.CommitAsync(ct);return true;
    }
    public async Task ResolveRecoveredAsync(IReadOnlyList<InventoryItem> inventory,DateTimeOffset now,CancellationToken ct)
    {
        await using var connection=await Open(ct);await using var tx=await connection.BeginTransactionAsync(ct);
        // Disabling automation is not evidence that stock was replenished.
        // In particular it must not reopen a possibly sent SMTP order later.
        foreach(var item in inventory.Where(item=>item.Stock>item.Minimum && item.ExpiringStock==0 && item.ExpiredStock==0))
        {
            await Execute(connection,tx,$"UPDATE {_schema}.\"SolicitudesReposicion\" SET \"estado\"='Resuelta',\"resueltaAt\"=@now WHERE \"productoId\"=@product AND \"resueltaAt\" IS NULL",ct,("now",now),("product",item.Id));
        }
        await Execute(connection,tx,$"UPDATE {_schema}.\"SolicitudesReposicion\" SET \"estado\"='Expirada' WHERE \"estado\"='PendienteAprobacion' AND \"expiresAt\"<=@now AND \"resueltaAt\" IS NULL",ct,("now",now));
        await Execute(connection,tx,$"UPDATE {_schema}.\"Aprobaciones\" a SET \"consumedAt\"=@now FROM {_schema}.\"SolicitudesReposicion\" r WHERE a.\"solicitudId\"=r.\"id\" AND a.\"consumedAt\" IS NULL AND r.\"estado\" IN ('Resuelta','Ignorada','Expirada')",ct,("now",now));
        await Execute(connection,tx,$"UPDATE {_schema}.\"Outbox\" o SET \"estado\"='Cancelled' FROM {_schema}.\"SolicitudesReposicion\" r WHERE o.\"solicitudId\"=r.\"id\" AND o.\"estado\"='Pending' AND o.\"tipo\"!='gerente_aviso' AND r.\"estado\" IN ('Resuelta','Ignorada','Expirada')",ct);
        await tx.CommitAsync(ct);
    }
    public async Task<string> ApproveAsync(ApprovalEvent input,DateTimeOffset now,CancellationToken ct)
    {
        if(!AgentSecurity.ValidToken(input.Token) || input.ExternalId.Length is <1 or >256 || input.ContextId.Length is <1 or >256)return "ignored";
        await using var connection=await Open(ct);await using var tx=await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted,ct);
        if(await Execute(connection,tx,$"INSERT INTO {_schema}.\"WebhookInbox\" (\"canal\",\"externalId\",\"receivedAt\") VALUES(@channel,@id,@now) ON CONFLICT DO NOTHING",ct,("channel",input.Channel),("id",input.ExternalId),("now",now))==0){await tx.CommitAsync(ct);return "replayed";}
        Guid request;string action,product,email,name,reason,risk;int quantity;
        await using(var command=Command(connection,tx,$"""
        SELECT r."id",a."accion",r."productoId",r."emailProveedor",r."productoNombre",r."cantidad",r."motivo",r."riesgoSnapshot"
        FROM {_schema}."Aprobaciones" a JOIN {_schema}."SolicitudesReposicion" r ON r."id"=a."solicitudId"
        WHERE a."tokenHash"=@hash AND a."canal"=@channel AND a."actorId"=@actor AND a."chatId"=@chat AND a."contextId"=@context
        AND a."consumedAt" IS NULL AND a."expiresAt">@now AND r."estado"='PendienteAprobacion' AND r."resueltaAt" IS NULL AND r."expiresAt">@now FOR UPDATE OF r
        """,("hash",AgentSecurity.HashToken(input.Token)),("channel",input.Channel),("actor",input.ActorId),("chat",input.ChatId),("context",input.ContextId),("now",now)))
        {
            await using var reader=await command.ExecuteReaderAsync(ct);
            if(!await reader.ReadAsync(ct))
            {
                await reader.DisposeAsync();
                // A delivered message can be clicked before its send ACK is
                // persisted. Do not consume that event; ask the platform to
                // retry and still require exact context once it is known.
                await using var pending=Command(connection,tx,$"""
                SELECT EXISTS(SELECT 1 FROM {_schema}."Aprobaciones" a JOIN {_schema}."SolicitudesReposicion" r ON r."id"=a."solicitudId"
                JOIN {_schema}."Outbox" o ON o."solicitudId"=r."id" AND o."canal"=a."canal" AND o."tipo"='gerente'
                WHERE a."tokenHash"=@hash AND a."canal"=@channel AND a."actorId"=@actor AND a."chatId"=@chat
                AND a."consumedAt" IS NULL AND a."expiresAt">@now AND r."estado"='PendienteAprobacion' AND r."resueltaAt" IS NULL AND r."expiresAt">@now
                AND (a."contextId"=@context OR (a."contextId" IS NULL AND o."estado"='Leased' AND o."leaseUntil">@now)))
                """,("hash",AgentSecurity.HashToken(input.Token)),("channel",input.Channel),("actor",input.ActorId),("chat",input.ChatId),("context",input.ContextId),("now",now));
                if((bool)(await pending.ExecuteScalarAsync(ct))!){await tx.RollbackAsync(ct);throw new PendingApprovalContextException();}
                await tx.CommitAsync(ct);return "ignored";
            }
            request=reader.GetGuid(0);action=reader.GetString(1);product=reader.GetString(2);email=reader.GetString(3);name=reader.GetString(4);quantity=reader.GetInt32(5);reason=reader.GetString(6);risk=reader.GetString(7);
        }
        // Re-read source inventory. A stale approval cannot order a new quantity
        // or use a changed supplier without another explicit manager decision.
        var current=(await Inventory(connection,tx,AgentClock.Day(now),ct)).FirstOrDefault(item=>item.Id==product);
        var changed=current is null || !RestockPolicy.NeedsRestock(current) || RestockPolicy.Fingerprint(current)!=risk;
        var state=action=="ignorar"?"Ignorada":changed?"Revision":"EnCola";
        await Execute(connection,tx,$"UPDATE {_schema}.\"SolicitudesReposicion\" SET \"estado\"=@state,\"codigoRevision\"=@code WHERE \"id\"=@id",ct,("state",state),("code",changed?"INVENTORY_CHANGED":null),("id",request));
        await Execute(connection,tx,$"UPDATE {_schema}.\"Aprobaciones\" SET \"consumedAt\"=@now WHERE \"solicitudId\"=@id AND \"consumedAt\" IS NULL",ct,("now",now),("id",request));
        await Execute(connection,tx,$"UPDATE {_schema}.\"Outbox\" SET \"estado\"='Cancelled' WHERE \"solicitudId\"=@id AND \"tipo\"='gerente' AND \"estado\"='Pending'",ct,("id",request));
        await Audit(connection,tx,request,action=="ignorar"?"IgnoradaPorGerente":"AprobacionGerente",input.ActorId,state,now,ct);
        if(state=="EnCola")await Enqueue(connection,tx,request,"proveedor","email",email,"Reposición farmacia "+request,SupplierBody(request,name,quantity,reason),null,null,now,ct);
        await tx.CommitAsync(ct);return state;
    }
    public async Task<OutboxMessage?> LeaseAsync(DateTimeOffset now,CancellationToken ct)
    {
        await using var connection=await Open(ct);await using var tx=await connection.BeginTransactionAsync(ct);
        // An expired lease may have sent a message before its process crashed.
        // It is unknown, never an automatic resend.
        await Execute(connection,tx,$"""
        UPDATE {_schema}."SolicitudesReposicion" r SET "estado"='Revision',"codigoRevision"='LEASE_DELIVERY_UNKNOWN'
        WHERE r."resueltaAt" IS NULL AND EXISTS(SELECT 1 FROM {_schema}."Outbox" o WHERE o."solicitudId"=r."id" AND o."tipo"='proveedor' AND o."estado"='Leased' AND o."leaseUntil"<=@now);
        UPDATE {_schema}."Outbox" SET "estado"='Review',"leaseOwner"=NULL,"leaseUntil"=NULL,"resultCode"='LEASE_DELIVERY_UNKNOWN',"resultadoEntrega"='Ambiguous' WHERE "estado"='Leased' AND "leaseUntil"<=@now
        """,ct,("now",now));
        OutboxMessage? item=null;var owner=Guid.NewGuid();
        await using(var command=Command(connection,tx,$"""
        SELECT o."id",o."solicitudId",o."tipo",o."canal",o."destino",o."asunto",o."cuerpo",o."approveToken",o."rejectToken",o."attempts"
        FROM {_schema}."Outbox" o JOIN {_schema}."SolicitudesReposicion" r ON r."id"=o."solicitudId"
        WHERE o."estado"='Pending' AND o."nextAttemptAt"<=@now AND (o."tipo"='gerente_aviso' OR (r."resueltaAt" IS NULL AND ((o."tipo"='proveedor' AND r."estado"='EnCola') OR (o."tipo"='gerente' AND r."estado"='PendienteAprobacion' AND r."expiresAt">@now))))
        ORDER BY o."nextAttemptAt",o."id" FOR UPDATE OF o SKIP LOCKED LIMIT 1
        """,("now",now)))
        {await using var reader=await command.ExecuteReaderAsync(ct);if(await reader.ReadAsync(ct))item=new(reader.GetGuid(0),reader.GetGuid(1),reader.GetString(2),reader.GetString(3),reader.GetString(4),reader.GetString(5),reader.GetString(6),Optional(reader,7),Optional(reader,8),reader.GetInt32(9)+1,owner);}
        if(item?.Kind=="proveedor")
        {
            string product,risk;
            await using(var query=Command(connection,tx,$"SELECT \"productoId\",\"riesgoSnapshot\" FROM {_schema}.\"SolicitudesReposicion\" WHERE \"id\"=@id FOR UPDATE",("id",item.RequestId)))
            {await using var reader=await query.ExecuteReaderAsync(ct);await reader.ReadAsync(ct);product=reader.GetString(0);risk=reader.GetString(1);}
            var current=(await Inventory(connection,tx,AgentClock.Day(now),ct)).FirstOrDefault(stock=>stock.Id==product);
            if(current is null || !RestockPolicy.NeedsRestock(current) || RestockPolicy.Fingerprint(current)!=risk)
            {
                await Execute(connection,tx,$"UPDATE {_schema}.\"Outbox\" SET \"estado\"='Cancelled',\"resultCode\"='INVENTORY_CHANGED' WHERE \"id\"=@id",ct,("id",item.Id));
                await Execute(connection,tx,$"UPDATE {_schema}.\"SolicitudesReposicion\" SET \"estado\"='Revision',\"codigoRevision\"='INVENTORY_CHANGED' WHERE \"id\"=@id AND \"resueltaAt\" IS NULL",ct,("id",item.RequestId));
                await Audit(connection,tx,item.RequestId,"EnvioDescartado","outbox-worker","INVENTORY_CHANGED",now,ct);await tx.CommitAsync(ct);return null;
            }
        }
        if(item is not null)await Execute(connection,tx,$"UPDATE {_schema}.\"Outbox\" SET \"estado\"='Leased',\"leaseOwner\"=@owner,\"leaseUntil\"=@expiry,\"attempts\"=\"attempts\"+1 WHERE \"id\"=@id",ct,("owner",owner),("expiry",now.AddMinutes(2)),("id",item.Id));
        await tx.CommitAsync(ct);return item;
    }
    public async Task FinishAsync(OutboxMessage item,DeliveryResult result,DateTimeOffset now,CancellationToken ct)
    {
        await using var connection=await Open(ct);await using var tx=await connection.BeginTransactionAsync(ct);
        var state=result.State==DeliveryState.Sent?"Sent":result.State==DeliveryState.SafeToRetry && item.Attempts<3?"Pending":result.State==DeliveryState.Ambiguous?"Review":"Failed";
        var updated=await Execute(connection,tx,$"UPDATE {_schema}.\"Outbox\" SET \"estado\"=@state,\"leaseOwner\"=NULL,\"leaseUntil\"=NULL,\"resultCode\"=@code,\"resultadoEntrega\"=@delivery,\"providerMessageId\"=@provider,\"nextAttemptAt\"=@next WHERE \"id\"=@id AND \"estado\"='Leased' AND \"leaseOwner\"=@owner",ct,("state",state),("code",result.Code),("delivery",result.State.ToString()),("provider",result.ProviderMessageId),("next",now.AddMinutes(Math.Min(60,Math.Pow(2,item.Attempts)))),("id",item.Id),("owner",item.LeaseOwner));
        if(updated==0){await tx.CommitAsync(ct);return;}
        await Audit(connection,tx,item.RequestId,"Envio_"+state,"outbox-worker",result.Code,now,ct);
        if(state=="Sent" && item.Kind=="gerente")await Execute(connection,tx,$"UPDATE {_schema}.\"Aprobaciones\" SET \"contextId\"=@context WHERE \"solicitudId\"=@id AND \"canal\"=@channel AND \"consumedAt\" IS NULL",ct,("context",result.ProviderMessageId),("id",item.RequestId),("channel",item.Channel));
        if(item.Kind=="proveedor" && state=="Sent")
        {
            await Execute(connection,tx,$"UPDATE {_schema}.\"SolicitudesReposicion\" SET \"estado\"='Enviada',\"codigoRevision\"=NULL WHERE \"id\"=@id AND \"resueltaAt\" IS NULL",ct,("id",item.RequestId));
            foreach(var manager in Managers())await Enqueue(connection,tx,item.RequestId,"gerente_aviso",manager.Channel,manager.Chat,"Reposición enviada",$"Solicitud {item.RequestId}: el servidor SMTP aceptó el correo al proveedor. Confirma recepción y plazo. Este envío no modifica el inventario.",null,null,now,ct);
        }
        if(item.Kind=="proveedor" && (state is "Failed" or "Review"))await Execute(connection,tx,$"UPDATE {_schema}.\"SolicitudesReposicion\" SET \"estado\"='Revision',\"codigoRevision\"=@code WHERE \"id\"=@id AND \"resueltaAt\" IS NULL AND \"estado\"!='Enviada'",ct,("code",result.Code),("id",item.RequestId));
        await tx.CommitAsync(ct);
    }
    public async Task ReviewAsync(Guid requestId,string result,bool confirmedNoReceipt,string actor,DateTimeOffset now,CancellationToken ct)
    {
        if(!new[]{"recibida","ignorada","no-recibida-confirmada","rearmar"}.Contains(result) || result=="no-recibida-confirmada" && !confirmedNoReceipt)throw new ArgumentException("La revisión requiere confirmar el resultado con el proveedor.");
        await using var connection=await Open(ct);await using var tx=await connection.BeginTransactionAsync(ct);
        if(result=="rearmar")
        {
            // Explicitly close only proposals that never sent a supplier order.
            // Unknown SMTP delivery always requires supplier reconciliation.
            var closed=await Execute(connection,tx,$"""
            UPDATE {_schema}."SolicitudesReposicion" r SET "estado"='Resuelta',"resueltaAt"=@now,"codigoRevision"='EXPLICIT_REARM'
            WHERE r."id"=@id AND r."resueltaAt" IS NULL AND r."estado" IN ('Revision','Expirada','Ignorada')
            AND NOT EXISTS(SELECT 1 FROM {_schema}."Outbox" o WHERE o."solicitudId"=r."id" AND o."tipo"='proveedor' AND (o."estado" IN ('Leased','Sent','Review') OR o."resultadoEntrega" IN ('Sent','Ambiguous') OR (o."attempts">0 AND NOT @confirmed)))
            """,ct,("now",now),("id",requestId),("confirmed",confirmedNoReceipt));
            if(closed!=1)throw new ArgumentException("Esta solicitud necesita conciliación con el proveedor antes de rearmarse.");
            await Execute(connection,tx,$"UPDATE {_schema}.\"Outbox\" SET \"estado\"='Cancelled' WHERE \"solicitudId\"=@id AND \"estado\"='Pending'",ct,("id",requestId));
            await Execute(connection,tx,$"UPDATE {_schema}.\"Aprobaciones\" SET \"consumedAt\"=@now WHERE \"solicitudId\"=@id AND \"consumedAt\" IS NULL",ct,("now",now),("id",requestId));
            await Audit(connection,tx,requestId,"RearmeExplicito",actor,"Nueva propuesta en el próximo barrido; no registra compra.",now,ct);await tx.CommitAsync(ct);return;
        }
        var changed=await Execute(connection,tx,$"UPDATE {_schema}.\"SolicitudesReposicion\" SET \"estado\"=@state,\"codigoRevision\"=NULL WHERE \"id\"=@id AND \"estado\"='Revision' AND \"resueltaAt\" IS NULL",ct,("state",result=="recibida"?"Enviada":result=="ignorada"?"Ignorada":"EnCola"),("id",requestId));
        if(changed!=1)throw new ArgumentException("La solicitud no admite esta revisión.");
        if(result!="ignorada")
        {
            var outboxes=await Execute(connection,tx,$"UPDATE {_schema}.\"Outbox\" SET \"estado\"=@state,\"nextAttemptAt\"=@now,\"resultCode\"='MANUAL_RECONCILIATION',\"resultadoEntrega\"=@delivery,\"attempts\"=0 WHERE \"solicitudId\"=@id AND \"tipo\"='proveedor' AND \"estado\" IN ('Review','Failed')",ct,("state",result=="recibida"?"Sent":"Pending"),("delivery",result=="recibida"?"Sent":"NoAttempt"),("now",now),("id",requestId));
            if(outboxes!=1)throw new ArgumentException("No existe un envío a proveedor para conciliar.");
        }
        await Execute(connection,tx,$"UPDATE {_schema}.\"Aprobaciones\" SET \"consumedAt\"=@now WHERE \"solicitudId\"=@id AND \"consumedAt\" IS NULL",ct,("now",now),("id",requestId));
        await Audit(connection,tx,requestId,"ConciliacionManual",actor,result,now,ct);await tx.CommitAsync(ct);
    }
}
