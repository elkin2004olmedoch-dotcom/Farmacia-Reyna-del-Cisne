# Punto 1 — Arquitectura MVC

## Objetivo y método

Comprobar que el Reto 1 se transforma en una aplicación cliente-servidor con separación real de datos, renderizado y eventos. Se inspeccionaron dependencias entre módulos, estructura física, flujo HTTP y generación de pantallas. La prueba `tests/reto2/resources.test.cjs` verifica recursos y evita acceso Fetch/eventos en las vistas y consultas Prisma directas en los controladores del servidor.

## Matriz de subpuntos

| Requisito | Implementación | Evidencia | Resultado |
|---|---|---|---|
| 1.1 `/frontend/models/` | `api.js`, `auth.js`, `catalog.js`, `cart.js`, `orders.js`, `admin.js` y validación ecuatoriana | Datos API, sesión y carrito independientes del renderizado | Implementado |
| 1.1 `/frontend/views/` | `products.js`, `orders.js`, `admin.js`, `layout.js`, `common.js` | Tarjeta reutilizable, formularios, tablas, confirmación y diálogos | Implementado |
| 1.1 `/frontend/controllers/` | `app.js`, `catalog.js`, `account.js`, `checkout.js`, `admin.js`, `layout.js`, `contact.js` | Eventos y coordinación de modelos/vistas | Implementado |
| 1.1 `/frontend/assets/` | Estilos, fuentes, imágenes, iconos y `mvc.css` | Nueve HTML referencian recursos de esa carpeta | Implementado |
| 1.1 index semántico/accesible | `frontend/index.html` con header, nav, main, section, footer y salto al contenido | Test de recursos y navegador | Implementado |
| 1.2 `/server/routes/` | `routes/index.cjs` compone URL, middleware y controlador | Las rutas no contienen consultas Prisma ni cálculo del pedido | Implementado |
| 1.2 `/server/controllers/` | Controladores de auth, productos, pedidos, promociones y admin | Traducción de entradas validadas a servicios de modelo y respuestas HTTP | Implementado |
| 1.2 `/server/models/` | Acceso Prisma y transacción de pedido | Persistencia, consultas, precios y stock centralizados | Implementado |
| 1.2 `/server/middleware/` | Auth, roles, validación, errores, logger; CORS en composición de app | Pipeline reutilizable en cada ruta | Implementado |
| 1.2 `/server/prisma/` | Schema, migración versionada y seed | Inicialización reproducible con `npm run setup` | Implementado |

## Flujo verificado

```mermaid
sequenceDiagram
  actor Cliente
  participant Controlador as Frontend controller
  participant Modelo as Frontend model
  participant Ruta as Express route + middleware
  participant HTTP as Backend controller
  participant Datos as Backend model + Prisma
  participant BD as SQLite
  Cliente->>Controlador: Confirmar pedido
  Controlador->>Modelo: orders.create(carrito, comprador)
  Modelo->>Ruta: POST /api/pedidos + Bearer
  Ruta->>HTTP: JWT/rol/entradas validadas
  HTTP->>Datos: Crear pedido transaccional
  Datos->>BD: Precio, stock, pedido y detalles
  BD-->>Datos: Persistencia confirmada
  Datos-->>HTTP: Pedido
  HTTP-->>Modelo: 201 + JSON
  Modelo-->>Controlador: Pedido registrado
  Controlador->>Cliente: Vista de confirmación y carrito vacío
```

Los modelos del cliente publican señales en `models/events.js`, un EventTarget independiente del DOM. Los controladores escuchan las señales y actualizan las vistas. `scripts/build-frontend.cjs` reutiliza cabecera, pie, campos y diálogos al generar HTML; el comportamiento permanece en módulos MVC.

## Hallazgos y cierre

1. La versión previa tenía cuentas y pedidos locales: reemplazados por API y base de datos en la aplicación de `frontend/`.
2. El carrito del reto previo usaba módulos globales: el nuevo carrito es un modelo ES independiente y publica cambios al controlador.
3. Renderizado repetido: tarjetas, precios, estados, tablas y formularios se centralizaron en las vistas y en las plantillas de construcción.
4. El Reto 1 se conserva en la raíz como antecedente. La aplicación evaluable del Reto 2 se ejecuta con `npm start`, que sirve exclusivamente `frontend/` y `/api`. No hay que abrir los HTML raíz para evaluar este reto.

## Límites

El frontend usa JavaScript puro con módulos ES y no requiere un bundler. El generador sobrescribe los nueve HTML generados: deben editarse sus plantillas para conservar cambios. La existencia de MVC no demuestra por sí sola que una aplicación sea segura; la revisión de permisos está en el informe 04.
