'use strict';
const {AppError}=require('../middleware/errors.cjs');
const crypt=require('./sri-crypto.cjs');
const document=require('./sri-document.cjs');
const {createTransport}=require('./sri-transport.cjs');
const {Prisma}=require('./prisma-client.cjs');
const configFields=['ruc','razonSocial','nombreComercial','direccionMatriz','direccionEstablecimiento','establecimiento','puntoEmision','ambiente','obligadoContabilidad','softwarePropio','rucProveedorSoftware'];
const series=cfg=>({emisorRuc:cfg.ruc||cfg.emisorRuc,ambiente:cfg.ambiente,establecimiento:cfg.establecimiento,puntoEmision:cfg.puntoEmision});
const seriesWhere=cfg=>({emisorRuc_ambiente_establecimiento_puntoEmision:series(cfg)});
function publicInvoice(row){
  const data=JSON.parse(row.snapshot);return {id:row.id,pedidoId:row.pedidoId,estado:row.estado,ambiente:row.ambiente,numero:row.secuencial?`${row.establecimiento}-${row.puntoEmision}-${String(row.secuencial).padStart(9,'0')}`:null,claveAcceso:row.claveAcceso,fechaEmision:row.fechaEmision,numeroAutorizacion:row.numeroAutorizacion,fechaAutorizacion:row.fechaAutorizacion,comprador:{razonSocial:data.comprador.razonSocialComprador,identificacion:'••••••'+data.comprador.identificacionComprador.slice(-4)},total:(data.total/100).toFixed(2),baseImponible:(data.base/100).toFixed(2),ivaMonto:(data.iva/100).toFixed(2),createdAt:row.createdAt,updatedAt:row.updatedAt,mensajes:JSON.parse(row.mensajes),ultimoError:row.ultimoError,xmlDisponible:!!row.xmlFirmado,rideDisponible:true,validezTributaria:row.estado==='AUTORIZADA'&&row.ambiente==='2'};
}
function createBilling({db=require('./db.cjs'),secret,transport=createTransport(),now=()=>new Date()}={}) {
  async function configRaw(){return db.configuracionEmisor.findUnique({where:{id:'principal'}});}
  async function serializable(work){for(let attempt=0;attempt<3;attempt++){try{return await db.$transaction(work,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:10000,timeout:15000});}catch(error){if(!['P2034','P2028','P1008','P2002'].includes(error.code)||attempt===2)throw error;}}}
  async function getConfig(){const capacidades={opensslDisponible:crypt.opensslAvailable()};const cfg=await configRaw();if(!cfg)return {configurado:false,ruc:'',razonSocial:'',nombreComercial:'',direccionMatriz:'',direccionEstablecimiento:'',establecimiento:'001',puntoEmision:'001',ambiente:'1',obligadoContabilidad:false,softwarePropio:true,rucProveedorSoftware:null,proximoSecuencial:1,certificado:{presente:false,venceEn:null},capacidades};const counter=await db.secuenciaFactura.findUnique({where:seriesWhere(cfg)});return {configurado:true,...Object.fromEntries(configFields.map(key=>[key,cfg[key]])),proximoSecuencial:(counter?.ultimo||0)+1,certificado:{presente:!!cfg.certificadoCifrado,venceEn:cfg.certificadoVenceEn},capacidades};}
  async function setConfig(input){
    const previous=await configRaw(),initial=input?.secuencialInicial;const values={...input};delete values.secuencialInicial;
    if(initial!==undefined&&(!Number.isInteger(initial)||initial<1||initial>999999999))throw new AppError(422,'VALIDATION_FAILED','Revisa la numeración.',{secuencialInicial:'Usa un entero de 1 a 999999999.'});
    const clean=document.validateConfig(values,previous);
    await db.$transaction(async tx=>{
      if(initial!==undefined){const counter=await tx.secuenciaFactura.findUnique({where:seriesWhere(clean)});if(counter&&initial<=counter.ultimo)throw new AppError(409,'SEQUENCE_ALREADY_USED','No puedes reutilizar números de facturas. Usa un secuencial superior al último emitido.');await tx.secuenciaFactura.upsert({where:seriesWhere(clean),create:{...series(clean),ultimo:initial-1},update:{ultimo:initial-1}});}
      const clear=previous&&previous.ruc!==clean.ruc?{certificadoCifrado:null,certificadoVenceEn:null,certificadoRuc:null}:{};
      await tx.configuracionEmisor.upsert({where:{id:'principal'},create:{id:'principal',...clean},update:{...clean,...clear}});
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});return getConfig();
  }
  async function uploadCertificate(input){
    if(!input||Object.keys(input).some(key=>!['archivoBase64','password'].includes(key)))throw new AppError(422,'INVALID_CERTIFICATE','Carga únicamente el archivo y su contraseña.');
    const cfg=await configRaw();if(!cfg)throw new AppError(409,'EMITTER_REQUIRED','Guarda primero los datos del emisor.');
    const material=crypt.readCertificate(input.archivoBase64,input.password,now());if(material.ruc&&material.ruc!==cfg.ruc)throw new AppError(422,'CERTIFICATE_RUC_MISMATCH','El RUC de la firma no coincide con el emisor configurado.');
    if(typeof secret!=='string'||secret.length<32)throw new AppError(503,'CERTIFICATE_STORAGE_UNAVAILABLE','La configuración privada del servidor no está lista.');
    const updated=await db.configuracionEmisor.updateMany({where:{id:'principal',ruc:cfg.ruc},data:{certificadoCifrado:crypt.encrypt({archivoBase64:input.archivoBase64,password:input.password},secret),certificadoVenceEn:material.venceEn,certificadoRuc:material.ruc}});if(!updated.count)throw new AppError(409,'EMITTER_CHANGED','El emisor cambió mientras cargabas la firma. Revisa sus datos e intenta nuevamente.');return {presente:true,venceEn:material.venceEn};
  }
  async function createInvoice(input){
    const buyer=document.validateBuyer(input);const cfg=await configRaw();if(!cfg)throw new AppError(409,'EMITTER_REQUIRED','Completa los datos del emisor antes de preparar la factura.');
    const replay=prior=>{if(JSON.stringify(JSON.parse(prior.snapshot).comprador)!==JSON.stringify(buyer))throw new AppError(409,'INVOICE_BUYER_CONFLICT','Este pedido ya tiene una factura con otros datos del comprador. Revisa el borrador existente.');return {factura:publicInvoice(prior),replayed:true};};
    const prior=await db.facturaPedido.findUnique({where:{pedidoId:buyer.pedidoId}});if(prior)return replay(prior);
    const order=await db.pedido.findUnique({where:{id:buyer.pedidoId},include:{detalles:true}});if(!order)throw new AppError(404,'ORDER_NOT_FOUND','El pedido no existe.');
    const data=document.snapshot(order,buyer,Object.fromEntries(configFields.map(key=>[key,cfg[key]])));
    try{const row=await db.facturaPedido.create({data:{pedidoId:order.id,...series(cfg),snapshot:JSON.stringify(data),xmlBorrador:document.buildXml(data,null,null,now())}});return {factura:publicInvoice(row),replayed:false};}
    catch(error){if(error.code==='P2002'){const row=await db.facturaPedido.findUnique({where:{pedidoId:buyer.pedidoId}});if(row)return replay(row);}throw error;}
  }
  async function listInvoices({page=1,pageSize=20}={}){if(!Number.isInteger(page)||page<1||page>1000000||!Number.isInteger(pageSize)||pageSize<1||pageSize>100)throw new AppError(422,'VALIDATION_FAILED','Usa una página válida y hasta 100 facturas.');const [items,total]=await db.$transaction([db.facturaPedido.findMany({orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(page-1)*pageSize,take:pageSize}),db.facturaPedido.count()]);return {items:items.map(publicInvoice),total,page,pageSize,limit:pageSize};}
  async function find(id,user){const row=await db.facturaPedido.findUnique({where:{id},include:{pedido:{select:{userId:true,estado:true}}}});if(!row||user&&user.role!=='admin'&&row.pedido.userId!==user.id)throw new AppError(404,'INVOICE_NOT_FOUND','La factura no existe.');return row;}
  async function forOrder(id,user){const order=await db.pedido.findUnique({where:{id},select:{userId:true,factura:true}});if(!order||user.role!=='admin'&&order.userId!==user.id)throw new AppError(404,'ORDER_NOT_FOUND','El pedido no existe.');return order.factura?publicInvoice(order.factura):null;}
  async function emit(id,{confirmarEmisionProduccion=false}={}){
    let row=await find(id);if(row.estado==='AUTORIZADA')return publicInvoice(row);
    if(row.pedido.estado==='cancelado')throw new AppError(409,'ORDER_CANCELLED','No se puede emitir la factura de un pedido cancelado.');
    if(row.ambiente==='2'&&!confirmarEmisionProduccion)throw new AppError(422,'PRODUCTION_CONFIRMATION_REQUIRED','Confirma expresamente que deseas emitir esta factura en PRODUCCIÓN.');
    const config=await configRaw();if(!config?.certificadoCifrado)throw new AppError(409,'CERTIFICATE_REQUIRED','Carga la firma electrónica del emisor desde administración.');
    const privateData=crypt.decrypt(config.certificadoCifrado,secret),material=crypt.readCertificate(privateData.archivoBase64,privateData.password,now());
    if(config.ruc!==row.emisorRuc||material.ruc&&material.ruc!==row.emisorRuc)throw new AppError(409,'CERTIFICATE_RUC_MISMATCH','La firma actual no corresponde al emisor de este borrador.');
    const date=now(),claimed=await db.facturaPedido.updateMany({where:{id,estado:{not:'AUTORIZADA'},OR:[{procesandoHasta:null},{procesandoHasta:{lte:date}}]},data:{procesandoHasta:new Date(date.getTime()+90000),intentos:{increment:1},ultimoError:null}});
    if(!claimed.count)throw new AppError(409,'INVOICE_PROCESSING','Esta factura se está procesando. Consulta su estado en unos segundos.');
    try{
      row=await serializable(async tx=>{
        let current=await tx.facturaPedido.findUnique({where:{id},include:{pedido:{select:{estado:true}}}});if(current.pedido.estado==='cancelado')throw new AppError(409,'ORDER_CANCELLED','El pedido se canceló antes de emitir.');
        if(current.secuencial===null){const snapshot=JSON.parse(current.snapshot),fiscal=await require('./fiscal.cjs').current(tx,date);if(snapshot.lineas.some(line=>line.tarifa>0&&line.tarifa!==fiscal.tarifaGeneral))throw new AppError(409,'NEED_TAX_RECONCILIATION','La tarifa de IVA cambió desde este pedido. Requiere conciliación contable antes de emitir; no se modificarán sus importes históricos.');await tx.secuenciaFactura.upsert({where:seriesWhere(current),create:{...series(current),ultimo:0},update:{}});const counter=await tx.secuenciaFactura.update({where:seriesWhere(current),data:{ultimo:{increment:1}}});if(counter.ultimo>999999999)throw new AppError(409,'SEQUENCE_EXHAUSTED','La serie de facturación agotó su numeración.');const key=document.accessKey({...snapshot.emisor},counter.ultimo,date);current=await tx.facturaPedido.update({where:{id},data:{secuencial:counter.ultimo,claveAcceso:key,fechaEmision:date}});}
        return current;
      });
      if(!row.xmlFirmado){const signed=crypt.signXml(document.buildXml(JSON.parse(row.snapshot),row.claveAcceso,row.secuencial,row.fechaEmision),material,date);row=await db.facturaPedido.update({where:{id},data:{xmlFirmado:signed,estado:'FIRMADA'}});}
      let result;
      if(['RECIBIDA','EN_PROCESO','ERROR','NO_AUTORIZADA','DEVUELTA'].includes(row.estado)){
        result=await transport.authorize(row.ambiente,row.claveAcceso);
        if(result.estado==='AUTORIZADA')return await saveAuthorization(row,result,material);
        if(['RECIBIDA','EN_PROCESO'].includes(row.estado)){await db.facturaPedido.update({where:{id},data:{estado:result.estado,mensajes:JSON.stringify(result.mensajes)}});return publicInvoice(await find(id));}
      }
      const receipt=await transport.receive(row.ambiente,row.xmlFirmado,row.claveAcceso);await db.facturaPedido.update({where:{id},data:{estado:receipt.estado,mensajes:JSON.stringify(receipt.mensajes)}});
      if(receipt.estado==='DEVUELTA'){
        if(receipt.mensajes.some(m=>['43','70'].includes(m.codigo))){result=await transport.authorize(row.ambiente,row.claveAcceso);if(result.estado==='AUTORIZADA')return await saveAuthorization(row,result,material);}
        return publicInvoice(await find(id));
      }
      result=await transport.authorize(row.ambiente,row.claveAcceso);if(result.estado==='AUTORIZADA')return await saveAuthorization(row,result,material);
      await db.facturaPedido.update({where:{id},data:{estado:result.estado,mensajes:JSON.stringify(result.mensajes)}});return publicInvoice(await find(id));
    }catch(error){await db.facturaPedido.updateMany({where:{id,estado:{not:'AUTORIZADA'}},data:{estado:'ERROR',ultimoError:error instanceof AppError?error.code:'INVOICE_ERROR'}});throw error;}
    finally{await db.facturaPedido.updateMany({where:{id},data:{procesandoHasta:null}});}
  }
  async function saveAuthorization(row,result,material){
    if(result.numeroAutorizacion!==row.claveAcceso||document.keyFromXml(result.comprobante)!==row.claveAcceso||!crypt.verifyXml(result.comprobante,crypt.certificateFromXml(row.xmlFirmado)))throw new AppError(502,'SRI_AUTHORIZATION_MISMATCH','La factura autorizada no coincide con la firma enviada.');
    // Both the signature and signed content must match the immutable sent document.
    if(crypt.serialize(crypt.parseXml(result.comprobante).documentElement)!==crypt.serialize(crypt.parseXml(row.xmlFirmado).documentElement))throw new AppError(502,'SRI_AUTHORIZATION_MISMATCH','El SRI devolvió contenido distinto al enviado.');
    const updated=await db.facturaPedido.update({where:{id:row.id},data:{estado:'AUTORIZADA',numeroAutorizacion:result.numeroAutorizacion,fechaAutorizacion:result.fechaAutorizacion,xmlAutorizado:result.comprobante,mensajes:JSON.stringify(result.mensajes),ultimoError:null}});return publicInvoice(updated);
  }
  async function download(id,user){const row=await find(id,user);if(!row.xmlFirmado)throw new AppError(409,'INVOICE_NOT_SIGNED','Este borrador todavía no tiene XML firmado.');if(row.estado!=='AUTORIZADA')return {xml:row.xmlFirmado,filename:`factura-${row.claveAcceso}-${row.estado}.xml`};const safeCdata=value=>value.replace(/\]\]>/g,']]]]><![CDATA[>');return {xml:`<?xml version="1.0" encoding="UTF-8"?><autorizacion><estado>AUTORIZADO</estado><numeroAutorizacion>${row.numeroAutorizacion}</numeroAutorizacion><fechaAutorizacion>${row.fechaAutorizacion.toISOString()}</fechaAutorizacion><ambiente>${row.ambiente==='2'?'PRODUCCION':'PRUEBAS'}</ambiente><comprobante><![CDATA[${safeCdata(row.xmlAutorizado)}]]></comprobante></autorizacion>`,filename:`factura-${row.claveAcceso}.xml`};}
  async function ride(id,user){
    const row=await find(id,user),data=JSON.parse(row.snapshot),e=crypt.escape;
    const valid=row.estado==='AUTORIZADA'&&row.ambiente==='2';
    const lines=data.lineas.map(l=>`<tr><td>${e(l.codigo)}</td><td>${e(l.descripcion)}</td><td>${l.cantidad}</td><td>${e(l.precioUnitarioSinIva)}</td><td>${document.money(l.descuento)}</td><td>${document.money(l.base)}</td><td>${l.tarifa}%</td><td>${document.money(l.total)}</td></tr>`).join('');
    const rates=[...new Set(data.lineas.map(l=>l.tarifa))].map(rate=>`<p>Subtotal IVA ${rate}%: $${document.money(data.lineas.filter(l=>l.tarifa===rate).reduce((sum,l)=>sum+l.base,0))}</p>`).join('');
    const payment={'01':'Sin utilización del sistema financiero (efectivo)','15':'Compensación de deudas','16':'Tarjeta de débito','17':'Dinero electrónico','18':'Tarjeta prepago','19':'Tarjeta de crédito','20':'Otros con utilización del sistema financiero','21':'Endoso de títulos'}[data.comprador.formaPago];
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RIDE ${e(row.claveAcceso||row.id)}</title><style>body{font-family:Arial,sans-serif;line-height:1.5;padding:20px;color:#111}main{width:100%;box-sizing:border-box}h1,h2{line-height:1.2}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%}th,td{border:1px solid #777;padding:6px;text-align:left}p{overflow-wrap:anywhere}@media print{body{padding:0;font-size:11px}tr{break-inside:avoid}.table-wrap{overflow:visible}}</style></head><body><main>
      <h1>${e(data.emisor.nombreComercial)}</h1><p>${e(data.emisor.razonSocial)} · RUC ${e(data.emisor.ruc)}</p>
      <p>Dirección matriz: ${e(data.emisor.direccionMatriz)}</p><p>Dirección establecimiento: ${e(data.emisor.direccionEstablecimiento)}</p>
      <p>Obligado a llevar contabilidad: ${data.emisor.obligadoContabilidad?'SÍ':'NO'}</p><h2>Representación impresa de la factura</h2>
      <p>${valid?'Factura AUTORIZADA en PRODUCCIÓN':`SIN VALIDEZ TRIBUTARIA · ${e(row.estado)} · ${row.ambiente==='1'?'PRUEBAS':'PRODUCCIÓN'}`}</p>
      <p>Ambiente: ${row.ambiente==='1'?'PRUEBAS':'PRODUCCIÓN'} · Tipo de emisión: NORMAL</p>
      <p>Factura: ${e(publicInvoice(row).numero||'BORRADOR')} · Emisión: ${e(row.fechaEmision?document.ecuadorDate(row.fechaEmision).xml:'Pendiente')}</p>
      <p>Cliente: ${e(data.comprador.razonSocialComprador)} · Identificación: ${e(data.comprador.identificacionComprador)}</p><p>Dirección: ${e(data.comprador.direccionComprador)} · Correo: ${e(data.comprador.correoComprador)}</p>
      <div class="table-wrap" role="region" aria-label="Productos de la factura" tabindex="0"><table><caption>Productos e impuestos en USD</caption><thead><tr><th>Código</th><th>Producto</th><th>Cantidad</th><th>Precio unitario sin IVA</th><th>Descuento sin IVA</th><th>Base</th><th>IVA</th><th>Total</th></tr></thead><tbody>${lines}</tbody></table></div>
      ${rates}<p>Total sin impuestos: $${document.money(data.base)} · Descuento sin IVA: $${document.money(data.descuento)} · IVA: $${document.money(data.iva)} · Propina: $0.00 · TOTAL: $${document.money(data.total)}</p>
      <p>Forma de pago: ${e(payment||'Pendiente')} (${e(data.comprador.formaPago||'')}) · Valor: $${document.money(data.total)}</p>
      <p>Clave de acceso: ${e(row.claveAcceso||'Pendiente')}</p><p>Autorización SRI: ${e(row.numeroAutorizacion||'Pendiente')} · Fecha: ${e(row.fechaAutorizacion?.toISOString()||'Pendiente')}</p>
      ${!data.emisor.softwarePropio?`<p>RUC Proveedor: ${e(data.emisor.rucProveedorSoftware)}</p>`:''}<p>Usa la opción Imprimir de tu navegador para guardar esta representación como PDF. Conserva el XML autorizado.</p>
    </main></body></html>`;
  }
  return {getConfig,setConfig,uploadCertificate,createInvoice,listInvoices,forOrder,emit,download,ride};
}
module.exports={createBilling,publicInvoice};
