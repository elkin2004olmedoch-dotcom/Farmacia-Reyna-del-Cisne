-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" DECIMAL(65,30) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "categoria" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "imagen" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "total" DECIMAL(65,30) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "entrega" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "provincia" TEXT,
    "ciudad" TEXT,
    "direccion" TEXT,
    "codigoPostal" TEXT,
    "requestKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoDetalle" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "nombreProducto" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(65,30) NOT NULL,
    "precioOriginal" DECIMAL(65,30),
    "descuentoPorcentaje" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PedidoDetalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promocion" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "vistaPrevia" BOOLEAN NOT NULL DEFAULT false,
    "descuentoPorcentaje" INTEGER NOT NULL DEFAULT 0,
    "imagen" TEXT,
    "alt" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "inicio" TIMESTAMP(3),
    "fin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promocion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoEstado" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "anterior" TEXT,
    "estado" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PedidoEstado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Semilla" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Semilla_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Producto_activo_categoria_idx" ON "Producto"("activo", "categoria");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Pedido_userId_createdAt_idx" ON "Pedido"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_userId_requestKey_key" ON "Pedido"("userId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "PedidoDetalle_pedidoId_productoId_key" ON "PedidoDetalle"("pedidoId", "productoId");

-- CreateIndex
CREATE INDEX "PedidoEstado_pedidoId_createdAt_idx" ON "PedidoEstado"("pedidoId", "createdAt");

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoDetalle" ADD CONSTRAINT "PedidoDetalle_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoDetalle" ADD CONSTRAINT "PedidoDetalle_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promocion" ADD CONSTRAINT "Promocion_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoEstado" ADD CONSTRAINT "PedidoEstado_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoEstado" ADD CONSTRAINT "PedidoEstado_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Supabase exposes the public schema through its Data API. These records are
-- private: access is performed only by the authenticated Express backend using
-- the privileged PostgreSQL connection. No anonymous/authenticated policies.
ALTER TABLE "Producto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Usuario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Pedido" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PedidoDetalle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Promocion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PedidoEstado" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Semilla" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
