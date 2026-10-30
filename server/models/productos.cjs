const db = require('./db.cjs');
const {Prisma}=require('./prisma-client.cjs');
const {AppError}=require('../middleware/errors.cjs');
const {discountWhere,effectivePrice,priceLots}=require('./prices.cjs');
const fiscal=require('./fiscal.cjs');
const {trackedStock,serializable}=require('./inventario.cjs');
const {allowsPromotion}=require('../../frontend/models/pharmacy-policy.js');
function validatePvp(product) {
  if(!allowsPromotion(product) && Number(product.descuentoPorcentaje)>0)throw new AppError(422,'PHARMACY_PROMOTION_RESTRICTED','Los productos bajo receta, control especial o biológicos no admiten publicidad ni descuentos promocionales.');
  if(product.tipoProducto==='medicamento' && (!product.pvpMaximo || !product.registroSanitario || !product.laboratorio || !product.presentacion))throw new AppError(422,'MEDICATION_METADATA','El medicamento requiere PVP impreso, registro sanitario, laboratorio y presentación.');
  if(product.pvpMaximo!=null && new Prisma.Decimal(product.precio).gt(product.pvpMaximo))throw new AppError(422,'PRICE_EXCEEDS_PVP','El precio no puede superar el PVP máximo impreso.');
}
module.exports = {
  async list({page,pageSize,q,categoria}) {
    const now=new Date();
    const where={activo:true,...(categoria ? {categoria} : {}),...(q ? {OR:[{nombre:{contains:q}},{descripcion:{contains:q}}]} : {})};
    const [items,total,tax]=await db.$transaction([db.producto.findMany({where,include:{lotes:priceLots(now),promociones:{where:discountWhere(now)}},orderBy:[{createdAt:'asc'},{id:'asc'}],skip:(page-1)*pageSize,take:pageSize}),db.producto.count({where}),db.configuracionFiscal.findFirst({where:{inicioVigencia:{lte:now}},orderBy:{inicioVigencia:'desc'}})]);
    return {items:items.map(product=>effectivePrice(product,product.promociones,now,tax?.tarifaGeneral || 15)),total,page,pageSize};
  },
  async find(id) {const now=new Date();const [product,tax]=await Promise.all([db.producto.findFirst({where:{id,activo:true},include:{lotes:priceLots(now),promociones:{where:discountWhere(now)}}}),fiscal.current(db,now)]);return product?effectivePrice(product,product.promociones,now,tax.tarifaGeneral):null;},
  async create(data,actorId){validatePvp(data);return db.$transaction(async tx=>{const product=await tx.producto.create({data});if(product.stock>0)await tx.movimientoInventario.create({data:{productoId:product.id,actorId,tipo:'entrada',cantidad:product.stock,motivo:'Stock inicial registrado en el catálogo'}});return product;},serializable);},
  async update(id,data,expectedUpdatedAt,actorId) {
    return db.$transaction(async tx=> {
      const current=await tx.producto.findFirst({where:{id,activo:true},include:{lotes:true}});
      if(!current)throw new AppError(404,'NOT_FOUND','El producto no está disponible.');
      if(data.stock<trackedStock(current))throw new AppError(409,'TRACKED_STOCK','El stock no puede bajar de las unidades registradas por lote. Usa un ajuste de inventario.');
      const merged={...current,...data};
      validatePvp(merged);
      if(merged.ivaCategoria==='cero' && (!merged.fundamentoIva || merged.fundamentoIva.trim().length<8))throw new AppError(422,'IVA_JUSTIFICATION','Registra el fundamento legal de la tarifa de IVA 0 %.');
      const updatedAt=new Date(Math.max(Date.now(),current.updatedAt.getTime()+1));
      const updated=await tx.producto.updateMany({where:{id,activo:true,...(expectedUpdatedAt?{updatedAt:new Date(expectedUpdatedAt)}:{updatedAt:current.updatedAt})},data:{...data,updatedAt}});
      if(updated.count!==1)throw new AppError(409,'PRODUCT_CHANGED','El producto cambió mientras lo editabas. Cierra y vuelve a abrir la edición para cargar el stock actual antes de guardar.');
      const delta=data.stock-current.stock;
      if(delta)await tx.movimientoInventario.create({data:{productoId:id,actorId,tipo:delta>0?'entrada':'salida',cantidad:Math.abs(delta),motivo:'Ajuste del saldo sin lote desde la edición del producto'}});
      return tx.producto.findUnique({where:{id}});
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  },
  remove:id=>db.producto.update({where:{id},data:{activo:false}}),
};
