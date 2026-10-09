require('../config.cjs')();
const fs=require('node:fs');
const path=require('node:path');
const bcrypt=require('bcrypt');
const db=require('../models/db.cjs');
async function seed() {
  const password=process.env.ADMIN_PASSWORD || '';
  if(password.startsWith('REEMPLAZAR') || password.length<10 || Buffer.byteLength(password)>72 || !/\p{L}/u.test(password) || !/\d/.test(password))throw new Error('Configura ADMIN_PASSWORD con 10 caracteres como mínimo, letra y número (máximo 72 bytes).');
  const email=(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if(!require('../../frontend/models/ecuador.js').validEmail(email))throw new Error('Configura ADMIN_EMAIL con un correo válido.');
  const products=JSON.parse(fs.readFileSync(path.join(__dirname,'../../data/productos.json'),'utf8'));
  for(const product of products)await db.producto.upsert({where:{id:product.id},update:{},create:{id:product.id,nombre:product.name,precio:product.price,stock:20,categoria:product.category,descripcion:product.description,imagen:product.image,alt:product.alt}});
  const existing=await db.usuario.findUnique({where:{email}});
  if(!existing)await db.usuario.create({data:{email,nombre:'Administrador Farmacia',telefono:'+593979275988',role:'admin',passwordHash:await bcrypt.hash(password,12)}});
  else if(existing.role!=='admin')throw new Error('ADMIN_EMAIL corresponde a un usuario normal; no se modifica su rol automáticamente.');
  const promos=JSON.parse(fs.readFileSync(path.join(__dirname,'../../data/promociones.json'),'utf8'));
  for(const promo of promos)await db.promocion.upsert({where:{id:promo.id},update:{},create:{id:promo.id,titulo:promo.title,descripcion:promo.description,etiqueta:promo.label,productoId:promo.productId,activa:promo.active,vistaPrevia:promo.demo,orden:promo.order}});
  console.info('Seed completado: catálogo inicial y administrador. Las ediciones existentes se conservan.');
}
seed().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>db.$disconnect());
