'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const jwt=require('jsonwebtoken');
const {request,db}=require('./fixture.cjs');
let sequence=0;
async function user(role='user'){return db.usuario.create({data:{nombre:'Ana Pérez Privado',email:`resena-${++sequence}@example.ec`,telefono:'+593991234567',passwordHash:'synthetic',role}});}
const headers=u=>({Authorization:'Bearer '+jwt.sign({version:u.tokenVersion},process.env.JWT_SECRET,{subject:u.id,issuer:'farmacia-reina',audience:'farmacia-web',expiresIn:'5m'})});
async function order(user,product,estado='entregado'){return db.pedido.create({data:{userId:user.id,total:5,estado,entrega:'pickup',nombre:user.nombre,email:user.email,telefono:user.telefono,documento:'••1234',requestKey:randomUUID(),fingerprint:randomUUID(),detalles:{create:{productoId:product.id,nombreProducto:product.nombre,cantidad:2,precioUnitario:2.5}}},include:{detalles:true}});}
after(()=>db.$disconnect());
test('reseñas: compra propia entregada, unicidad, privacidad, validación y retirada del autor',async()=>{
 const a=await user(),b=await user(),p=await db.producto.findFirst({where:{activo:true}}),other=await db.producto.findFirst({where:{id:{not:p.id}}});
 const empty=await request.get(`/api/productos/${p.id}/resenas`).expect(200);assert.equal(empty.body.data.total,0);
 const pending=await order(a,p,'pendiente'),done=await order(a,p),alien=await order(b,p);
 const post=body=>request.post('/api/cuenta/resenas').set(headers(a)).send(body),values={productoId:p.id,detalleId:done.detalles[0].id,puntuacion:5,comentario:'Buena atención.'};
 await request.get(`/api/productos/${p.id}/resenas/mi-compra`).expect(401);
 for(const role of ['admin','repartidor'])await request.post('/api/cuenta/resenas').set(headers(await user(role))).send(values).expect(403);
 for(const patch of [{detalleId:pending.detalles[0].id},{detalleId:alien.detalles[0].id},{productoId:other.id}])await post({...values,...patch}).expect(403);
 for(const patch of [{puntuacion:0},{puntuacion:6},{puntuacion:'5'},{comentario:'x'.repeat(801)},{comentario:'<img src=x onerror=alert(1)>'},{userId:b.id}])await post({...values,...patch}).expect(422);
 const saved=(await post(values).expect(201)).body.data;
 await post(values).expect(409);
 const eligibility=(await request.get(`/api/productos/${p.id}/resenas/mi-compra`).set(headers(a)).expect(200)).body.data;assert.equal(eligibility.resena.id,saved.id);assert.equal(eligibility.detalleId,done.detalles[0].id);
 const result=await request.get(`/api/productos/${p.id}/resenas?page=1&pageSize=1`).expect(200),data=result.body.data;
 assert.equal(data.promedio,5);assert.equal(data.total,1);assert.equal(data.items[0].compraVerificada,true);assert.equal(data.items[0].autor,'Ana P.');
 const publicText=JSON.stringify(result.body);for(const secret of [a.email,a.telefono,a.id,done.id,done.detalles[0].id,'Privado'])assert.ok(!publicText.includes(secret));
 await request.put('/api/cuenta/resenas/'+saved.id).set(headers(b)).send({puntuacion:1,comentario:'Ajeno'}).expect(404);
 await request.put('/api/cuenta/resenas/'+saved.id).set(headers(a)).send({puntuacion:4,comentario:'Actualizada',detalleId:alien.detalles[0].id}).expect(422);
 await request.put('/api/cuenta/resenas/'+saved.id).set(headers(a)).send({puntuacion:4,comentario:'Actualizada'}).expect(200);
 await db.pedido.update({where:{id:done.id},data:{estado:'pendiente'}});
 await request.put('/api/cuenta/resenas/'+saved.id).set(headers(a)).send({puntuacion:1,comentario:'No entregado'}).expect(403);
 assert.equal((await request.get(`/api/productos/${p.id}/resenas`).expect(200)).body.data.total,0);
 await db.pedido.update({where:{id:done.id},data:{estado:'entregado'}});
 await request.delete('/api/cuenta/resenas/'+saved.id).set(headers(b)).expect(404);
 await request.delete('/api/cuenta/resenas/'+saved.id).set(headers(a)).expect(204);
 assert.equal((await request.get(`/api/productos/${p.id}/resenas`).expect(200)).body.data.total,0);
});
test('recompra: propiedad, precios actuales, stock y restricciones; no escribe pedidos',async()=>{
 const a=await user(),b=await user(),products=await db.producto.findMany({where:{activo:true},take:4});
 const purchase=await order(a,products[0]);
 for(let i=1;i<4;i++)await db.pedidoDetalle.create({data:{pedidoId:purchase.id,productoId:products[i].id,nombreProducto:products[i].nombre,cantidad:2,precioUnitario:2.5}});
 await db.producto.update({where:{id:products[0].id},data:{precio:9,descuentoPorcentaje:0,stock:1}});
 await db.producto.update({where:{id:products[1].id},data:{activo:false}});
 await db.producto.update({where:{id:products[2].id},data:{requiereReceta:true}});
 await db.producto.update({where:{id:products[3].id},data:{cadenaFrio:true}});
 const count=await db.pedido.count();
 await request.get(`/api/cuenta/pedidos/${purchase.id}/recompra`).set(headers(b)).expect(404);
 const proposal=(await request.get(`/api/cuenta/pedidos/${purchase.id}/recompra`).set(headers(a)).expect(200)).body.data;
 assert.equal(proposal.items.length,4);
 const line=id=>proposal.items.find(item=>item.productoId===id);
 assert.equal(line(products[0].id).cantidadPermitida,1);assert.ok(line(products[0].id).incidencias.includes('PRECIO_CAMBIO'));assert.ok(line(products[0].id).incidencias.includes('STOCK_INSUFICIENTE'));
 assert.equal(line(products[1].id).cantidadPermitida,0);assert.ok(line(products[1].id).incidencias.includes('RETIRADO'));
 for(let i=2;i<4;i++){assert.equal(line(products[i].id).cantidadPermitida,0);assert.ok(line(products[i].id).incidencias.includes('RESTRINGIDO'));}
 assert.equal(await db.pedido.count(),count);
});
