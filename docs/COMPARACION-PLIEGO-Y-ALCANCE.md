# Comparación con PLIEGO y alcance de la farmacia

Se revisaron los 75 mensajes de [Evaluación IHC Faltante](https://chatgpt.com/share/6aea9529-97ec-83e8-a3a0-2b4c1ab9f3f0). Es una conversación sobre otro negocio, no un enunciado del docente ni una comprobación independiente de su producción. Sus resultados de pruebas pertenecen a PLIEGO. Aquí se contrastan capacidades con el código de la farmacia y con [el enunciado del Reto 2](REQUISITOS-RETO-2.txt). La presentación integra Retos 1 y 2; Reto 3 espera el framework asignado.

El titular aclaró que desea mejorar la farmacia y adaptar el Reto 3 después. Por eso se conserva el negocio completo, simplificando controles y textos en lugar de eliminar datos, seguridad o funcionalidades útiles. Se mantienen HTML/CSS/JavaScript, Express, Prisma 6, colores, logos y Goti. No se incorporan Java, Spring Boot, Maven, Python, Vue ni un VPS porque los use otro proyecto.

## Capacidades contrastadas

| Petición agrupada del otro chat | Farmacia antes del ajuste | Decisión para esta farmacia |
|---|---|---|
| Logo que siempre lleva al inicio, navegación reconocible | Logo sin flecha y cabecera compartida; regreso independiente en ficha | Mantener; enfocar la cabecera durante la compra |
| Precio, descuento, foto y cantidades visibles | Catálogo/ficha/carrito con foto, presentación, stock y descuento calculado desde promociones en BD | Mantener los mismos cálculos y componentes |
| Compra accesible al desplazarse | Acceso inferior al carrito en catálogo/ficha y resumen durante compra | Conservar; no superponer otra barra ni tapar foco/Goti |
| Búsqueda con y sin tildes y coincidencias parciales | Búsqueda normalizada y sugerencias con imágenes/precios, filtros y teclado | Mantener, con pruebas de API y navegador |
| Cantidad por producto | De 1 a 99, limitada por stock y reglas farmacéuticas | No copiar el máximo10 o una copia digital: los productos físicos requieren reglas propias |
| Favoritos persistentes y añadir al carrito | Persistencia por usuario, fotos, comprobación de stock y apertura del carrito lateral | Mantener; evitar otra acción duplicada de Ver carrito en cada botón |
| Guardar para después separado de favoritos | No existe un segundo listado independiente | No añadir otro estado por imitación; favoritos y carrito persistente ya permiten retomar y no lo exige la rúbrica |
| Basurero, confirmación y recuperación | Checkout confirma; el lateral retiraba una línea inmediatamente | Unificar confirmación y añadir recuperación de la línea retirada |
| Vaciar carrito | Disponible con confirmación en checkout | Hacerlo accesible también en el lateral |
| Confirmar correo e iniciar sesión | El enlace confirma e inicia la sesión con cookies revocables | Conservar el paso explícito para que un escáner de correo no consuma el enlace |
| Pestaña del registro se actualiza al verificar en otra | Faltaba el aviso entre pestañas | Comprobar la sesión autenticada del mismo navegador, sin contraseñas nuevas ni tokens en storage |
| Cambios entre dispositivos sin F5 | Pedidos consultan la API cada 5 segundos mientras son visibles y al recuperar foco; entregas tienen su actualización | Conservar polling acotado; no añadir SSE/WebSocket que repita lo existente ni prometer sesión en otro dispositivo por conocer un correo |
| Aviso de nueva versión sin recarga forzada | Instalación/service worker existentes; la aplicación no fuerza recargar formularios | No copiar el sistema de releases de un VPS; conservar formularios y verificación de despliegue propia |
| Perfil, direcciones y favoritos coherentes | Perfil mínimo de nombre/teléfono, direcciones privadas y favoritos/recompra | Mantener identidad visual y autorizaciones de propietario |
| Solicitud administrativa para cambiar cédula | Usuario no guarda cédula; pedido conserva documento validado y enmascarado | No inventar una cédula editable ni ese subsistema. Actualizar perfil no modifica documentos históricos |
| Formularios fiscales y direcciones menos intrusivos | Compra reutiliza direcciones guardadas, con datos necesarios para entregar | Evitar controles fiscales técnicos en la compra; no pedir datos duplicados sólo por copiar otra tienda |
| Un único acceso al documento del pedido | Se mostraban Ver comprobante y Consultar factura SRI | Conservar Ver comprobante, impresión y envío por correo; gestión SRI técnica en administración |
| Factura con validez y formato fiscal | Comprobante imprimible y backend SRI separado, sujeto a configuración y autorización | No llamar factura SRI a un recibo ni copiar datos, identificaciones o documentos de otro negocio |
| Imagen del producto en correo/comprobante | Plantillas del negocio y referencias del pedido; correo al destinatario verificado | Mantener; recibir un correo exige proveedor/remitente y no se prueba enviando a terceros |
| Cancelación explicada antes de pedir y accesible en el pedido | Administración puede cancelar; cliente no disponía de acción propia | Añadir antes de preparación, con confirmación, versión y reposición transaccional única; cobros/facturas reales mantienen conciliación |
| Referencia de pedido no secuencial | UUID interno y referencia abreviada; sin contador público de ventas | Mantener, sin copiar el prefijo comercial de PLIEGO |
| Retiro listo en diez minutos y avance automático | El personal confirma preparación y entrega | No fingir preparación por temporizador ni prometer un plazo que no valida la operación real |
| Código de retiro/entrega | Nuevos repartos usan código privado con límite de intentos y limpieza de GPS | Mantener esa protección; un código de retiro independiente no es obligatorio en los Retos 1 y 2 |
| Mapa dentro de la página y carga clara | Mapa/ruta voluntarios integrados, estados de carga y restricción de ubicación vigente | Mantener, sin mezclar centro de ciudad con destino preciso ni simular GPS físico |
| Provincia accesible con teclado | Selector nativo de provincias, etiquetas y validación ecuatoriana | Mantener selección nativa; no crear un combobox complejo sin necesidad |
| Campañas variadas y vigentes | Administración programa/publica promociones con producto, descuento, inicio y fin | Mantener; no fabricar promociones comerciales ni cambiar precios de producción para mostrar actividad |
| Límite de intentos de registro | Register ya comparte limitador de autenticación, además de límites de login/verificación/recuperación | Conservar y probar; no añadir otro limitador idéntico |
| Índices de claves foráneas | Índices propios de SQLite/PostgreSQL según relaciones y consultas; revisados en ampliaciones | Los «12 faltantes» pertenecen a otra BD: no copiar el número ni crear índices sin consulta real |
| Información de ayuda breve y decisiones claras | Ayuda propia de compra, pagos, privacidad y entrega | Simplificar jerarquía y opciones avanzadas; conservar restricciones, avisos de pagos y datos verificables |
| eBooks, audiolibros, biblioteca, revocación digital y una copia por cuenta | No forman parte de una farmacia | No incorporar esos módulos ni sus restricciones |

## Qué exige la entrega académica

Se conserva lo esencial del Reto 2: MVC cliente/servidor, Fetch, catálogo y CRUD de productos, carrito persistente, login para comprar, pedido/detalles guardados, consultas administrativas, JWT, roles, bcrypt, CORS restrictivo, validación, errores consistentes, accesibilidad y documentación. PostgreSQL está dentro de la alternativa de motor relacional del título/rúbrica; se documenta la frase ambigua de SQL Server en la [revisión existente](REVISION-RETO-2-2026-11-03.md).

Mapas, reparto nativo, favoritos, promociones, reseñas, asistentes, correo y SRI son ampliaciones del negocio, no mínimos que deban confundirse con puntos obligatorios. Los controles avanzados se organizan para no dominar la presentación. Se mantienen auditorías y pruebas, así como migraciones y datos previos. El proyecto no elimina información comercial para parecer más pequeño.

## Límites que se mantienen visibles cuando corresponden

PayPhone comercial sigue pendiente de activación. El modo de práctica conserva el aviso Sin cobro real y nunca recibe PAN/CVV en la API. Un comprobante no autorizado por SRI no se presenta como factura tributaria. Render continúa Free y no se garantiza GPS de un teléfono apagado; iPhone requiere firma y pruebas físicas. Ninguna mejora visual elimina estos controles.

Las evidencias de esta revisión se guardan fuera de Git, en `.publish/reports/2026-11-04-pulido-pliego/`. El contenido completo del chat de referencia permanece privado; no se incorporan sus correos, identificaciones, permisos ni archivos adjuntos al repositorio.
