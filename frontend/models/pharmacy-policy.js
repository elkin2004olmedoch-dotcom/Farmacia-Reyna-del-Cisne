(function(global){
  'use strict';
  // Classifications come from the pharmacy's verified catalog, never from a product name.
  function requiresProfessionalReview(product){return !product || Boolean(product.requiereReceta || product.controlado || product.biologico || product.cadenaFrio);}
  function allowsPromotion(product){return Boolean(product) && !product.requiereReceta && !product.controlado && !product.biologico;}
  function restrictionReason(product){
    if(!product)return 'No se pudo verificar este producto. Consulta con la farmacia.';
    if(product.controlado)return 'Producto sujeto a control especial. Requiere revisión y dispensación profesional; no admite compra automática.';
    if(product.biologico)return 'Producto biológico. Coordina su dispensación y conservación con el farmacéutico; no admite compra automática.';
    if(product.cadenaFrio)return 'Requiere cadena de frío. La farmacia debe verificar las condiciones de temperatura y transporte antes de dispensarlo.';
    if(product.requiereReceta)return 'Requiere receta y revisión del farmacéutico. Coordina su dispensación con la farmacia.';
    return '';
  }
  const api={requiresProfessionalReview,allowsPromotion,restrictionReason};
  (global.Farmacia ||= {}).pharmacyPolicy=api;
  if(typeof module!=='undefined' && module.exports)module.exports=api;
})(globalThis);
