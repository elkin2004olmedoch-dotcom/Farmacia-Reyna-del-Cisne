# Reparto móvil — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Preparar app Android/iPhone para compartir ubicación nativa durante entregas, con sesiones renovables, recuperación y permisos reales.
**Architecture:** App complementaria Capacitor con contenido local, Keychain/Keystore y HTTP/GPS nativos; API Express y Prisma 6 compartidas. Propiedad por sesión evita que una pestaña o sesión antigua borre una muestra nueva.
**Tech Stack:** HTML/CSS/JS, Capacitor 8.6.0, plugins GPS 1.3.1, secure-storage 8.0.1 y local-notifications 8.3.1; esbuild 0.28.2; Express/Prisma 6 existentes.
**Spec:** `docs/superpowers/specs/2026-11-01-reparto-movil-design.md`.

## Global Constraints

- Reto 3 y Angular/React/Vue aplazados; preservar tienda, identidad, API y datos existentes.
- Pruebas solo temporales/sintéticas; sin cobros, llamadas, mensajes ni cambios comerciales.
- Migraciones solo aditivas y compatibles SQLite/PostgreSQL; cliente Prisma reutilizado.
- Sin secretos en frontend distribuido, logs, repositorio ni documentos. Credenciales móviles solo en almacén nativo cifrado.
- No contratar servicios ni firmar/distribuir con cuentas ajenas; no afirmar 24/7 sin teléfonos físicos y alojamiento adecuado.

## Review Focus

- Respuesta de renovación perdida: repetir el mismo par no revoca sesión ni amplía expiración.
- Dos emisores: el segundo no suplanta al primero y la retirada web no borra su muestra.
- Red intermitente y timestamps viejos: enviar solo la última muestra reciente, sin duplicados ni cola histórica.
- Cancelación, logout y desactivación: cortar acceso y ubicación, incluso con JWT emitido previamente.
- Restricciones de dispositivos: controles honestos cuando no hay plugin/permiso; no fallback silencioso a almacenamiento web.

## Task 1 — Sesión móvil y propiedad de GPS

**Files:** `server/models/sesiones-moviles.cjs`, `server/controllers/auth-mobile.cjs`, `server/middleware/auth.cjs`, `server/routes/index.cjs`, `server/routes/entregas.cjs`, `server/models/entregas.cjs`, ambos schemas/migraciones; `tests/reto2/mobile-delivery.test.cjs`.
**Produces:** endpoints y DTO exactos de la especificación; claim `mobileSession` validado por middleware; tabla y columna de propiedad.

- [x] Escribir y ejecutar pruebas que fallen por ausencia de login móvil/propiedad.
- [x] Implementar login repartidor, renovación idempotente, revocación, validación y límites de intentos conservando login web.
- [x] Implementar migraciones equivalentes y propiedad de seguimiento, comprobaciones en PUT/DELETE y retirada al cerrar.
- [x] Aprobar SQLite temporal, PostgreSQL temporal y pruebas de entregas/auth anteriores.

## Task 2 — Motor móvil y almacenamiento

**Files:** `mobile/src/session.js`, `mobile/src/tracker.js`, `mobile/src/native.js`, `mobile/test/*.test.js`.
**Consumes:** contrato Task 1. **Produces:** `createSession({transport,storage,randomBytes,now})` y `createTracker({session,gps,clock,onStatus})` independientes del DOM; adaptador nativo.

- [x] Pruebas que fallen para restaurar/renovar sesión, pérdida de respuesta y transporte no nativo.
- [x] Implementar almacén cifrado, HTTP nativo y renovación serializada, sin guardar contraseña/JWT en web storage.
- [x] Pruebas que fallen para throttling, red recuperada, muestras caducadas, conflicto de versión y finalización.
- [x] Implementar observador GPS, un envío pendiente, reconciliación y parada explícita; ejecutar todas las pruebas del motor.

## Task 3 — Interfaz y proyectos Android/iOS

**Files:** `mobile/package.json`, lock, `capacitor.config.json`, `src/index.html`, `src/app.js`, `src/styles.css`, build script, `android/`, `ios/` y guía móvil.
**Consumes:** interfaces Task 2 y API Task 1. **Produces:** app de repartidor con entrega, navegación, llamada y diagnóstico honesto del GPS.

- [x] Fijar versiones de dependencias verificadas y empaquetar contenido local/logo con CSP restrictiva.
- [x] Implementar acceso, bandeja y acciones con validación, foco, errores y controles táctiles.
- [x] Generar proyectos con permisos Android/servicio/notificación/legacy bridge e iOS descripciones/background location; desactivar backup de secretos y navegación remota.
- [x] Verificar build web, UI a 360/390 px y teclado con fixture explícito; compilación Android y análisis nativo que el equipo permita.

## Task 4 — Revisión, regresión y entrega verificable

- [x] Revisión independiente de autenticación, concurrencia, dependencias, licencias, CSP y secretos.
- [x] Ejecutar verificaciones existentes pertinentes y registrar evidencia exacta; no duplicar suite sin cambios que lo justifiquen.
- [x] Documentar instalación y pruebas físicas Android/iPhone, firma, monitoreo y condiciones del hosting actual.
- [x] Preparar cambios para revisión/publicación y sincronizar únicamente archivos de esta tarea al workspace del propietario.
- [x] Informar lo implementado y separar builds/simulaciones de las verificaciones físicas pendientes. No declarar GPS 24/7 operativo antes de cumplirlas.
