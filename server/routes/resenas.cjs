'use strict';
const {Router}=require('express');
const {authenticate,roles}=require('../middleware/auth.cjs');
const V=require('../middleware/customer-validation.cjs');
const model=require('../models/resenas.cjs');
module.exports=config=>{
 const router=Router(),auth=authenticate(config),buyer=roles('user');
 const privateCache=(req,res,next)=>{res.set('Cache-Control','no-store');next();};
 router.get('/productos/:id/resenas',V.id('id'),...V.pagination,async(req,res)=>{const {id,...paging}=req.input;res.json({ok:true,data:await model.list(id,paging)});});
 router.get('/productos/:id/resenas/mi-compra',privateCache,auth,buyer,V.id('id'),V.validated,async(req,res)=>res.json({ok:true,data:await model.eligibility(req.user.id,req.input.id)}));
 router.post('/cuenta/resenas',privateCache,auth,buyer,...V.review,async(req,res)=>res.status(201).json({ok:true,data:await model.create(req.user.id,req.input)}));
 router.put('/cuenta/resenas/:id',privateCache,auth,buyer,V.id('id'),...V.reviewUpdate,async(req,res)=>{const {id,...values}=req.input;res.json({ok:true,data:await model.update(req.user.id,id,values)});});
 router.delete('/cuenta/resenas/:id',privateCache,auth,buyer,V.id('id'),V.validated,async(req,res)=>{await model.remove(req.user.id,req.input.id);res.sendStatus(204);});
 return router;
};
