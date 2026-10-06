# Auditoría 04 — Búsqueda, categorías, precios y orden

**Fecha:** 5 de octubre de 2026.
**Alcance:** controles del catálogo y selección de productos visibles.

## Cambios realizados

- Se incorporó una búsqueda por nombre y descripción de los productos.
- La comparación normaliza el texto: elimina diferencias entre mayúsculas, minúsculas y acentos.
- Los filtros combinan la consulta escrita con la categoría y el rango de precio seleccionado.
- Las categorías permiten mostrar bienestar, cuidado personal, cuidado del bebé o todos los productos.
- Los rangos distinguen menos de USD 10, entre USD 10 y 15 incluidos y más de USD 15.
- El orden puede conservar la secuencia recomendada del JSON o clasificar numéricamente por precio ascendente o descendente.
- Los controles recuperan su estado durante la sesión y el orden preferido se intenta conservar también mediante una cookie.

## Errores

- Si ninguna ficha cumple los filtros, se muestra un estado vacío con una opción para restablecerlos.
- Restablecer la búsqueda devuelve el foco al campo para continuar trabajando con teclado.
- Cambiar la lista visible no elimina los productos que ya estaban añadidos al carrito.
- La ordenación usa valores numéricos; ordenar precios como textos podría colocar cantidades en una secuencia incorrecta.
- Las pruebas realizadas cubren los recorridos principales, pero no todas las combinaciones posibles de filtros.

## Resultado

- En la prueba del rango inferior a USD 10 aparece únicamente el protector solar de USD 9,75.
- Al ordenar por menor precio, ese producto aparece antes que las fichas de USD 12,50, USD 15 y USD 18,90.
- Una consulta sin coincidencias muestra el mensaje previsto; al restablecerla regresan los cuatro productos.
- Las categorías responden al teclado mediante flechas, Inicio y Fin, además de la activación del control.
- Para la defensa: filtrar reduce las fichas visibles y ordenar cambia su posición; ninguna acción modifica los datos originales.

## Lo que falta

- Probar combinaciones adicionales de búsqueda, categorías y límites de precio.
- Revisar la respuesta con un catálogo más grande para comprobar tiempos de búsqueda y renderizado.
- Confirmar si la farmacia necesita categorías adicionales antes de ampliar las opciones.
- Mantener coherentes los valores del JSON y los filtros cuando se incorporen nuevos productos.
