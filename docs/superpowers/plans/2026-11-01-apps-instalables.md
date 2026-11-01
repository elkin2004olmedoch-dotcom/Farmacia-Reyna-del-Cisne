# Apps instalables y privacidad — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking.

**Goal:** Instalar tienda móvil y administración Windows, mantener reparto separado y privatizar fuente conservando publicaciones.
**Architecture:** PWA reutiliza vistas/API con manifiestos distintos. Worker solo fallback público. APK en dominio propio antes de privatizar GitHub.
**Tech Stack:** HTML/CSS/JS, Express, Prisma 6; ninguna dependencia nueva.
**Spec:** docs/superpowers/specs/2026-11-01-apps-instalables-design.md

## Global Constraints

Sin cambios de BD, pagos, framework, mascota o plan. No cache sensible ni secretos en artefacto. Probar con cuentas temporales/sintéticas. Mantener generador como fuente del HTML.

## Review Focus

- Prompt ausente/cancelado: guía y reintento, nunca falso instalado.
- Cuenta cliente/repartidor en instalador admin: no habilitar acceso; API sigue autorizando.
- Red perdida: fallback genérico sin contenido de sesión en cache.
- Repo privado: enlaces APK y despliegues deben seguir funcionando.
- Móvil/teclado: dialog sin desbordes ni trampa de foco; Escape devuelve foco.

## Task 1 — Instalación y worker

**Files:** frontend/controllers/install.js, frontend/{store,admin}.webmanifest, frontend/app-worker.js, frontend/offline.html, tests/reto2/install*. Controller/HTML IDs y exportaciones fijados en spec; no tocar generator/buildPages/app.js.

- [ ] Pruebas fallidas de prompt/manual/admin y política worker.
- [ ] Implementar control de instalación, manifiestos y fallback público mínimo.
- [ ] Aprobar pruebas focalizadas y revisión independiente.

## Task 2 — Vistas, activos y empaquetado

**Files:** scripts/build-frontend.cjs, scripts/templates/install.cjs, frontend/controllers/app.js, frontend/assets/install.css, frontend/assets/app-icons, frontend/descargas, scripts/build-pages.cjs, server/app.cjs, tests/reto2/pages-build.test.cjs y UI.

- [ ] Pruebas fallidas de distribución y recursos/roles.
- [ ] Añadir botón/dialog y landing admin reutilizando cabecera; iconos desde logo, descargar APK verificado.
- [ ] Integrar bootstrap, exportar todas las pantallas/manifiestos/SW/descarga con CSP y MIME.
- [ ] Aprobar pruebas, accesibilidad y recorridos pertinentes.

## Task 3 — Despliegue y privacidad

- [ ] Revisión final y comprobaciones sin cambios comerciales.
- [ ] Publicar y verificar web/instalador/admin/API/APK en servicios existentes.
- [ ] Privatizar repo autorizado, conservar acceso Git de integraciones y verificar ambos sitios anónimamente.
- [ ] Sincronizar solo cambios propios a carpeta original, documentar evidencias y límites.
