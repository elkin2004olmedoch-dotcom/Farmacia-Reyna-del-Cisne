# Compra, seguridad administrativa y privacidad

## Pagar antes de confirmar

Con el modo de pagos de prueba habilitado, el cliente elige tarjeta o transferencia en el checkout. El formulario de tarjeta existente se reutiliza: valida formato y descarta los datos; únicamente método y marca llegan al servidor. Se revisa el total y se pide confirmación antes de guardar. Cancelar, fallar una validación o no localizar la dirección no crea un pedido ni reserva existencias.

`POST /api/pedidos` exige `pago` y `esperadoTotalCentavos` cuando `PAYMENT_PRACTICE_ENABLED=true`. El servidor vuelve a calcular precios, impuestos, disponibilidad y envío. Si el total cambió devuelve conflicto y revierte la reserva. El pedido y su `PagoPractica` se guardan en la misma transacción; una clave idempotente incluye el método y total revisado. Sólo después del commit se solicita el comprobante por correo y se muestra la confirmación. No se vuelve a pedir pagar desde esa confirmación.

No se efectúan cargos ni transferencias bancarias reales y se conserva el aviso breve **Sin cobro real**. No se añaden rótulos académicos a la tienda. El flujo comercial alojado de PayPhone se conserva separado y sigue pendiente de activación. Antes de habilitar cobros comerciales será necesario completar la cuenta del proveedor y diseñar la autorización de pago pendiente sin duplicar reservas; este cambio no simula una autorización bancaria real ni convierte `PagoPractica` en `Pago`.

La configuración bancaria del checkout sólo está disponible para clientes/administradores autenticados en `GET /api/pagos/checkout-configuracion`. La configuración pública no contiene cuenta, titular ni credenciales.

## Cobertura e interfaz

Catálogo, carrito lateral y checkout comparten el mismo renderizado de presentación y laboratorio o marca. La foto se conserva junto al nombre; si falla, aparece el recurso «Imagen no disponible» sin alterar producto, cantidad ni precio. El lateral y el carrito distinguen precio por unidad y subtotal de cada artículo; los controles de cantidad ofrecen un área de 44 × 44 píxeles. La revisión final conserva foto, presentación, empresa, cantidad, impuestos y envío.

**Editar carrito** permite cambiar cantidades y regresar a entrega/pago sin perder los datos escritos. Si se quita el último artículo, se oculta el resumen vacío y el foco ofrece explorar productos. Se mantiene la identidad crema/vino, los logos y Goti; no se incorporan librerías visuales, pasarelas ni cambios de esquema. `purchase-polish.spec.cjs` comprueba continuidad de la información, importes, edición, teclado, fallback de fotos, carrito vacío y accesibilidad en escritorio/móvil y anchos de 320–1440 píxeles.

Al cambiar provincia y cantón, el checkout elige una cobertura local coincidente; en caso contrario selecciona la nacional. El usuario revisa siempre tarifa y total. La tarifa nacional continúa en $0; se conserva el retiro si no se localiza el destino. La cobertura no incorpora una transportadora nacional.

Las mascotas conservan confirmación/cancelación. La administrativa muestra precio y stock anteriores antes de aplicar cambios; la del cliente muestra el subtotal de la cantidad elegida y recuerda que el envío se revisa en la compra. El resumen administrativo añade lotes con existencias que vencen dentro de 90 días, con producto, número y fecha. La consulta es acotada a diez alertas, dentro de la misma instantánea del resumen.

## Correos privados

La tabla de usuarios omite correo y teléfono desde el SELECT del backend; no se ocultan solamente mediante CSS. Menús, cabecera administrativa y perfil muestran el correo enmascarado. El perfil propio y el checkout conservan por API los datos necesarios de la cuenta autenticada. Los pedidos históricos mantienen sus datos comerciales; no se borraron cuentas ni compras. El personal sigue accediendo únicamente con su rol.

## Segundo factor administrativo

En **Mi cuenta → Seguridad de administración → Activar segundo factor**, el administrador confirma su contraseña, añade la clave manualmente a su autenticador y verifica un código de seis dígitos. Sólo entonces se activa. Se muestran una vez ocho códigos de recuperación; deben guardarse fuera del navegador. No se activó automáticamente en la cuenta del titular, porque éste debe vincular su dispositivo y comprobar su primer código.

Se utiliza `otpauth` 9.6.0 para TOTP RFC 6238, en lugar de implementar el algoritmo de OTP. Es la única dependencia directa añadida. Se utiliza SHA-1/6 dígitos/30 segundos por compatibilidad con autenticadores y una ventana de un intervalo. El último contador aceptado se persiste para impedir reutilización. Cinco fallos bloquean durante quince minutos, además del límite de intentos por IP.

La clave TOTP se cifra con AES-GCM mediante el cifrado existente, con una clave derivada por HKDF y contexto específico de MFA. Los códigos de recuperación son aleatorios y sólo se guardan sus hashes. El desafío de login caduca a los cinco minutos, tiene audiencia JWT distinta y no autentica en la API. No se entrega JWT/cookie de acceso hasta comprobar el segundo factor. El desafío y cada código se consumen de forma transaccional. Activar o desactivar revoca las sesiones anteriores; desactivar exige contraseña y segundo factor.

La migración aditiva `202611030014_admin_security` crea `AdminMfa` y `AuditoriaAdmin` en SQLite y PostgreSQL, con restricciones y RLS en PostgreSQL. Añade `Usuario.tokenEpoch`, nullable, para invalidar JWT tras restaurar incluso si la versión antigua coincide. No altera datos comerciales. `AdminMfa` usa PK/FK por usuario. El índice `(createdAt,id)` de auditoría atiende el historial paginado por fecha; no hay índices ni tablas especulativas adicionales.

## Historial y respaldos

**Administración → Historial de acciones** muestra fecha, administrador, operación y resultado. El registro usa acciones y plantillas de rutas fijas; no copia cuerpos de solicitudes, correos, tarjetas, contraseñas ni claves TOTP. La aplicación no expone edición ni borrado del historial. Se conserva también el registro del servidor; si falla la persistencia de auditoría, se registra un error operativo sin contenido privado. La escritura del historial HTTP es posterior a la respuesta y no sustituye los controles transaccionales del negocio.

El importador SQLite→PostgreSQL incorpora auditoría, rechaza destinos con datos y bloquea una importación si el origen tiene MFA configurado: no desactiva ni traslada silenciosamente secretos de segundo factor. Un traslado con MFA requiere un respaldo completo y conservar la configuración criptográfica privada.

La restauración local actúa primero sobre una copia sin publicar: revoca versiones de sesión, asigna una nueva época aleatoria a los JWT, revoca sesiones web/móvil y enlaces de recuperación, elimina desafíos/códigos de recuperación anteriores y conserva MFA activado. La época evita que una versión del respaldo vuelva a coincidir con un JWT emitido posteriormente; se verifica también al autenticar cookies y accesos móviles. Los respaldos anteriores a esta columna deben actualizar su esquema en una copia aislada antes de restaurar; el proceso se detiene si falta. Invalida posiciones GPS antiguas. Los pedidos, importes e inventario se conservan. No se restaura sobre producción durante las pruebas. Se verificó adicionalmente `pg_dump`/`pg_restore` en un clúster PostgreSQL temporal, con datos sintéticos y comparación de pedidos.

## Movimiento de las mascotas y paleta

Se conservan los colores existentes crema, vino (`#681e2a`), rojo y acentos cálidos. La portada recupera el bloque de bienvenida vino, la cabecera crema y los paneles rosados suaves; se comprueban contraste y anchos de 375, 768 y 1440 px. No se modificaron logos ni ilustraciones.

El código anterior convertía la preferencia automática `prefers-reduced-motion` en una pausa persistente de `localStorage` al iniciar. Ahora sólo se guarda cuando el usuario pulsa el control. Una pausa antigua se conserva por accesibilidad y puede revertirse con el botón visible ▶ junto a la mascota; el mensaje explica si la pausa procede de movimiento reducido. No se exige desactivar las protecciones del navegador. Farmi administrativo tiene el mismo control.

Se prueba el ejecutable real de Brave en un perfil temporal y Chrome: avance de fotogramas, pausa y reanudación por teclado, recarga y movimiento reducido. El motor funciona en ambos navegadores. Esto no inspecciona ni cambia las preferencias del perfil personal del titular. Si Canvas no devuelve contexto o falla al dibujar, el mismo atlas se presenta mediante SVG y conserva la animación y el chat; no se leen píxeles para identificar el dispositivo.

También se corrigió un aviso falso de sesión vencida en la primera visita anónima a la portada. Los accesos privados y la limpieza de sesiones vencidas conservan sus controles.

## Evidencias

Pruebas específicas: `checkout-payment-first.test.cjs`, `checkout-pay.payments.cjs` con `checkout-pay.config.cjs`, `admin-mfa.test.cjs`, `admin-security.spec.cjs`, `admin-operations.test.cjs`, `uploadbackup.test.cjs`, `mascot-browser.motion.cjs` con `mascot-browser.config.cjs` y las suites existentes de clientes, mascotas, mapas, Pages y sesiones. Todas usan datos sintéticos o fixtures aisladas. Las evidencias privadas se guardan en `.publish/reports/2026-11-03-compra-segura/`; las claves y respaldos no se publican.

Las pruebas automatizadas de reparto cubren GPS desactualizado, permisos, pérdida de red y reconciliación. No sustituyen probar Android/iPhone físicos con pantalla bloqueada. Un teléfono apagado no transmite GPS. Render sigue Free; no se contrataron servicios ni se promete disponibilidad 24/7. iOS requiere firma de Apple. El RDA 3 continúa pendiente del framework asignado.
