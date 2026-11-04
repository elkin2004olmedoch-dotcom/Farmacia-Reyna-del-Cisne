import {escape,price,priceMarkup,promotionRibbon,taxMarkup,productMetadata} from './common.js';
import {productImageUrl} from '../config.js';
import '../models/pharmacy-policy.js';
const {requiresProfessionalReview,restrictionReason,allowsPromotion}=globalThis.Farmacia.pharmacyPolicy;
const prescriptionNote=product=>`<p class="prescription-note">${escape(restrictionReason(product))} <a href="index.html#contacto">Coordinar con la farmacia</a>.</p>`;
const categoryLabel=category=>({bienestar:'Bienestar',cuidado:'Cuidado personal',bebe:'Mamá y bebé'}[category] || 'Productos');
export function productCard(product) {
  const id=escape(product.id),url='producto.html?id='+encodeURIComponent(product.id),review=requiresProfessionalReview(product);
  return `<article class="featured-card pharmacy-product-card" aria-labelledby="name-${id}">
    <a class="featured-image" href="${url}"><img data-product-image src="${escape(productImageUrl(product.imagen))}" alt="${escape(product.alt || product.nombre)}" width="320" height="320" loading="lazy">${product.stock===0?'<span class="product-sold-out">Agotado</span>':''}${promotionRibbon(product.descuentoPorcentaje)}</a>
    <div class="product-card-copy"><small>${escape(categoryLabel(product.categoria))}</small><h3 id="name-${id}"><a href="${url}">${escape(product.nombre)}</a></h3>
      ${productMetadata(product,'product-card-meta')}
      ${product.descripcion?`<p class="product-card-description">${escape(product.descripcion)}</p>`:''}
      ${review?prescriptionNote(product):''}
      <div class="product-card-purchase"><div class="featured-bottom">${priceMarkup(product)}</div>${taxMarkup(product)}<p class="product-stock${product.stock===0?' is-unavailable':''}">${product.stock} unidades disponibles</p>
        <div class="product-card-actions"><a class="button button-outline" href="${url}" aria-label="Ver detalles de ${escape(product.nombre)}">Ver detalles</a>${review?'<a class="text-link" href="index.html#contacto">Consultar dispensación →</a>':`<button type="button" class="button button-primary" data-customer-only data-add="${id}" ${product.stock===0?'disabled':''} aria-label="Agregar ${escape(product.nombre)} al carrito">Añadir</button>`}</div>
        <label class="catalog-compare"><input type="checkbox" data-compare="${id}"> Comparar<span class="sr-only"> ${escape(product.nombre)}</span></label>
      </div>
    </div>
  </article>`;
}
export function catalogView(products,target) {
  target.innerHTML=products.length?products.map(productCard).join(''):'<div class="shop-empty catalog-empty"><h2>No encontramos productos con esos filtros.</h2><p>Prueba otra palabra, revisa la categoría o restablece los filtros.</p><a class="button button-outline" href="catalogo.html">Ver todo el catálogo</a></div>';
}
export function productView(product) {
  const review=requiresProfessionalReview(product);
  const fields=[['Laboratorio o marca','laboratorio'],['Principio activo','principioActivo'],['Concentración','concentracion'],['Presentación','presentacion'],['Registro sanitario','registroSanitario']].filter(([,key])=>product[key]);
  const ficha=fields.length?`<section class="pharmaceutical-sheet" aria-labelledby="pharmaceutical-title"><h2 id="pharmaceutical-title">Información del producto</h2><dl>${fields.map(([label,key])=>`<div><dt>${label}</dt><dd>${escape(product[key])}</dd></div>`).join('')}</dl></section>`:'';
  document.getElementById('product-detail').innerHTML=`<section class="product-detail-grid" aria-labelledby="product-title">
    <div class="product-detail-media"><button type="button" id="zoom-product" class="product-main-image" aria-label="Ampliar imagen de ${escape(product.nombre)}"><img data-product-image src="${escape(productImageUrl(product.imagen))}" alt="${escape(product.alt || product.nombre)}" width="600" height="600" fetchpriority="high"><span>Ampliar imagen ↗</span></button><a class="text-link product-back-link" href="catalogo.html">← Seguir explorando el catálogo</a></div>
    <div class="product-detail-copy"><p class="eyebrow">${escape(categoryLabel(product.categoria))}</p><h1 id="product-title">${escape(product.nombre)}</h1>${product.presentacion?`<p class="product-presentation">${escape(product.presentacion)}</p>`:''}
      <div class="product-purchase-panel">${promotionRibbon(product.descuentoPorcentaje)}<div class="detail-price">${priceMarkup(product)}<p id="product-availability" class="product-stock${product.stock===0?' is-unavailable':''}">${product.stock} unidades disponibles</p></div>${taxMarkup(product)}${product.pvpMaximo!=null?`<p class="product-pvp">PVP máximo impreso: ${price({precio:product.pvpMaximo})}</p>`:''}
        ${review?prescriptionNote(product):''}
        <form id="detail-add-form" data-customer-only><label for="detail-quantity">Cantidad</label><div class="product-buy-controls"><div class="quantity-picker"><button type="button" data-quantity="-1" aria-label="Reducir cantidad">−</button><input id="detail-quantity" name="cantidad" type="number" inputmode="numeric" autocomplete="off" aria-describedby="product-availability" min="1" max="${Math.max(1,Math.min(product.stock,99))}" value="1" required><button type="button" data-quantity="1" aria-label="Aumentar cantidad">+</button></div><button id="detail-add-button" class="button button-primary" type="submit" ${product.stock===0 || review?'disabled':''}>${review?'Coordina la atención farmacéutica':product.stock?'Añadir al carrito →':'Producto agotado'}</button></div></form>
        <dl class="product-fulfillment"><div><dt>Retiro en farmacia</dt><dd>Selecciona retiro al preparar tu pedido.</dd></div><div><dt>Envío</dt><dd>Tarifa al confirmar la dirección.</dd></div></dl>
      </div>
      <a class="text-link product-compare-link" href="comparar.html">Comparar productos →</a>
    </div>
  </section><div class="product-information">${product.descripcion?`<section class="product-description" aria-labelledby="product-description-title"><h2 id="product-description-title">Descripción</h2><p class="shop-lead">${escape(product.descripcion)}</p></section>`:''}${ficha}</div>`;
}
export function promotionView(items) {
  items=items.filter(item=>allowsPromotion(item.producto));
  document.getElementById('promotions-note').textContent=items.some(item=>item.vistaPrevia)?'Las campañas marcadas como vista previa no aplican descuentos. Las promociones publicadas y vigentes se reflejan en el producto, carrito y pedido. Los descuentos no se suman.':'El mayor descuento vigente, directo o de campaña, se aplica al producto, carrito y pedido. Los descuentos no se suman. Consulta disponibilidad con la farmacia.';
  document.getElementById('promotions-list').innerHTML=items.length?items.map(item=>`<article class="promotion-card">${promotionRibbon(item.descuentoPorcentaje,item.vistaPrevia)}<img data-product-image src="${escape(productImageUrl(item.imagen || item.producto.imagen))}" alt="${escape(item.alt || item.producto.alt || item.producto.nombre)}" width="320" height="250" loading="lazy"><div class="promotion-copy"><span class="promotion-label">${escape(item.etiqueta)}${item.vistaPrevia?' · vista previa':''}</span><h3>${escape(item.titulo)}</h3><p>${escape(item.descripcion)}</p><a class="text-link" href="producto.html?id=${encodeURIComponent(item.productoId)}">Explorar producto →</a></div></article>`).join(''):'<p class="promotions-empty">Estamos preparando nuevas promociones. Vuelve pronto o consulta por WhatsApp.</p>';
}
export function comparisonView(products,selected) {
  document.getElementById('compare-picks').innerHTML=products.map(product=>`<label class="compare-pick"><input type="checkbox" data-pick="${escape(product.id)}" ${selected.includes(product.id)?'checked':''}><span>${escape(product.nombre)}</span></label>`).join('');
  const chosen=products.filter(product=>selected.includes(product.id));
  document.getElementById('comparison').innerHTML=chosen.length?`<table class="comparison-table"><caption>Comparación de productos seleccionados</caption><thead><tr><th scope="col">Característica</th>${chosen.map(p=>`<th scope="col">${escape(p.nombre)}</th>`).join('')}</tr></thead><tbody>${[['Precio final',p=>price(p)],['IVA',p=>Number.isFinite(p.ivaPorcentaje)?escape(p.ivaPorcentaje)+' %':'Sin información'],['Receta',p=>p.requiereReceta?'Requiere revisión en farmacia':'Sin receta'],['Categoría',p=>escape(p.categoria)],['Descripción',p=>escape(p.descripcion)],['Disponibilidad',p=>p.stock+' unidades']].map(([label,read])=>`<tr><th scope="row">${label}</th>${chosen.map(p=>`<td>${read(p)}</td>`).join('')}</tr>`).join('')}<tr><th scope="row">Elegir</th>${chosen.map(p=>`<td><a class="text-link" href="producto.html?id=${encodeURIComponent(p.id)}">Ver producto →</a></td>`).join('')}</tr></tbody></table>`:'<p>Selecciona hasta cuatro productos para comparar.</p>';
}
