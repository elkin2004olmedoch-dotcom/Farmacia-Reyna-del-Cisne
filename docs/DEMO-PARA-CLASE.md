# Demostración para clase

Abre [el recorrido de clase](https://farmacia-reyna-del-cisne-pruebas.pages.dev/clase). La barra permite cambiar entre Cliente, Administración y Reparto, reiniciar los ejemplos o salir a la tienda.

## Recorrido de exposición

1. Entra como Cliente, busca un producto, añádelo al carrito y muestra su imagen y cantidad. Continúa con la compra, elige entrega a domicilio y revisa la tarifa ficticia inicial de USD 1,50. Puedes usar la cédula sintética 0102030400 y la dirección «Calle de ejemplo 123, frente al parque». No escribas datos personales reales.
2. Confirma el pedido. En Mis pedidos puedes abrir la prueba de pago y elegir aprobado, rechazado o cancelado. Esta pantalla no cobra ni registra un pago.
3. Cambia a Administración. En Productos puedes crear, editar y desactivar registros ficticios; en Promociones, gestionar campañas. Farmi admite, por ejemplo: `Actualiza el precio de "Vitamina C" a 3,50`.
4. En Pedidos, usa Gestionar estado para confirmar y preparar la compra. Abre Entregas, modifica la tarifa de ejemplo si quieres y asigna el pedido al repartidor de clase. Los pedidos anteriores conservan su tarifa.
5. Cambia a Reparto: marca salida, actualiza el GPS simulado, marca llegada y prueba la llamada simulada. Vuelve a Cliente → Mis pedidos → Ver reparto y mapa. El mapa es una ilustración local, no Google Maps ni navegación real.
6. Marca la entrega como entregada. Los datos de destino y ubicación se retiran de esa bandeja. Reiniciar restaura los ejemplos, incluido un pedido preparado con entrega asignada para una demostración rápida.

El estado se comparte entre roles en el mismo navegador y origen. No se sincroniza entre teléfonos u ordenadores. Usa un solo expositor para escrituras; el almacenamiento local no ofrece transacciones entre pestañas simultáneas. Las cuentas de prueba de la aplicación real no se necesitan en este modo.

## Alcance

Se conservan la identidad, el logo y las mascotas. El modo de clase oculta SRI/configuración fiscal, proveedores, lotes, cuentas, instalaciones y activaciones externas. Los campos necesarios para validar un producto siguen presentes. Farmi procesa comandos locales admitidos y también limita sus opciones al recorrido de clase.

La modalidad se activa en /clase o con ?demo=clase y se recuerda por pestaña. Sesión, carrito, comparación, borradores, confirmación y señales de actualización tienen claves distintas de las comerciales. El transporte central usa datos ficticios y devuelve un error local para las rutas no simuladas: no recurre a la API real. Las descargas también pasan por este control.

Los formularios de compra guardan perfiles y direcciones sintéticos. No se piden permisos GPS, no se marcan teléfonos ni se abren pasarelas desde la simulación. El servidor real conserva su autenticación y autorización: seleccionar «Administración» en clase no concede permisos comerciales.

## Referencia y límites de revisión

Se tomó como referencia el flujo público de [Pliego](https://pliegolibros.com/): catálogo con filtros, detalle, carrito, compra y administración separada. No se copió código, marca ni recursos del sitio. La inspección se limitó a HTML y módulos públicos; el navegador interactivo de Codex estaba deshabilitado y no se accedió a áreas privadas de Pliego.

Esta demo es una ayuda para la presentación. El CRUD cliente-servidor, JWT y roles reales del Reto 2 siguen en la aplicación normal y tienen sus propias pruebas. Explica al docente cuándo muestras la simulación y cuándo evidencias la API real. Reto 3 continúa pospuesto hasta recibir el framework asignado.

## Comprobación

Los casos nuevos están en classroom.test.cjs, classroom-runtime.test.cjs y classroom.spec.cjs. Cubren aislamiento, roles, importes, tarifa histórica, stock, idempotencia, Farmi, CRUD de formulario, GPS/mapa/llamada simulados, teclado, accesibilidad y reinicio. Los datos de las pruebas son temporales o locales sintéticos; no se modificó la base comercial.

La infraestructura conserva Cloudflare Pages y Render Free/Auto-Deploy Off. No se activan pagos, servicios ni facturación. La demo no requiere despertar Render una vez cargados sus recursos estáticos; esto no constituye una garantía de funcionamiento offline o disponibilidad 24/7.

Verificación local del 2 de noviembre de 2026: 48 comprobaciones Node focales aprobadas, 144 recorridos MVC y 22 entre frontend/API separados, sin fallos. Los seis recorridos de clase se repitieron después de los últimos ajustes de presentación, junto con sus 14 casos unitarios, sin fallos. Son comprobaciones repetidas o solapadas; no deben sumarse como casos independientes. Una revisión independiente también completó un mismo pedido nuevo a través de los tres roles, sin API externa, GPS real, errores de JavaScript ni registro de worker.

No se ejecutaron pruebas físicas de teléfonos ni se habilitaron proveedores comerciales. La revisión visual de Pliego y la validación de su administración privada permanecen fuera del alcance comprobado.
