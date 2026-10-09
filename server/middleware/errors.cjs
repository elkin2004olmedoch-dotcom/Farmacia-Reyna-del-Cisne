class AppError extends Error {
  constructor(status, code, message, details) { super(message); Object.assign(this,{status,code,details}); }
}
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.status || 500;
  let code = error.code || 'INTERNAL_ERROR';
  let message = status < 500 ? error.message : 'No pudimos completar la solicitud. Intenta nuevamente.';
  if (error.code==='P2002') { status=409;code='CONFLICT';message='El registro ya existe.'; }
  if (error.code==='P2025') { status=404;code='NOT_FOUND';message='No se encontró el registro.'; }
  if (error.code==='P2003') { status=409;code='RELATION_CONFLICT';message='El registro tiene referencias asociadas.'; }
  if (['P2034','P2028','P1008'].includes(error.code)) { status=409;code='RETRY_ORDER';message='La disponibilidad cambió. Revisa el carrito e intenta nuevamente.'; }
  if (error.type==='entity.parse.failed') { status=400;code='INVALID_JSON';message='El cuerpo JSON no es válido.'; }
  if (error.type==='entity.too.large') { status=413;code='BODY_TOO_LARGE';message='La solicitud supera el tamaño permitido.'; }
  if (status>=500) console.error(JSON.stringify({level:'error',requestId:req.id,code:error.code || 'INTERNAL_ERROR'}));
  res.status(status).json({ok:false,error:{code,message,...(error.details && status<500 ? {details:error.details} : {})},requestId:req.id});
}
module.exports = {AppError,errorHandler};
