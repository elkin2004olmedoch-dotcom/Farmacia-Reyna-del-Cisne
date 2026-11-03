# Tarjetas, cobertura nacional y destino de entrega

## Recorrido

La ventana «Agregar tarjeta» mantiene la identidad de la farmacia y el recorrido observado en PLIEGO: número, MM/AA, código de seguridad, titular, ayuda, confirmación y cancelación. Reconoce Visa, Mastercard, American Express, Diners y Discover; valida longitud, Luhn, vencimiento y código de 3/4 dígitos. Esto comprueba formato, **no la existencia de una tarjeta ni un cobro bancario**. Se usan únicamente datos sintéticos y se mantiene «Sin cobro real» visible.

El navegador conserva temporalmente marca y últimos cuatro dígitos. Borra los campos al aceptar, cancelar, cerrar o abandonar la página. PAN, vencimiento, titular y CVV no se envían a la API ni se guardan en almacenamiento web. La API de práctica sólo admite método y marca. PayPhone comercial conserva su flujo alojado y requiere activación; no se ha contratado una pasarela ni tokenización.

La cobertura nacional comprende las 24 provincias, incluida Galápagos, con tarifa inicial $0. Puerto Quito conserva su configuración local. Administración puede cambiar tarifa, actividad y alcance de una zona con control de versión e historial. Una cobertura con pedidos no permite cambiar su alcance: se crea otra zona. Los pedidos anteriores conservan sus importes.

Al confirmar domicilio, el servidor busca la dirección en Ecuador. También admite un punto proporcionado con permiso. La consulta exige una calle o dirección suficientemente precisa y coincidencia de provincia y cantón; no toma el centro de una ciudad como domicilio. Una búsqueda fallida, ambigua o no disponible selecciona **retiro en farmacia**, conserva el carrito y exige revisar el total y confirmar nuevamente. No crea pedido, reserva stock ni registra pago en ese paso. No modifica pedidos existentes.

## Implementación

- `ZonaEntrega.alcance` y `ZonaEntregaTarifa.alcance`: `local` o `nacional`, por defecto local, con CHECK en SQLite y PostgreSQL. Migración aditiva `202611030013_national_delivery`; no borra tablas ni datos. Inserta la cobertura nacional únicamente si no existe.
- `POST /api/entregas/verificar-destino`: usuario/admin autenticado, campos permitidos, límites de intentos, respuesta privada sin coordenadas. No escribe datos.
- `POST /api/pedidos`: repite la comprobación del destino y verifica tarifa/versión en la transacción. La consulta al geocodificador sucede fuera de ella. El destino resuelto queda vinculado a ese pedido; los reintentos recuperan el mismo pedido sin volver a geocodificar.
- La ruta nacional amplía el límite de distancia terrestre, conserva límites de respuesta y tiempo del proveedor, y vuelve a comprobar autorización y destino. No inventa una línea si OSRM no ofrece ruta. El seguimiento sigue dependiendo de posiciones reales del repartidor.
- Sesiones web revocadas y roles/versiones antiguos se revisan también al escribir pedidos, entregas y pagos. Un reintento de práctica con otro método devuelve conflicto y conserva el registro anterior.
- El importador SQLite→PostgreSQL reconoce únicamente los defaults técnicos intactos, incluidos los nacionales. Rechaza datos comerciales preexistentes o modificados y conserva su operación transaccional explícita; no se ha ejecutado una importación en producción.

## Comprobaciones reproducibles

Con variables de prueba aisladas, sin cargar `.env` de producción:

```sh
node --test --test-concurrency=1 tests/reto2/*.test.cjs
npx playwright test --config tests/reto2/playwright.config.cjs
npx playwright test --config tests/reto2/pages.config.cjs
node --test tests/*.test.cjs
npm audit --omit=dev
```

Los tests relevantes son `card-form`, `payment-practice`, `national-delivery`, `checkout-session-security`, `address-routing`, `cloudmigration` y los recorridos de checkout, entregas y mascotas. Los proveedores geográficos de las fixtures son sintéticos; la aplicación de producción no importa esos archivos. La fixture PostgreSQL sólo acepta una base temporal en loopback y puerto 55421.

La evidencia privada de esta entrega se guarda en `.publish/reports/2026-11-03-pagos-cobertura/`, fuera de Git. Contiene resultados y capturas; no incluye claves ni datos comerciales.

## Límites operativos

Cobertura en el software no equivale a una red de transporte contratada. No hay integración con una transportadora nacional, tarifa logística negociada ni rutas marítimas/aéreas. Una entrega a Galápagos puede tener dirección válida sin tener una ruta terrestre desde el continente. No se inventan transportistas, ETA ni movimientos automáticos del repartidor.

Se mantienen las restricciones de receta, control especial, biológicos y cadena de frío. Las comprobaciones geográficas de puntos aportados por el cliente usan límites aproximados; no sustituyen una delimitación cartográfica oficial. La disponibilidad del geocodificador y OSRM es externa. GPS con pantalla bloqueada requiere prueba física y permisos; un teléfono apagado no transmite ubicación. Render permanece en Free y puede suspenderse por inactividad. No se promete disponibilidad 24/7.

Referencias revisadas: [PLIEGO](https://github.com/andres18113/pliego-muejeje) en `5cf793002754fcdbff483743ce3d6dd6cfee3326`, checkout y ADR 0024/0034; [PCI SSC sobre códigos de seguridad](https://www.pcisecuritystandards.org/faqs/are-merchants-allowed-to-request-card-verification-codes-values-from-cardholders/). Se implementó código propio en JavaScript; no se incorporaron Java, React, Python ni dependencias nuevas.
