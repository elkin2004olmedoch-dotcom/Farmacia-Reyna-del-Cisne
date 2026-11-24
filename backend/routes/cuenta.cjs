'use strict';
const {Router}=require('express');
const {authenticate,roles}=require('../middleware/auth.cjs');
const V=require('../middleware/customer-validation.cjs');
const model=require('../models/cuenta.cjs');
module.exports=config=>{
 const router=Router();router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();},authenticate(config),roles('user'));
 router.get('/direcciones',async(req,res)=>res.json({ok:true,data:await model.listAddresses(req.user.id)}));
 router.post('/direcciones',...V.address,async(req,res)=>res.status(201).json({ok:true,data:await model.createAddress(req.user.id,req.input)}));
 router.put('/direcciones/:id',V.id('id'),...V.addressUpdate,async(req,res)=>{const {id,...input}=req.input;res.json({ok:true,data:await model.updateAddress(req.user.id,id,input)});});
 router.delete('/direcciones/:id',V.id('id'),V.validated,async(req,res)=>{await model.removeAddress(req.user.id,req.input.id);res.sendStatus(204);});
 router.get('/favoritos',async(req,res)=>res.json({ok:true,data:await model.favorites(req.user.id)}));
 router.put('/favoritos/:productoId',V.id('productoId'),V.only([]),V.validated,async(req,res)=>res.json({ok:true,data:await model.favorite(req.user.id,req.input.productoId)}));
 router.delete('/favoritos/:productoId',V.id('productoId'),V.validated,async(req,res)=>{await model.removeFavorite(req.user.id,req.input.productoId);res.sendStatus(204);});
 router.get('/pedidos/:id/recompra',V.id('id'),V.validated,async(req,res)=>res.json({ok:true,data:await model.reorder(req.user.id,req.input.id)}));
 return router;
};
