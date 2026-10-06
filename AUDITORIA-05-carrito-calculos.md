# Auditoría 05 — Carrito, cantidades y cálculo monetario

**Fecha:** 5 de octubre de 2026.
**Alcance:** `cart.js`, presentación del carrito y confirmación de eliminación.

## Cambios realizados

- El carrito registra cada identificador de producto junto con su cantidad.
- Se implementaron acciones para añadir, modificar unidades, quitar una ficha y vaciar el contenido.
- Añadir un producto existente incrementa sus unidades; no crea una segunda fila para el mismo identificador.
- Las cantidades admitidas son enteras entre 1 y 99, con normalización de datos recuperados.
- Los cálculos convierten el precio a centavos antes de multiplicar y sumar.
- La presentación utiliza `Intl.NumberFormat` con formato español de Ecuador y moneda USD.
- Quitar un producto abre una confirmación que permite cancelar o aceptar la eliminación.
- El contador de la cabecera representa el total de unidades, no la cantidad de productos diferentes.

## Errores

- Se descartan cantidades inválidas e identificadores que ya no existen en el catálogo.
- El uso de centavos reduce los errores habituales de sumar decimales binarios directamente.
- Cancelar la confirmación o pulsar Escape conserva el producto y devuelve el foco al control de origen.
- Después de eliminar, el foco pasa a un control disponible; con el carrito vacío llega a “Explorar productos”.
- El subtotal coincide con el total porque esta demostración no calcula impuestos, envío ni descuentos de compra.

## Resultado

- En la prueba, tres vitaminas de USD 12,50 más un protector de USD 9,75 suman USD 47,25.
- Al quitar las vitaminas, queda un total de USD 9,75 y una sola unidad en el carrito.
- Las pruebas de teclado verificaron cambios de cantidad, cancelación, eliminación y estado vacío.
- Las operaciones actualizan la vista y preparan el guardado del estado local del carrito.
- Para la defensa: el carrito es una selección local; todavía no crea un pedido comercial ni realiza cobros.

## Lo que falta

- Definir reglas de inventario si la cantidad permitida debe depender de existencias reales.
- Incorporar impuestos, envío o descuentos únicamente cuando estén confirmadas sus reglas de negocio.
- Añadir un backend si se requiere registrar y confirmar pedidos entre distintos dispositivos.
- Revisar los cálculos al incorporar productos con otras reglas de precio o monedas.
