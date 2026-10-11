-- Shared agent state. No inventory is stored or changed here.
-- Worker DB identity needs SELECT on source/views and DML only on these tables.
BEGIN;
CREATE TABLE inventory_agent."ConfiguracionReposicion" (
 "productoId" TEXT PRIMARY KEY CHECK("productoId" ~ '^[A-Za-z0-9_-]{1,80}$'), "proveedorId" TEXT NOT NULL CHECK("proveedorId" ~ '^[A-Za-z0-9_-]{1,80}$'),
 "stockObjetivo" INTEGER NOT NULL CHECK("stockObjetivo" BETWEEN 1 AND 100000), "diasAlerta" INTEGER NOT NULL CHECK("diasAlerta" BETWEEN 0 AND 365),
 "habilitado" BOOLEAN NOT NULL DEFAULT FALSE, "prioridad" TEXT NOT NULL CHECK("prioridad" IN ('primordial','intermedio','bajo')), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE inventory_agent."SolicitudesReposicion" (
 "id" UUID PRIMARY KEY, "productoId" TEXT NOT NULL, "proveedorId" TEXT, "productoNombre" TEXT NOT NULL, "proveedorNombre" TEXT,
 "emailProveedor" TEXT, "stockSnapshot" INTEGER NOT NULL CHECK("stockSnapshot" BETWEEN 0 AND 100000), "cantidad" INTEGER NOT NULL CHECK("cantidad" BETWEEN 1 AND 100000),
 "prioridad" TEXT NOT NULL CHECK("prioridad" IN ('primordial','intermedio','bajo')), "motivo" TEXT NOT NULL CHECK("motivo" IN ('stock mínimo','caducidad','stock y caducidad')),
 "estado" TEXT NOT NULL CHECK("estado" IN ('PendienteAprobacion','EnCola','Enviada','Revision','Ignorada','Expirada','Resuelta')),
 "createdAt" TIMESTAMPTZ NOT NULL, "expiresAt" TIMESTAMPTZ NOT NULL CHECK("expiresAt">"createdAt"), "resueltaAt" TIMESTAMPTZ,
 "codigoRevision" TEXT,"riesgoSnapshot" TEXT NOT NULL CHECK("riesgoSnapshot" ~ '^[a-f0-9]{64}$'), CHECK("resueltaAt" IS NULL OR "resueltaAt">="createdAt")
);
CREATE UNIQUE INDEX "Solicitudes_un_episodio" ON inventory_agent."SolicitudesReposicion"("productoId") WHERE "resueltaAt" IS NULL;
CREATE TABLE inventory_agent."Aprobaciones" (
 "id" UUID PRIMARY KEY, "solicitudId" UUID NOT NULL REFERENCES inventory_agent."SolicitudesReposicion"("id") ON DELETE RESTRICT,
 "tokenHash" BYTEA NOT NULL UNIQUE CHECK(octet_length("tokenHash")=32), "accion" TEXT NOT NULL CHECK("accion" IN ('aprobar','ignorar')),
 "canal" TEXT NOT NULL CHECK("canal" IN ('telegram','whatsapp')), "actorId" TEXT NOT NULL, "chatId" TEXT NOT NULL,
 "contextId" TEXT, "expiresAt" TIMESTAMPTZ NOT NULL, "consumedAt" TIMESTAMPTZ
);
CREATE TABLE inventory_agent."WebhookInbox" (
 "canal" TEXT NOT NULL CHECK("canal" IN ('telegram','whatsapp')), "externalId" TEXT NOT NULL CHECK(length("externalId") BETWEEN 1 AND 256),
 "receivedAt" TIMESTAMPTZ NOT NULL, PRIMARY KEY("canal","externalId")
);
CREATE TABLE inventory_agent."Outbox" (
 "id" UUID PRIMARY KEY, "solicitudId" UUID NOT NULL REFERENCES inventory_agent."SolicitudesReposicion"("id") ON DELETE RESTRICT,
 "tipo" TEXT NOT NULL CHECK("tipo" IN ('proveedor','gerente','gerente_aviso')), "canal" TEXT NOT NULL CHECK("canal" IN ('email','telegram','whatsapp')),
 "destino" TEXT NOT NULL, "asunto" TEXT NOT NULL, "cuerpo" TEXT NOT NULL, "approveToken" TEXT, "rejectToken" TEXT,
 "estado" TEXT NOT NULL CHECK("estado" IN ('Pending','Leased','Sent','Review','Failed','Cancelled')), "attempts" INTEGER NOT NULL DEFAULT 0 CHECK("attempts" BETWEEN 0 AND 10),
 "nextAttemptAt" TIMESTAMPTZ NOT NULL, "leaseOwner" UUID, "leaseUntil" TIMESTAMPTZ, "providerMessageId" TEXT, "resultCode" TEXT,
 "resultadoEntrega" TEXT NOT NULL DEFAULT 'NoAttempt' CHECK("resultadoEntrega" IN ('NoAttempt','Sent','SafeToRetry','Ambiguous','PermanentFailure')),
 UNIQUE("solicitudId","tipo","canal"),
 CHECK(("tipo"='proveedor' AND "canal"='email' AND "approveToken" IS NULL AND "rejectToken" IS NULL) OR ("tipo"='gerente' AND "canal" IN ('telegram','whatsapp') AND "approveToken" IS NOT NULL AND "rejectToken" IS NOT NULL AND "approveToken" ~ '^[a-f0-9]{64}$' AND "rejectToken" ~ '^[a-f0-9]{64}$') OR ("tipo"='gerente_aviso' AND "canal" IN ('telegram','whatsapp') AND "approveToken" IS NULL AND "rejectToken" IS NULL)),
 CHECK(("estado"='Leased' AND "leaseOwner" IS NOT NULL AND "leaseUntil" IS NOT NULL) OR ("estado"!='Leased' AND "leaseOwner" IS NULL AND "leaseUntil" IS NULL))
);
CREATE TABLE inventory_agent."AuditoriaPedidos" (
 "id" UUID PRIMARY KEY, "solicitudId" UUID REFERENCES inventory_agent."SolicitudesReposicion"("id") ON DELETE RESTRICT,
 "evento" TEXT NOT NULL CHECK(length("evento") BETWEEN 1 AND 80), "actorHash" TEXT NOT NULL CHECK("actorHash" ~ '^[A-Fa-f0-9]{64}$'),
 "detalle" TEXT NOT NULL CHECK(length("detalle")<=1000), "createdAt" TIMESTAMPTZ NOT NULL
);
CREATE INDEX "Outbox_pending" ON inventory_agent."Outbox"("nextAttemptAt") WHERE "estado"='Pending';
CREATE INDEX "Aprobaciones_request" ON inventory_agent."Aprobaciones"("solicitudId");
ALTER TABLE inventory_agent."ConfiguracionReposicion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_agent."SolicitudesReposicion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_agent."Aprobaciones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_agent."WebhookInbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_agent."Outbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_agent."AuditoriaPedidos" ENABLE ROW LEVEL SECURITY;
COMMIT;
