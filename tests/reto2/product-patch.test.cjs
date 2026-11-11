const {test,after}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {db,request}=require('./fixture.cjs'),jwt=require('jsonwebtoken');
const header=user=>({Authorization:'Bearer '+jwt.sign({version:user.tokenVersion},process.env.JWT_SECRET,{subject:user.id,issuer:'farmacia-reina',audience:'farmacia-web',expiresIn:'5m'})});
after(()=>db.$disconnect());
test('PATCH de productos exige rol, versión y campos permitidos y conserva inventario omitido',async()=>{
 const admin=await db.usuario.findFirst({where:{role:'admin'}}),user=await db.usuario.create({data:{nombre:'Cliente API',email:randomUUID()+'@example.ec',telefono:'+593991234567',passwordHash:'synthetic'}});
 const product=await db.producto.findFirst({where:{activo:true,tipoProducto:'cuidado'}}),url='/api/productos/'+product.id;
 await request.patch(url).send({nombre:'Sin permiso'}).expect(401);
 await request.patch(url).set(header(user)).send({nombre:'Sin permiso'}).expect(403);
 await request.patch(url).set(header(admin)).send({nombre:'Sin versión'}).expect(422);
 await request.patch(url).set(header(admin)).send({esperadoUpdatedAt:product.updatedAt.toISOString()}).expect(422);
 for(const patch of [{activo:false},{stock:-1},{precio:'10'},{advertencias:'a'.repeat(1001)},{id:'otro'}])await request.patch(url).set(header(admin)).send({...patch,esperadoUpdatedAt:product.updatedAt.toISOString()}).expect(422);
 const movements=await db.movimientoInventario.count({where:{productoId:product.id}});
 const updated=(await request.patch(url).set(header(admin)).send({nombre:'Producto actualizado',advertencias:'<b>Conservar</b> fuera del alcance de los niños.',esperadoUpdatedAt:product.updatedAt.toISOString()}).expect(200)).body.data;
 assert.equal(updated.nombre,'Producto actualizado');assert.equal(updated.stock,product.stock);assert.equal(Number(updated.precio),Number(product.precio));assert.equal(updated.advertencias,'Conservar fuera del alcance de los niños.');
 assert.equal(await db.movimientoInventario.count({where:{productoId:product.id}}),movements);
 await request.patch(url).set(header(admin)).send({nombre:'Versión antigua',esperadoUpdatedAt:product.updatedAt.toISOString()}).expect(409);
 assert.equal((await request.get(url).expect(200)).body.data.advertencias,updated.advertencias);
 await request.patch(url).set(header(admin)).send({advertencias:null,esperadoUpdatedAt:updated.updatedAt}).expect(200);
});
test('PATCH valida el producto farmacéutico combinado y genera un solo movimiento por cambio de stock',async()=>{
 const admin=await db.usuario.findFirst({where:{role:'admin'}}),product=await db.producto.findFirst({where:{activo:true,tipoProducto:'cuidado'}}),url='/api/productos/'+product.id;
 await request.patch(url).set(header(admin)).send({tipoProducto:'medicamento',esperadoUpdatedAt:product.updatedAt.toISOString()}).expect(422);
 const before=await db.movimientoInventario.count({where:{productoId:product.id}});
 const body={stock:product.stock+1,esperadoUpdatedAt:product.updatedAt.toISOString()};
 const outcomes=await Promise.all([request.patch(url).set(header(admin)).send(body),request.patch(url).set(header(admin)).send(body)]);
 assert.deepEqual(outcomes.map(r=>r.status).sort(),[200,409]);assert.equal(await db.movimientoInventario.count({where:{productoId:product.id}}),before+1);
});
test('la BD conserva datos históricos, limita advertencias y cambia la revisión con escrituras públicas',async()=>{
 const product=await db.producto.findFirst(),before=await db.revisionCatalogo.findUnique({where:{id:'catalogo'}});
 assert.ok(before?.token);assert.equal(product.advertencias,null);
 await db.producto.update({where:{id:product.id},data:{advertencias:'Seguir las instrucciones del envase.'}});
 const next=await db.revisionCatalogo.findUnique({where:{id:'catalogo'}});assert.notEqual(next.token,before.token);
 await assert.rejects(db.$executeRaw`UPDATE "Producto" SET "advertencias"=${'x'.repeat(1001)} WHERE "id"=${product.id}`);
 const count=await db.producto.count();assert.ok(count>=18);
});
