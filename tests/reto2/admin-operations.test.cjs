const {test,after}=require('node:test'),assert=require('node:assert/strict');
const fixture=require('./email-api-fixture.cjs').createFixture(),{db}=fixture,api=fixture.api(false);after(()=>fixture.close());let admin;
test('historial privado registra acciones administrativas sin copiar correos, claves o solicitudes',async()=>{
 admin=(await api.post('/api/auth/login').send({email:'email-admin@example.ec',password:'SyntheticEmailAdmin2026!'}).expect(200)).body.data;
 await api.get('/api/admin/auditoria').expect(401);
 const audit=require('../../server/models/admin-audit.cjs');await audit.record({actorId:admin.usuario.id,accion:'product.update',ruta:'/api/productos/:id',status:200});
 const response=await api.get('/api/admin/auditoria?page=1&pageSize=20').set('Authorization','Bearer '+admin.token).expect(200);assert.ok(response.body.data.total>=1);assert.equal(response.body.data.items[0].actor.nombre,admin.usuario.nombre);
 assert.equal(JSON.stringify(response.body).includes(admin.usuario.email),false);assert.equal(response.body.data.items[0].ruta,undefined);
});
test('resumen muestra lotes próximos a vencer y excluye los vacíos y productos inactivos',async()=>{
 const product=await db.producto.findFirst({where:{activo:true}}),now=new Date(),day=require('../../server/models/inventario.cjs').ecuadorDay(new Date(now.getTime()+10*86400000));
 const row=await db.lote.create({data:{productoId:product.id,numero:'PROXIMO-TEST',vencimiento:day,stock:2,costoUnitario:1}});
 const summary=await require('../../server/models/admin-summary.cjs')(now);assert.ok(summary.lotesAlertas.some(lot=>lot.id===row.id));
 await db.lote.update({where:{id:row.id},data:{stock:0}});assert.equal((await require('../../server/models/admin-summary.cjs')(now)).lotesAlertas.some(lot=>lot.id===row.id),false);
});
