# Normalización y conservación de datos

El núcleo comercial relaciona Usuario, Pedido, PedidoDetalle y Producto mediante claves primarias y foráneas. El correo del usuario es único. La pareja pedido/producto identifica una línea de compra y evita duplicarla. La pareja usuario/clave de solicitud identifica un reintento de la misma confirmación.

Los atributos de Pedido y PedidoDetalle describen la compra registrada. Nombre del producto, precio, descuento, impuestos y dirección son valores históricos. Su dependencia es con la compra y su línea, y una edición posterior del catálogo o del perfil conserva esos valores.

La migración `202611230019_relational_normalization` realiza dos separaciones.

| Relación | Clave y dependencia funcional | Conservación |
| --- | --- | --- |
| MovimientoInventario | id determina producto, actor, pedido, tipo, cantidad, motivo y fecha | Conserva todos los movimientos y sus identificadores. |
| MovimientoLote | movimientoId determina loteId | Representa el vínculo opcional con un lote. El producto del lote se obtiene desde Lote. La base comprueba que coincide con el producto del movimiento. |
| AdminMfa | usuarioId determina configuración y estado del segundo factor | Conserva el secreto cifrado, contador, desafío y bloqueo. |
| AdminMfaRecuperacion | id identifica un código y usuarioId/hash constituye otra clave candidata | Cada hash ocupa una fila. usedAt registra su consumo o revocación. |

La lista JSON de códigos pendientes se transforma en filas antes de retirar el campo anterior. Los vínculos de lote se copian antes de retirar loteId del movimiento base. La API mantiene loteId en sus entradas y respuestas mediante la adaptación del modelo de inventario.

Estas relaciones conservan valores atómicos y grupos repetidos en tablas relacionadas. Sus atributos dependen de la clave completa. El movimiento base evita la dependencia transitiva condicional loteId a productoId que existía en la misma fila. Las copias históricas de una compra se interpretan con su significado temporal.

ResenaProducto tiene como claves candidatas su id, detalleId y la pareja usuario/producto. La base comprueba que el detalle pertenece al usuario y al producto de la reseña. PedidoDetalleLote relaciona una línea y un lote, con cantidad dependiente de esa asignación. La base exige que ambos correspondan al mismo producto. Las modificaciones de los registros referenciados conservan estas condiciones. El lote mantiene su producto mediante la restricción histórica de inventario.

SQLite y PostgreSQL aplican migraciones equivalentes en una transacción. SQLite reconstruye únicamente las dos tablas modificadas y conserva sus CHECK, claves foráneas e índice de movimientos por producto/fecha. PostgreSQL conserva las tablas base y habilita RLS sin políticas públicas en las dos relaciones nuevas. Las claves foráneas de consulta tienen índices asociados a su acceso real.

Una fuente con JSON inválido, hashes incorrectos, duplicados ambiguos o vínculos incoherentes detiene la migración antes de sustituir datos. La aplicación real requiere el respaldo y la coordinación de despliegue. Las pruebas usan bases temporales y verifican la conservación de filas y el rechazo de datos cruzados.

La recuperación MFA consume con una actualización condicional de una fila pendiente dentro de la transacción. Reconfigurar o desactivar marca los códigos anteriores como usados. Restaurar un respaldo conserva MFA activado y revoca desafíos y códigos anteriores. Los respaldos con el formato JSON anterior siguen invalidando sus códigos en la copia restaurada. El traslado entre proveedores excluye códigos y secretos MFA, y rechaza una configuración activa.

La explicación de primera, segunda y tercera forma normal se apoya en estas dependencias funcionales y claves candidatas. Los documentos XML y JSON de factura conservan documentos fiscales históricos completos, con su identidad y finalidad de archivo.

La siguiente matriz comprende los 34 modelos de ambos esquemas después de las migraciones 018 y 019. La primera forma normal se evalúa respecto del dominio de cada atributo. La segunda exige dependencia de la clave candidata completa. La tercera exige que un atributo no clave describa directamente esa identidad y conserve su significado temporal. Una unicidad sobre un campo nullable sólo identifica las filas donde el valor está informado.

| Grupo | Modelo | Claves y unicidades declaradas | Dependencias y evaluación de 1FN, 2FN y 3FN |
| --- | --- | --- | --- |
| Identidad y seguridad | Usuario | PK id, email único, username único cuando está informado | id o email determina perfil y estado de cuenta. Nombre y teléfono actuales pertenecen a la cuenta. Username nullable conserva cuentas anteriores. Valores individuales y dependencia de la identidad completa. |
| Identidad y seguridad | EmailVerification | PK usuarioId, tokenHash único | usuarioId o tokenHash determina el intento vigente, su correo objetivo y vencimiento. El correo es el destinatario de ese intento, que se comprueba al consumirlo. |
| Identidad y seguridad | PasswordReset | PK usuarioId, tokenHash único | La solicitud vigente determina correo objetivo, hash y fechas. El destinatario describe la solicitud y se vuelve a validar al cambiar la clave. |
| Identidad y seguridad | AdminMfa | PK usuarioId | La cuenta determina configuración y estado MFA. El secreto cifrado es un valor criptográfico. Los códigos pendientes están en una relación separada. |
| Identidad y seguridad | AdminMfaRecuperacion | PK id, única usuarioId/hash | La identidad completa del código determina creación y uso. Un hash por fila permite consumo individual sin un grupo repetido JSON. |
| Identidad y seguridad | SesionWeb | PK id | La sesión determina propietario, vencimiento y estado. Los hashes actual y anterior tienen funciones distintas dentro de la rotación y fechas de validez explícitas. |
| Identidad y seguridad | SesionMovil | PK id | La sesión móvil determina propietario, versión, hashes de rotación y vigencia. Cada fila representa una sesión; la cuenta puede tener varias. |
| Identidad y seguridad | RegistroPendiente | PK usuarioId, secretHash único, sessionId único cuando existe | El permiso de continuación determina correo objetivo, versión, vencimiento, consumo y eventual sesión emitida. El correo es el valor ligado a ese alta. |
| Catálogo e inventario | Producto | PK id, codigoInterno único cuando existe | La referencia determina atributos del catálogo y estado comercial actual. Marca, presentación y advertencias son descripciones registradas para esa referencia. |
| Catálogo e inventario | Promocion | PK id | La campaña determina producto objetivo, contenido, porcentaje y vigencia. Imagen y texto de campaña pueden diferir de la ficha del producto. |
| Catálogo e inventario | Proveedor | PK id, ruc único | id o RUC determina los datos de un proveedor. Los lotes lo referencian mediante FK y conservan separados sus datos de contacto. |
| Catálogo e inventario | Lote | PK id, única productoId/numero | El lote completo determina vencimiento, costo, proveedor y saldo. Un número de lote puede repetirse en productos distintos. Su producto es inmutable. |
| Catálogo e inventario | MovimientoInventario | PK id | El movimiento determina producto, actor, pedido, tipo, cantidad, motivo y fecha. El vínculo opcional con un lote está separado para evitar la dependencia transitiva lote a producto. |
| Catálogo e inventario | MovimientoLote | PK movimientoId | movimientoId determina loteId. La fila representa una asociación opcional uno a uno. El producto del lote permanece en Lote y se valida contra el movimiento. |
| Catálogo e inventario | PedidoDetalleLote | PK id, única detalleId/loteId | La pareja completa detalle/lote determina cantidad asignada. No contiene productoId duplicado. La base verifica que detalle y lote comparten producto. |
| Compra | Pedido | PK id, única userId/requestKey | El pedido o la clave completa de reintento determina estado, comprador y valores históricos. Los datos de entrega y facturación representan esta compra. |
| Compra | PedidoDetalle | PK id, única pedidoId/productoId | La línea completa determina cantidad, nombre registrado y precio de aquella compra. productoId por sí solo no determina los precios históricos entre pedidos. |
| Compra | PedidoEstado | PK id | El evento determina pedido, estado anterior/nuevo, actor y fecha. El historial contiene eventos separados y conserva el orden temporal. |
| Compra | Pago | PK id, pedidoId único, paymentId y providerTransactionId únicos cuando existen | id o pedido determina el pago comercial asociado. Importes y referencias pertenecen a la operación registrada. Se conserva un estado de pago por pedido. |
| Compra | PagoPractica | PK id, pedidoId único | La operación de práctica determina método, marca, importe y fecha. Está separada de Pago y del tratamiento de cobros comerciales. |
| Fiscal | ConfiguracionFiscal | PK id, inicioVigencia único | La configuración o su inicio de vigencia determina tarifa y referencia normativa de ese periodo. Repetir una tarifa en otras fechas representa una versión distinta. |
| Fiscal | ConfiguracionEmisor | PK id | El perfil de emisor determina configuración y material cifrado vigente. Los datos conservan el significado de configuración del establecimiento y punto de emisión. |
| Fiscal | SecuenciaFactura | PK id, única emisorRuc/ambiente/establecimiento/puntoEmision | La serie completa determina el último número reservado. Ninguna parte aislada de esa serie identifica el contador. |
| Fiscal | FacturaPedido | PK id, pedidoId único, claveAcceso y serie/secuencial únicos cuando están completos | La factura determina su estado y los documentos fiscales archivados. Snapshot, XML y respuesta del proveedor se conservan como documentos versionados de esa emisión. |
| Reparto | ZonaEntrega | PK id | La zona determina cobertura y tarifa vigentes. Provincia y cantón son componentes de una cobertura configurable, sin una tabla geográfica canónica implícita. |
| Reparto | ZonaEntregaTarifa | PK id, única zonaEntregaId/version | La versión completa determina cobertura y tarifa históricas, actor y fecha. Una edición de la zona actual conserva estas versiones. |
| Reparto | Entrega | PK id, pedidoId único, sesionSeguimientoId único cuando existe | La entrega determina asignación, estado, muestra GPS vigente y estimación con su origen y vencimiento. Los campos GPS tienen roles fijos en una muestra. |
| Reparto | EntregaIncidencia | PK id | La incidencia determina entrega, actor, tipo, descripción, resolución y fechas. Cada evento ocupa una fila. |
| Cliente | DireccionGuardada | PK id | La dirección guardada determina propietario, alias y componentes postales. El usuario puede guardar varias direcciones y los pedidos conservan su propia copia histórica. |
| Cliente | Favorito | PK id, única userId/productoId | La pareja completa identifica la selección y su fecha. No almacena nombre o precio del producto. |
| Cliente | ResenaProducto | PK id, detalleId único, única userId/productoId | Cada clave candidata determina valoración, comentario y fechas. Usuario y producto forman parte de una clave candidata. Los triggers verifican su correspondencia con la compra. |
| Técnica | AuditoriaAdmin | PK id | El evento determina actor, acción, ruta normalizada, resultado y fecha. La acción describe un hecho histórico y excluye cuerpos o credenciales. |
| Técnica | Semilla | PK id | El identificador de incorporación determina su fecha de aplicación. Evita repetir cargas iniciales. |
| Técnica | RevisionCatalogo | PK id | La identidad del catálogo determina la revisión opaca vigente. El marcador permite invalidar lecturas públicas sin almacenar una lista de cambios privados. |

Los snapshots y los documentos se distinguen por su finalidad. Un snapshot comercial fija valores escalares en el momento de una compra. El archivo fiscal conserva además la representación íntegra de un documento externo, incluidos XML, contenido firmado y respuesta. La respuesta se sustituye como unidad al recibir una nueva respuesta del proveedor y se representa en la interfaz. Los códigos MFA tienen identidad y consumo independientes, por lo que se normalizaron como filas relacionadas.

Esta matriz explicita las dependencias utilizadas por el sistema. Las claves, restricciones, transacciones y pruebas comprueban las reglas declaradas y la integridad entre tablas. La clasificación de las formas normales requiere también ese significado de los atributos; la presencia de una PK aislada no acredita por sí sola la normalización.
