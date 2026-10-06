# Auditoría 07 — Formulario, validación y WhatsApp

**Fecha:** 5 de octubre de 2026.
**Alcance:** formulario de contacto, mensajes de error y enlace de consulta.

## Cambios realizados

- Se implementó validación personalizada de nombre, correo electrónico, teléfono y mensaje.
- El nombre admite letras Unicode, espacios y signos permitidos, con una longitud de 2 a 80 caracteres.
- El correo se comprueba mediante su formato y longitud máxima de 254 caracteres.
- El teléfono elimina separadores comunes y admite entre 7 y 15 dígitos, con un signo inicial “+” opcional.
- El mensaje debe contener entre 10 y 1000 caracteres después de quitar espacios exteriores.
- Los errores identifican el campo, usan `aria-invalid` y se relacionan con su explicación mediante `aria-describedby`.
- Un resumen enlaza con cada campo incorrecto y la validación dirige el foco al primero que requiere corrección.
- Con datos válidos se prepara un enlace a WhatsApp que incluye la consulta codificada con `encodeURIComponent`.

## Errores

- Una entrada incorrecta no genera el enlace de consulta; primero debe corregirse.
- Al editar un campo se retira su error anterior y se evita mantener visible un resultado de validación desactualizado.
- La comprobación del correo revisa su formato, pero no confirma que la dirección exista.
- El formato del teléfono tampoco demuestra que pertenezca al usuario o tenga WhatsApp activo.
- La consulta no se envía automáticamente: el usuario abre WhatsApp y decide enviarla.

## Resultado

- La prueba de formulario vacío mostró cuatro errores con enlaces a sus campos.
- Con datos válidos apareció el enlace previsto y el foco permitió continuar hacia WhatsApp.
- Las pruebas incluyeron nombres con acentos y rechazaron entradas inválidas para los campos comprobados.
- No se guarda información personal en localStorage, sessionStorage ni la caché de productos.
- Para la defensa: el sitio construye un mensaje y un enlace; no dispone de servidor de correo ni recepción propia de formularios.

## Lo que falta

- Confirmar que el número de WhatsApp configurado pertenece a la farmacia y atiende consultas.
- Probar el recorrido final en un teléfono con WhatsApp y en un equipo con WhatsApp Web.
- Definir tratamiento de datos y recepción de mensajes si se incorpora un backend en una versión comercial.
- Revisar el texto preparado con consultas largas y caracteres especiales antes de usarlo con clientes.
