const db = require('./db.cjs');
const {Prisma}=require('./prisma-client.cjs');
const {AppError}=require('../middleware/errors.cjs');
const {discountWhere,effectivePrice,priceLots}=require('./prices.cjs');
const fiscal=require('./fiscal.cjs');
const {trackedStock,serializable}=require('./inventario.cjs');
const {allowsPromotion}=require('../../frontend/models/pharmacy-policy.js');
const search=require('./catalog-search.cjs');
const recommended=[{createdAt:'asc'},{id:'asc'}];
async function publicProducts(ids,now,tax){
  if(!ids.length)return [];
  const products=await db.producto.findMany({where:{activo:true,id:{in:ids}},include:{lotes:priceLots(now),promociones:{where:discountWhere(now)}}});
  const byId=new Map(products.map(product=>[product.id,effectivePrice(product,product.promociones,now,tax.tarifaGeneral)]));
  return ids.map(id=>byId.get(id)).filter(Boolean);
}
function validatePvp(product) {
  if(!allowsPromotion(product) && Number(product.descuentoPorcentaje)>0)throw new AppError(422,'PHARMACY_PROMOTION_RESTRICTED','Los productos bajo receta, control especial o biológicos no admiten publicidad ni descuentos promocionales.');
  if(product.tipoProducto==='medicamento' && (!product.pvpMaximo || !product.registroSanitario || !product.laboratorio || !product.presentacion))throw new AppError(422,'MEDICATION_METADATA','El medicamento requiere PVP impreso, registro sanitario, laboratorio y presentación.');
  if(product.pvpMaximo!=null && new Prisma.Decimal(product.precio).gt(product.pvpMaximo))throw new AppError(422,'PRICE_EXCEEDS_PVP','El precio no puede superar el PVP máximo impreso.');
}
module.exports = {
  async list({page=1,pageSize=50,sort='recommended',...filters}) {
    const now=new Date();
    // Keep the common unfiltered catalog on Prisma's paginated query.
    if(sort==='recommended' && !filters.q && !filters.laboratorio && !filters.presentacion){
      const where={activo:true,...(filters.categoria?{categoria:filters.categoria}:{})};
      const [items,total,tax]=await db.$transaction([db.producto.findMany({where,include:{lotes:priceLots(now),promociones:{where:discountWhere(now)}},orderBy:recommended,skip:(page-1)*pageSize,take:pageSize}),db.producto.count({where}),db.configuracionFiscal.findFirst({where:{inicioVigencia:{lte:now}},orderBy:{inicioVigencia:'desc'}})]);
      return {items:items.map(product=>effectivePrice(product,product.promociones,now,tax?.tarifaGeneral || 15)),total,page,pageSize};
    }
    const where=search.where(filters),tax=await fiscal.current(db,now);
    let ids,total;
    if(sort==='recommended'){
      const [rows,count]=await db.$transaction([db.$queryRaw`SELECT "id" FROM "Producto" WHERE ${where} ORDER BY "createdAt" ASC,"id" ASC LIMIT ${pageSize} OFFSET ${(page-1)*pageSize}`,db.$queryRaw`SELECT count(*) AS total FROM "Producto" WHERE ${where}`]);
      ids=rows.map(row=>row.id);total=Number(count[0].total);
    }else{
      // Only price inputs are materialized for matches; full public DTOs and lots
      // are loaded once for the selected page. Price policy remains centralized.
      const rows=await db.$queryRaw`SELECT "id","precio","stock","activo","descuentoPorcentaje","requiereReceta","controlado","biologico","ivaCategoria" FROM "Producto" WHERE ${where} ORDER BY "createdAt" ASC,"id" ASC`;
      const promotions=rows.length?await db.promocion.findMany({where:discountWhere(now),select:{id:true,productoId:true,activa:true,vistaPrevia:true,descuentoPorcentaje:true,orden:true,inicio:true,fin:true}}):[];
      const campaigns=new Map();
      for(const promotion of promotions){if(!campaigns.has(promotion.productoId))campaigns.set(promotion.productoId,[]);campaigns.get(promotion.productoId).push(promotion);}
      const prices=rows.map((row,index)=>({id:row.id,index,price:Number(effectivePrice(row,campaigns.get(row.id) || [],now,tax.tarifaGeneral).precio)}));
      prices.sort((a,b)=>(sort==='low'?a.price-b.price:b.price-a.price) || a.index-b.index);
      total=prices.length;ids=prices.slice((page-1)*pageSize,page*pageSize).map(row=>row.id);
    }
    return {items:await publicProducts(ids,now,tax),total,page,pageSize};
  },
  async suggestions(filters){
    const now=new Date(),where=search.where(filters),tax=await fiscal.current(db,now);
    let rows=await db.$queryRaw`SELECT "id" FROM "Producto" WHERE ${where} ORDER BY "createdAt" ASC,"id" ASC LIMIT 6`;
    let aproximadas=false;
    const query=search.normalize(filters.q);
    // Never guess dosages, codes, short names or multiword medical queries.
    if(!rows.length && /^[a-z]{5,40}$/.test(query)){
      // Best effort: cap candidate transfer and edit comparisons on this public
      // endpoint. Exact search always covers the complete matching catalog.
      const candidates=await db.$queryRaw`SELECT "id","nombre","principioActivo" FROM "Producto" WHERE ${search.where({...filters,q:undefined})} AND ${search.candidatePrefix(query)} ORDER BY "createdAt" ASC,"id" ASC LIMIT 200`;
      rows=candidates.filter(product=>search.normalize(product.nombre+' '+(product.principioActivo || '')).split(/[^a-z]+/).some(word=>search.nearWord(query,word))).slice(0,6);
      aproximadas=rows.length>0;
    }
    return {items:await publicProducts(rows.map(row=>row.id),now,tax),aproximadas};
  },
  async filters(){
    const [labs,presentations]=await db.$transaction([db.producto.groupBy({by:['laboratorio'],where:{activo:true,laboratorio:{not:null}}}),db.producto.groupBy({by:['presentacion'],where:{activo:true,presentacion:{not:null}}})]);
    const values=(rows,field)=>[...new Set(rows.map(row=>row[field].trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
    return {laboratorios:values(labs,'laboratorio'),presentaciones:values(presentations,'presentacion')};
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
