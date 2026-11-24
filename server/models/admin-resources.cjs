const {Prisma}=require('./prisma-client.cjs');
const inventory=require('./inventario.cjs');
const definitions=Prisma.dmmf.datamodel.models;
const scalarSelect=fields=>Object.fromEntries(fields.map(field=>[field,true]));
const productFields=['id','nombre','precio','stock','categoria','descripcion','advertencias','imagen','alt','activo','soloConsulta','createdAt','updatedAt','descuentoPorcentaje','ivaCategoria','fundamentoIva','tipoProducto','codigoInterno','codigoBarras','laboratorio','principioActivo','concentracion','presentacion','registroSanitario','requiereReceta','controlado','biologico','cadenaFrio','stockMinimo','pvpMaximo'];
const detailFields=['id','pedidoId','productoId','nombreProducto','cantidad','precioUnitario','precioOriginal','descuentoPorcentaje','ivaPorcentaje','baseImponible','ivaMonto','totalLinea'];
const orderFields=['id','userId','nombre','email','telefono','documento','provincia','ciudad','direccion','codigoPostal','total','subtotalProductos','costoEnvioCentavos','envioIvaPorcentaje','envioBaseImponible','envioIvaMonto','zonaEntregaId','baseImponible','ivaMonto','estado','entrega','createdAt','updatedAt'];
const historyFields=['id','pedidoId','anterior','estado','actorId','createdAt'];
function resource(key,label,model,columns,{select,manage,options,format}={}){
 const definition=definitions.find(item=>item.name===model);
 if(!definition)return null;
 return {
  key,label,model,primaryKey:definition.fields.find(field=>field.isId).name,
  columns:columns.map(([key,label])=>({key,label})),readOnly:true,
  actions:manage?[{label:'Gestionar '+label.toLocaleLowerCase('es'),href:manage}]:[],
  select:select||scalarSelect(columns.map(([key])=>key)),options,format,
 };
}
const resources=[
 resource('roles','Roles','Rol',[['id','Código'],['nombre','Nombre']]),
 resource('usuario-rol','Roles de usuarios','UsuarioRol',[['usuarioId','ID del usuario'],['rolId','Código del rol']],{manage:'admin.html?tabla=usuarios'}),
 resource('productos','Productos','Producto',[['id','ID'],['nombre','Nombre'],['categoria','Categoría'],['precio','Precio base'],['stock','Stock registrado'],['soloConsulta','Solo consulta'],['activo','Activo']],{select:scalarSelect(productFields),manage:'admin.html?tabla=productos'}),
 resource('usuarios','Usuarios','Usuario',[['id','ID'],['nombre','Nombre'],['username','Usuario'],['role','Rol'],['activo','Activo'],['emailVerifiedAt','Correo confirmado'],['createdAt','Creación'],['updatedAt','Versión']],{manage:'admin.html?tabla=usuarios'}),
 resource('verificaciones-correo','Verificaciones de correo','EmailVerification',[['usuarioId','Usuario'],['createdAt','Creación'],['expiresAt','Vencimiento']]),
 resource('pedidos','Pedidos','Pedido',[['id','ID'],['userId','Usuario'],['nombre','Destinatario'],['total','Total'],['estado','Estado'],['entrega','Entrega'],['createdAt','Creación'],['updatedAt','Versión']],{format:({pagoPractica,...row})=>({...row,recorrido:require('./recorrido-cliente.cjs').recorridoCliente({...row,pagoPractica})}),select:{...scalarSelect(orderFields),pagoPractica:{select:{createdAt:true,recorridoAutomatico:true}},detalles:{select:{...scalarSelect(detailFields),lotes:{select:scalarSelect(['id','detalleId','loteId','cantidad'])}}},historial:{select:scalarSelect(historyFields),orderBy:[{createdAt:'asc'},{id:'asc'}]}},manage:'admin.html?tabla=pedidos'}),
 resource('detalles','Detalles de pedidos','PedidoDetalle',[['id','ID'],['pedidoId','Pedido'],['productoId','Producto'],['nombreProducto','Nombre al comprar'],['cantidad','Cantidad'],['precioUnitario','Precio al comprar'],['totalLinea','Total']],{select:scalarSelect(detailFields),manage:'admin.html?tabla=detalles'}),
 resource('promociones','Promociones','Promocion',[['id','ID'],['titulo','Título'],['productoId','Producto'],['activa','Activa'],['vistaPrevia','Vista previa'],['descuentoPorcentaje','Descuento %'],['inicio','Inicio'],['fin','Fin']],{select:{...scalarSelect(['id','titulo','descripcion','etiqueta','productoId','activa','vistaPrevia','descuentoPorcentaje','imagen','alt','orden','inicio','fin','createdAt','updatedAt']),producto:{select:scalarSelect(productFields)}},manage:'admin.html?tabla=promociones'}),
 resource('historial-pedidos','Historial de pedidos','PedidoEstado',[['id','ID'],['pedidoId','Pedido'],['anterior','Estado anterior'],['estado','Estado'],['actorId','Actor'],['createdAt','Fecha']],{manage:'admin.html?tabla=pedidos'}),
 resource('semillas','Marcadores de carga','Semilla',[['id','Versión'],['createdAt','Aplicada el']]),
 resource('configuracion-fiscal','Configuración fiscal','ConfiguracionFiscal',[['id','ID'],['tarifaGeneral','Tarifa general %'],['inicioVigencia','Vigencia'],['referenciaNormativa','Referencia'],['actorId','Actor'],['createdAt','Creación']],{manage:'admin.html?tabla=fiscal'}),
 resource('proveedores','Proveedores','Proveedor',[['id','ID'],['nombre','Nombre'],['ruc','RUC'],['activo','Activo'],['createdAt','Creación'],['updatedAt','Versión']],{manage:'admin.html?tabla=proveedores'}),
 resource('lotes','Lotes','Lote',[['id','ID'],['productoId','Producto'],['numero','Número'],['vencimiento','Vencimiento'],['stock','Stock'],['costoUnitario','Costo unitario'],['proveedorId','Proveedor']],{manage:'admin.html?tabla=lotes'}),
 resource('movimientos','Movimientos de inventario','MovimientoInventario',[['id','ID'],['productoId','Producto'],['loteId','Lote'],['tipo','Tipo'],['cantidad','Cantidad'],['motivo','Motivo'],['pedidoId','Pedido'],['actorId','Actor'],['createdAt','Fecha']],{options:()=>({select:{...inventory.movementSelect,actor:{select:{id:true,nombre:true}}}}),format:row=>inventory.movementDto(row),manage:'admin.html?tabla=movimientos'}),
 resource('detalle-lotes','Lotes de detalles','PedidoDetalleLote',[['id','ID'],['detalleId','Detalle'],['loteId','Lote'],['cantidad','Cantidad']],{manage:'admin.html?tabla=pedidos'}),
 resource('configuracion-emisor','Emisor de facturación','ConfiguracionEmisor',[['id','ID'],['ruc','RUC'],['razonSocial','Razón social'],['nombreComercial','Nombre comercial'],['ambiente','Ambiente'],['establecimiento','Establecimiento'],['puntoEmision','Punto de emisión'],['certificadoVenceEn','Vencimiento del certificado'],['updatedAt','Actualización']],{manage:'admin.html?tabla=facturacion'}),
 resource('secuencias-factura','Secuencias de facturas','SecuenciaFactura',[['id','ID'],['emisorRuc','RUC emisor'],['ambiente','Ambiente'],['establecimiento','Establecimiento'],['puntoEmision','Punto de emisión'],['ultimo','Último secuencial']],{manage:'admin.html?tabla=facturacion'}),
 resource('facturas','Facturas','FacturaPedido',[['id','ID'],['pedidoId','Pedido'],['estado','Estado'],['ambiente','Ambiente'],['emisorRuc','RUC emisor'],['establecimiento','Establecimiento'],['puntoEmision','Punto de emisión'],['secuencial','Secuencial'],['fechaEmision','Emisión'],['createdAt','Creación']],{manage:'admin.html?tabla=facturacion'}),
 resource('zonas-entrega','Zonas de entrega','ZonaEntrega',[['id','ID'],['nombre','Nombre'],['alcance','Alcance'],['provincia','Provincia'],['canton','Cantón'],['tarifaCentavos','Tarifa en centavos'],['ivaCategoria','IVA'],['activa','Activa'],['version','Versión']],{manage:'entregas.html'}),
 resource('tarifas-entrega','Historial de tarifas','ZonaEntregaTarifa',[['id','ID'],['zonaEntregaId','Zona'],['version','Versión'],['alcance','Alcance'],['tarifaCentavos','Tarifa en centavos'],['ivaCategoria','IVA'],['actorId','Actor'],['createdAt','Fecha']],{manage:'entregas.html'}),
 resource('entregas','Entregas','Entrega',[['id','ID'],['pedidoId','Pedido'],['repartidorId','Repartidor'],['estado','Estado'],['version','Versión'],['asignadaAt','Asignación'],['salidaAt','Salida'],['llegadaAt','Llegada'],['finalizadaAt','Finalización']],{manage:'entregas.html'}),
 resource('sesiones-moviles','Sesiones móviles','SesionMovil',[['id','ID'],['usuarioId','Usuario'],['createdAt','Creación'],['expiresAt','Vencimiento'],['revokedAt','Revocación']]),
 resource('pagos','Pagos','Pago',[['id','ID'],['pedidoId','Pedido'],['proveedor','Proveedor'],['entorno','Entorno'],['estado','Estado'],['moneda','Moneda'],['totalCentavos','Total en centavos'],['confirmadaAt','Confirmación'],['createdAt','Creación']],{manage:'admin.html?tabla=pedidos'}),
 resource('pagos-practica','Pagos de práctica','PagoPractica',[['id','ID'],['pedidoId','Pedido'],['metodo','Método'],['marca','Marca'],['totalCentavos','Total en centavos'],['createdAt','Creación']],{manage:'admin.html?tabla=pedidos'}),
 resource('sesiones-web','Sesiones web','SesionWeb',[['id','ID'],['usuarioId','Usuario'],['createdAt','Creación'],['expiresAt','Vencimiento'],['revokedAt','Revocación']]),
 resource('recuperaciones-clave','Recuperaciones de contraseña','PasswordReset',[['usuarioId','Usuario'],['createdAt','Creación'],['expiresAt','Vencimiento']]),
 resource('mfa-admin','Segundo factor administrativo','AdminMfa',[['usuarioId','Usuario'],['enabled','Habilitado'],['setupExpiresAt','Vencimiento de configuración'],['failedAttempts','Intentos fallidos'],['blockedUntil','Bloqueado hasta']]),
 resource('auditoria','Auditoría administrativa','AuditoriaAdmin',[['id','ID'],['actorId','Actor'],['accion','Acción'],['status','Estado HTTP'],['createdAt','Fecha']],{manage:'admin.html?tabla=auditoria'}),
 resource('direcciones','Direcciones guardadas','DireccionGuardada',[['id','ID'],['userId','Usuario'],['alias','Alias'],['provincia','Provincia'],['ciudad','Ciudad'],['createdAt','Creación'],['updatedAt','Actualización']]),
 resource('favoritos','Favoritos','Favorito',[['id','ID'],['userId','Usuario'],['productoId','Producto'],['createdAt','Creación']]),
 resource('resenas','Reseñas','ResenaProducto',[['id','ID'],['userId','Usuario'],['productoId','Producto'],['detalleId','Compra verificada'],['puntuacion','Puntuación'],['comentario','Comentario'],['createdAt','Creación'],['updatedAt','Actualización']]),
 resource('incidencias-entrega','Incidencias de entrega','EntregaIncidencia',[['id','ID'],['entregaId','Entrega'],['actorId','Actor'],['tipo','Tipo'],['resueltaAt','Resolución'],['createdAt','Creación'],['updatedAt','Actualización']],{manage:'entregas.html'}),
 resource('registros-pendientes','Continuaciones de registro','RegistroPendiente',[['usuarioId','Usuario'],['createdAt','Creación'],['expiresAt','Vencimiento'],['consumedAt','Consumo']]),
 resource('revision-catalogo','Revisión del catálogo','RevisionCatalogo',[['id','Ámbito']]),
 resource('movimiento-lotes','Lotes de movimientos','MovimientoLote',[['movimientoId','Movimiento'],['loteId','Lote']],{manage:'admin.html?tabla=movimientos'}),
 resource('mfa-recuperaciones','Códigos de recuperación MFA','AdminMfaRecuperacion',[['id','ID'],['usuarioId','Usuario'],['createdAt','Creación'],['usedAt','Uso']]),
].filter(Boolean);
const names=new Map();
for(const item of resources){for(const name of [item.key,item.model,item.model[0].toLowerCase()+item.model.slice(1)])names.set(name,item);}
const find=name=>typeof name==='string'?names.get(name):undefined;
function descriptor(item){const {key,label,model,primaryKey,columns,readOnly,actions}=item;return {key,label,model,primaryKey,columns,readOnly,actions};}
module.exports={find,descriptor,list:()=>resources.map(descriptor)};
