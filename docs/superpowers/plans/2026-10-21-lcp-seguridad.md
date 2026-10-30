# LCP y seguridad del despliegue de prueba

> Ejecución autónoma autorizada por el propietario. Implementación acotada en el checkout aislado existente; revisión independiente al terminar.

**Objetivo:** reducir el LCP medido sin alterar diseño o funciones, revisar seguridad y dejar una promoción de producción revisable.

**Arquitectura:** Pages conserva exclusivamente los estáticos; Express/Prisma y datos siguen en Render/Supabase. No se cambian contratos, sesión, esquema, dependencias ni proveedor.

**Base:** `86804e7` en `codex/separacion-cloudflare`; Pages sirve `28cbed8`, Render `75aee3e`. Especificación: solicitud del propietario del 2026-10-21 y restricciones de `AGENTS.md`. DNS, dominio principal, main y Auto-Deploy de Render no se modifican. Solo se autoriza actualizar la URL de prueba después de validar.

## 1. Evidencia antes de modificar recursos

- [x] Leer auditoría, rendimiento, despliegue, generador HTML y configuración; conservar funcionalidades remotas e históricas.
- [x] Revisar captura pública previa: fachada 1672×941 WebP de 1.647.804 B, descubierta 18–23 ms después del HTML y con prioridad alta. Descarga domina el LCP; no hay tareas largas observadas.
- [x] Medir de nuevo tres pares Render/Pages secuenciales: Chrome escritorio 1440×1000, contexto nuevo, caché vacía, 10 Mbps/40 ms adicionales, sin CPU limitada, proxy normal registrado y terceros bloqueados en ambos. Registrar versiones y errores; no sustituir la evidencia anterior.
- [x] Conservar una baseline extraída de Git para comparación local controlada. No ejecutar suites ni conversiones durante benchmarks.

## 2. Corrección mínima medida

- [x] Probar compresión Sharp en TEMP, desde PNG original, sin modificar dimensiones ni encuadre. Calidad 95: 391.110 B; 90: 290.582 B; 85: 229.598 B.
- [x] Preferir calidad 95 para conservar definición; revisar original/candidata a tamaño nativo y CSS de escritorio/móvil. Cambiar solo `frontend/assets/images/farmacia-fachada-reina.webp` si se confirma la calidad visual.
- [x] Reutilizar el contrato existente de WebP 1672×941; no añadir un test que duplique una conversión de imagen reversible. La regresión de rendimiento se verifica con el benchmark antes/después, sin introducir un umbral temporal inestable en la suite funcional.
- [x] Medir contra la baseline local con idéntico fixture, red, caché y navegador. Si sigue habiendo una demora material, perfilar su causa antes de tocar fuentes, CSS, JS o mascotas. Mantener todos los personajes y animaciones.

## 3. Seguridad y autorización

- [x] Auditar auth/login/logout/restauración, CORS, CSP, cookies/CSRF, autorización de escrituras y ownership de pedidos/seguimiento/facturas con código y pruebas existentes.
- [x] Revisar todos los archivos del artefacto y su lista permitida; comprobar rutas privadas conocidas sin registrar cuerpos, credenciales ni datos personales.
- [x] Ejecutar contratos de cliente/admin/tercero, logout y token revocado con datos temporales; añadir únicamente regresiones que cubran vacíos materiales.
- [x] Verificar en el backend público CORS/preflight, ausencia de cookie de sesión y rechazo de llamadas no autenticadas con payload vacío/identificadores sintéticos. No crear pedidos ni cuentas en la base comercial, ni hacer cobros/emisión fiscal.
- [x] Documentar hallazgos confirmados con severidad y línea; separar riesgos de negocio, límites de configuración y recomendaciones. Ninguna corrección debilita controles.

## 4. Validación y despliegue de prueba

- [x] Ejecutar `npm test`, `npm run test:reto1`, `npm run test:browser` y la configuración Pages completa, con bases/uploads temporales y salidas separadas. Restaurar capturas históricas regeneradas.
- [x] Revisar el diff independientemente, artefacto y ausencia de cambios de dependencias/Prisma/main.
- [x] Publicar solo la rama de la URL Pages de prueba; conservar despliegue previo y backend actual con Auto-Deploy Off.
- [x] Comparar nuevamente tres pares públicos bajo el mismo protocolo; registrar LCP, FCP, TTFB, proxy, recursos, elemento LCP y límites. Objetivo 2.500 ms, sin prometerlo antes de medir.
- [x] Repetir escenarios públicos de escritorio/móvil/error/sesión inválida. Intentar observar un despertar natural después de un intervalo sin tráfico propio; no suspender el servicio de clientes. Comprobar además indisponibilidad mediante interceptación del navegador, claramente etiquetada como simulación.

## 5. Entrega y reversión

- [x] Actualizar `docs/RENDIMIENTO.md`, `docs/DEPLOY_CLOUDFLARE.md` y `docs/SEGURIDAD_DESPLIEGUE.md`, con evidencias saneadas y límites entre pruebas locales y públicas.
- [x] Registrar versión/rollback y requisitos pendientes de promoción sin tocar DNS ni activar operaciones comerciales.
- [x] Sincronizar cambios necesarios a la carpeta original con respaldo, hashes y preservación de `.env`, BD, uploads y archivos exclusivos. No tocar checkouts anidados ni entregables ajenos.

## Decisiones y límites

- La autorización del usuario cubre trabajo autónomo y despliegue de prueba; no se solicitan aprobaciones intermedias para tareas técnicas reversibles.
- No se conoce la causa exacta del reinicio histórico. Render Free puede suspenderse; una observación con API activa o una interceptación no demuestra suspensión real.
- No se altera la reserva de inventario sin un criterio comercial: revisar autorización no equivale a inventar reglas de pago, expiración o límites de compra.
- Los indicadores PSNR/RMSE de compresión no prueban equivalencia perceptual; requieren inspección visual.

## Cierre de validación

Pages de prueba sirve `0672e41` / `8801c092`; Render conserva `75aee3e`, Auto-Deploy Off. La mediana pública Pages fue 1.436 ms (tres muestras, control previo 4.180 ms), frente a 5.204 ms del Render sin cambios. Pasaron 297 pruebas de las cuatro suites, 102 controles estáticos, 22 sondas API, cinco escenarios públicos y tres escenarios de sesión del cliente publicado con API temporal. El ensayo natural registró LCP 1.668 ms y recuperación de tarjetas a los 31.378,3 ms, con timeouts transitorios explícitos; reinicio observado, causa de suspensión compatible pero no confirmada por evento del proveedor. Los valores con Maps permanecen separados.

La promoción del frontend y el parche de backend esperan autorización; no se tocó infraestructura, dominio, DNS, base, dependencias ni Auto-Deploy. Evidencia y riesgos en `docs/pruebas/lcp-seguridad-despliegue-2026-10-21.json` y `docs/SEGURIDAD_DESPLIEGUE.md`. La sincronización de `bbf112a` aplicó 24 archivos (cinco sobrescrituras con respaldo y 19 altas), comprobó 383 archivos elegibles equivalentes y conservó 16 privados y siete exclusivos del propietario. El build de la carpeta original pasó con 94 archivos y `npm test` volvió a pasar 185/185, sin fallos ni omitidos. Los respaldos y las guardas privadas permanecen en TEMP; este cierre solo añade documentación y no exige repetir pruebas de código.
