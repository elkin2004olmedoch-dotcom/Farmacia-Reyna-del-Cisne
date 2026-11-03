# Cloudflare Pages

La publicación activa es [farmacia-reyna-del-cisne-pruebas.pages.dev](https://farmacia-reyna-del-cisne-pruebas.pages.dev/). El origen es la aplicación frontend/ generada por scripts/build-frontend.cjs, no la tienda histórica de la raíz.

Configuración existente: rama codex/separacion-cloudflare; comando node scripts/build-pages.cjs; salida dist/pages. El build incluye un Worker sólo para /api/* con destino fijo en Render, conserva las cookies del dominio de la farmacia y valida la lista de archivos, cabeceras, límites y hash del APK. No añade claves privadas al cliente.

La publicación se mantiene en el proyecto existente. No se recrea hosting, no se contrata un plan y no se publica .env, server/, documentos privados o la raíz completa. [Guía del despliegue](DESPLIEGUE-GRATUITO.md), [seguridad](SEGURIDAD_DESPLIEGUE.md) y [pruebas](APPS-INSTALABLES-2026-11-01.md).
