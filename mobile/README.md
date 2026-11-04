# App de reparto — Reina del Cisne

Esta app complementa la tienda web para repartidores Android/iPhone. Conserva HTML/CSS/JavaScript y consume la API Express/Prisma existente. No forma parte de la futura migración académica del Reto 3.

## Estado de la candidata

Código de GPS nativo, HTTP nativo, sesión renovable y almacenamiento Keychain/Keystore implementados. Proyectos Android e iOS generados. Consultar el informe de verificación antes de confundir pruebas sintéticas, builds y operación en teléfonos reales. **El código por sí solo no acredita seguimiento 24/7.**

La disponibilidad continua requiere una instancia de backend sin suspensión y pruebas en los dispositivos reales. El manifiesto del proyecto declara Render Free; no se ha contratado un plan ni una cuenta de publicación móvil como parte de esta implementación.

## Preparar y verificar

Node 22.13 o posterior, dependencias de la raíz instaladas para las pruebas UI:

```sh
npm ci
npm ci --prefix mobile
npm test --prefix mobile
npm run test:ui --prefix mobile
npm run build --prefix mobile
```

El build copia el logo original y empaqueta contenido local en `mobile/www`. Las credenciales nunca van en los recursos de la app. El origen de API en `src/native.js` es el origen público de Render existente; cambiar de infraestructura exige revisar ese valor y generar un nuevo build.

Las dependencias están fijadas. El árbol de herramientas de Capacitor CLI fuerza `glob` 14.0.3 y `minimatch` 11.0.3 para corregir los avisos GHSA-3g3m-2fjr-6pw4 y GHSA-g3hv-75wg-m249; se verifica `cap sync` con esas versiones. No se degrada Capacitor ni se silencian los avisos de npm.

### Android

JDK 21 y Android SDK 36. Las herramientas se configuran localmente; `android/local.properties` y llaves de firma no se incluyen en Git.

```sh
cd mobile
npx --no-install cap sync android
cd android
# Windows: .\gradlew.bat ; macOS/Linux: ./gradlew
./gradlew --no-daemon assembleDebug lintDebug
```

El APK de pruebas queda en `android/app/build/outputs/apk/debug/app-debug.apk`. Su firma de depuración sirve para evaluación, no para publicar en Google Play. La app solicita notificaciones y ubicación; el servicio mantiene un aviso visible durante la entrega. Bloquear la pantalla no debe detener el observador mientras el sistema y los permisos lo permitan. La optimización de batería del fabricante puede interferir y se comprueba en cada teléfono.

### iPhone

Se necesita macOS/Xcode 26 o posterior para compilar y una firma/aprovisionamiento válidos para instalar en un iPhone. El workflow `Verificar app de reparto` prepara una compilación **de simulador sin firma**; ese archivo no se instala en el teléfono ni equivale a TestFlight.

```sh
cd mobile
npx --no-install cap sync ios
npx --no-install cap open ios
```

El proyecto utiliza Swift Package Manager. `Info.plist` declara las explicaciones de ubicación y el modo de ubicación en segundo plano. El almacén usa `afterFirstUnlockThisDeviceOnly`, sin sincronización iCloud: permite renovar con pantalla bloqueada después del primer desbloqueo del dispositivo.

## Recorrido del repartidor

1. Iniciar sesión con una cuenta activa de repartidor. Cliente y administrador no acceden a esta app.
2. Recibir el pedido: cuando existe un único repartidor activo, se asigna automáticamente al crearlo o confirmarlo/prepararlo. La farmacia debe prepararlo antes de la salida.
3. Pulsar **Iniciar recorrido**, aceptar los permisos y comprobar el estado de envío. La captura no se inicia a escondidas al instalar o abrir la app.
4. Consultar el mapa y su línea de ruta dentro de la app. La posición se mueve con las capturas GPS y la ruta se recalcula como máximo cada treinta segundos mientras el mapa está visible. Si falta un punto de destino, ubicarlo con un toque o coordenadas y confirmar su uso para navegación. El cliente consulta su seguimiento en la tienda.
5. Pulsar **Llegué al destino**: aparece la llamada al destinatario. **Pedido entregado** pide confirmación y retira coordenadas, destino y mapa del reparto.
6. Puede detenerse la ubicación explícitamente. Al salir se detiene el proveedor y se revoca la sesión. Sin conexión se conserva cifrada una revocación pendiente y no se restaura el perfil previo; se reintenta antes del próximo inicio de sesión.

## Comportamiento y límites

- Una entrega/sesión propietaria del GPS, una escritura simultánea, mínimo 12 segundos entre intentos. La frecuencia real depende del sensor y del sistema operativo; no es un temporizador garantizado.
- Solo se conserva la última muestra reciente pendiente en memoria. Se descartan puntos de más de dos minutos; no se construye una ruta histórica ni se presentan puntos antiguos como actuales.
- JWT de 15 minutos en memoria y refresh rotatorio de hasta 30 días en almacén nativo cifrado. Pérdida de respuesta conserva el mismo par de renovación para reintento idempotente.
- Una pestaña web anterior no puede borrar el seguimiento de la app. Logout, desactivación permitida y cierre/cancelación retiran la propiedad en el servidor.
- Si se reinstala la app o se pierde el almacén del teléfono y otra sesión conserva la entrega, se puede iniciar sesión en la web con la misma cuenta y cerrar sesión allí para revocar las sesiones del repartidor antes de volver a entrar en la app. No se toma silenciosamente un seguimiento válido de otro dispositivo.
- El usuario puede quitar permisos, detener el servicio o cerrar forzosamente la app; el equipo puede apagarla por batería o falta de recursos. No se promete funcionamiento tras esas acciones, con el equipo apagado o sin cobertura.
- La biblioteca Android de almacenamiento usa `SharedPreferences.apply()`: el éxito de su API no demuestra sincronización física a disco frente a corte abrupto. Las pruebas de archivos sintéticos no sustituyen una prueba de cierre forzado/apagado del dispositivo durante renovación.
- Esta candidata no contiene credenciales comerciales, firma de distribución ni integración de cobros nueva. El mapa y los enlaces mantienen sus proveedores y elección del usuario.

## Puertas de aceptación física

Con cuentas y pedidos sintéticos separados, comprobar en **un Android y un iPhone reales**:

- Pantalla bloqueada durante al menos 30 minutos; mantener la ubicación visible y con hora real en el cliente.
- Abrir Maps y otras apps; comprobar notificación/indicador, precisión y consumo de batería.
- Cortar y restaurar la red; mostrar falta de actualización y recuperar una muestra reciente sin duplicar envíos.
- Superar una vida del JWT; renovar también con pantalla bloqueada.
- Reabrir sin red y después iniciar sesión con contraseña; retirar la sesión anterior antes de reemplazarla.
- Denegar/retirar permisos, cerrar la app forzosamente y simular error de almacenamiento: nunca afirmar que se envía GPS o se cerró la sesión sin confirmación.
- Finalizar/cancelar desde administración y comprobar que desaparecen coordenadas/destino y se detiene el envío al reconciliar.

No usar pedidos comerciales, emitir facturas ni realizar cobros durante esas pruebas. Los APK de depuración y los builds de simulador son herramientas de verificación, no una aprobación de producción.

## Mapa y ruta de la versión 0.2.0

Leaflet 1.9.4 se empaqueta localmente con su licencia BSD; no se ejecutan scripts de terceros desde CDN. Mosaicos HTTPS de OpenStreetMap y rutas OSRM/FOSSGIS con atribución visible. La API propia autoriza la entrega antes y después del cálculo, valida geometría, limita tamaño/tiempo y frecuencia y no reenvía JWT, nombre, teléfono ni productos al proveedor. Si no hay una ruta por calles, muestra el error y permite reintentar. Los puntos manuales de navegación sólo viven en memoria; no se registran como consentimiento del comprador ni sustituyen su dirección. No incluye voz ni navegación certificada.

El backend actual permanece en Render Free y el proveedor público de mapas no tiene SLA. No se afirma disponibilidad 24/7. Un teléfono apagado, sin batería, sin GPS/permisos o con la app detenida a la fuerza no puede garantizar nuevas ubicaciones. iPhone sigue pendiente de firma/distribución y pruebas físicas.

### Actualización de ruta automática (0.4.0)

Al abrir Ver ruta en la app se solicita la ubicación actual, también para consultar un pedido que todavía no ha salido. No se muestran campos de latitud/longitud ni se requiere confirmar un punto manual. Cuando falta el GPS de destino, el backend busca la dirección guardada con Nominatim: sólo acepta resultados específicos que coinciden con la calle o lugar y el cantón en Ecuador. Una calle se indica como aproximada; no se sustituye una dirección desconocida por el centro de la ciudad. Si el permiso se deniega se permite reintentar desde Usar mi ubicación; si no hay resultado o es ambiguo, la farmacia debe precisar la dirección. La captura continua del reparto comienza con Iniciar recorrido y conserva los controles existentes.

La búsqueda usa únicamente la dirección, provincia y cantón, sin nombre, teléfono, correo o productos. Caché de proceso y deduplicación, máximo una búsqueda cada 1,1 segundos y hasta cinco búsquedas pendientes. GEOCODING_ORIGIN permite cambiar el servicio compatible desde el backend sin actualizar la app. No hay autocompletado ni búsqueda periódica cuando la dirección no se encontró. El permiso de ubicación del sistema sigue siendo necesario.
