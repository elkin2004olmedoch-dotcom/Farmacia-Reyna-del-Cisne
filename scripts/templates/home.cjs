// Portada de la tienda MVC; independiente del sitio histórico.
const {pharmacy}=require('../../frontend/models/pharmacy.js');
const homePage=categories=>`
<section class="ref-store-intro section-wrap" id="inicio" aria-labelledby="home-title">
  <div><p class="eyebrow">Tu farmacia en Puerto Quito</p><h1 id="home-title">Lo que necesitas<br> para <em>cuidarte.</em></h1></div>
  <div class="ref-store-intro-copy"><p>Bienestar, cuidado personal y esenciales para tu familia. Encuéntralos con la atención cercana de Reina del Cisne.</p><a class="text-link" href="catalogo.html">Explorar todos los productos <span aria-hidden="true">→</span></a></div>
</section>
<section class="ref-store-categories section-wrap" id="servicios" aria-labelledby="store-categories-title">
  <div class="shop-section-title"><h2 id="store-categories-title">Explora nuestras secciones.</h2><a class="text-link" href="catalogo.html">Ver todos los productos →</a></div>
  <div class="store-category-grid">${categories.map(({id,nombre,descripcion,imagen},index)=>`<a class="store-category ref-store-category" href="catalogo.html?category=${id}"><div class="ref-store-category-image"><img src="${imagen||'assets/images/farmacia-8.jpg'}" alt="" width="320" height="240" ${index===0?'fetchpriority="high"':index<4?'':'loading="lazy"'} decoding="async"></div><span><strong>${nombre}</strong><small>${descripcion}</small></span><span class="ref-store-category-arrow" aria-hidden="true">↗</span></a>`).join('')}</div>
</section>
<section class="featured-section ref-store-featured section-wrap" aria-labelledby="featured-title">
  <div class="shop-section-title"><div><p class="eyebrow">Selección Reina del Cisne</p><h2 id="featured-title">Favoritos para tu día a día.</h2></div><a class="text-link" href="catalogo.html">Ver todos <span aria-hidden="true">→</span></a></div>
  <div class="featured-grid" id="featured-products" data-loading aria-live="polite">Cargando productos…</div>
</section>
<section class="ref-store-offers section-wrap" id="promos" aria-labelledby="promotions-title">
  <div class="shop-section-title"><div><p class="eyebrow">Para aprovechar</p><h2 id="promotions-title">Un poco más de cuidado.</h2></div><a class="text-link" href="#contacto">Consultar una promoción <span aria-hidden="true">→</span></a></div><p id="promotions-note" class="promotions-note">Cargando promociones…</p><div class="promotions-grid" id="promotions-list" aria-live="polite"></div>
</section>
<section class="ref-store-help section-wrap" aria-labelledby="store-help-title">
  <img src="assets/mascotas/art/boti-base.png" alt="" width="124" height="124" loading="lazy">
  <div><p class="eyebrow">Estamos para ayudarte</p><h2 id="store-help-title">Una duda, una consulta.<br>Estamos cerca.</h2><p>Pregunta por disponibilidad, productos o tu pedido. Nuestro equipo te acompaña.</p></div>
  <a class="button" href="https://api.whatsapp.com/send?phone=593979275988" target="_blank" rel="noopener noreferrer">Hablar con la farmacia <span aria-hidden="true">↗</span></a>
</section>
<section class="benefit-strip ref-store-benefits section-wrap" aria-label="Compra con tranquilidad">
  <a href="checkout.html"><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 10h18M5 10v11h14V10M2 10l2-7h16l2 7M9 21v-7h6v7"/></svg></span><div><strong>Retiro gratuito</strong><small>Te esperamos en farmacia</small></div></a>
  <a href="#cobertura"><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></span><div><strong>Cobertura Ecuador</strong><small>Revisa la tarifa de entrega</small></div></a>
  <a href="catalogo.html"><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m3 3 9 1 10 10-8 8L4 12 3 3Z"/><circle cx="8" cy="8" r="1.5"/></svg></span><div><strong>Precios claros</strong><small>Revisa el total antes de confirmar</small></div></a>
  <a href="#contacto"><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 11a9 9 0 0 1-9 9H4l-2 2v-11a9 9 0 0 1 18 0Z"/><path d="M7 11h10M7 15h6"/></svg></span><div><strong>Atención cercana</strong><small>Consulta con nuestro equipo</small></div></a>
</section>
<section class="ref-store-contact section-wrap" id="contacto" aria-labelledby="contact-form-title">
  <div class="shop-section-title"><div><p class="eyebrow">De persona a persona</p><h2 id="contact-form-title">Tu farmacia, cerca de ti.</h2></div><a class="text-link" href="ayuda.html">Centro de ayuda <span aria-hidden="true">→</span></a></div>
  <details class="ref-store-details" id="cobertura"><summary>Entregas en Ecuador</summary><div class="ref-store-details-copy"><p>Envíos a todo Ecuador. La tarifa nacional inicial es gratuita; la tarifa de Puerto Quito se consulta por separado al preparar el pedido. Verás siempre el importe vigente antes de confirmar. Si no encontramos el destino, seleccionaremos retiro en farmacia para que revises y confirmes tu pedido.</p><a class="text-link" href="ayuda.html#entregas">Ver cómo funciona la entrega <span aria-hidden="true">→</span></a></div></details>
  <details class="ref-store-details" id="ubicacion"><summary>Visítanos en Puerto Quito</summary><div class="location-inner"><div class="location-copy"><h3 id="location-title">Farmacia Reina del Cisne</h3><p><strong>${pharmacy.reference}</strong></p><p>Encuéntranos en el punto de Consulab señalado en el mapa. Visítanos para consultar disponibilidad y presentación de los productos.</p><p><strong>Horario de atención</strong><br>Lunes a sábado · 08:00 a 19:00</p><a class="text-link" href="${pharmacy.mapsUrl.replaceAll('&','&amp;')}" target="_blank" rel="noopener noreferrer">Abrir en Google Maps <span aria-hidden="true">↗</span></a></div><div class="map-art"><iframe data-pharmacy-map loading="lazy" referrerpolicy="no-referrer" allowfullscreen title="Mapa de ubicación de Farmacia Reina del Cisne · Consulab"></iframe></div></div></details>
  <details class="ref-store-details"><summary>Escríbenos una consulta</summary><div class="contact contact-form-section ref-store-contact-form">
  <div class="contact-intro"><h3>¿En qué podemos ayudarte?</h3><p>Prepara tu consulta o escríbenos directamente por WhatsApp.</p><a class="text-link" href="https://api.whatsapp.com/send?phone=593979275988" target="_blank" rel="noopener noreferrer">+593 97 927 5988 <span aria-hidden="true">↗</span></a><p class="muted">Todos los campos son obligatorios. El formulario prepara un mensaje que tú revisas y confirmas en WhatsApp.</p></div>
  <form id="contact-form" class="contact-form" novalidate>
    <div class="form-field"><label for="contact-name">Nombre completo</label><input id="contact-name" name="name" autocomplete="name" maxlength="80" required aria-describedby="contact-name-hint contact-name-error"><small id="contact-name-hint">Ejemplo: María Pérez.</small><span id="contact-name-error" class="field-error" hidden></span></div>
    <div class="form-field"><label for="contact-email">Correo electrónico</label><input id="contact-email" name="email" type="email" autocomplete="email" maxlength="254" required aria-describedby="contact-email-error"><span id="contact-email-error" class="field-error" hidden></span></div>
    <div class="form-field"><label for="contact-phone">Teléfono</label><input id="contact-phone" name="phone" type="tel" autocomplete="tel" maxlength="25" required aria-describedby="contact-phone-hint contact-phone-error"><small id="contact-phone-hint">Ejemplo: +593 97 927 5988.</small><span id="contact-phone-error" class="field-error" hidden></span></div>
    <div class="form-field form-field-wide"><label for="contact-message">Tu consulta</label><textarea id="contact-message" name="message" rows="4" minlength="10" maxlength="1000" required aria-describedby="contact-message-hint contact-message-error"></textarea><small id="contact-message-hint">Cuéntanos qué necesitas (mínimo 10 caracteres).</small><span id="contact-message-error" class="field-error" hidden></span></div>
    <div id="form-status" class="field-error form-field-wide" role="alert" aria-atomic="true"></div>
    <div class="contact-draft-actions"><button type="submit" class="button button-primary">Revisar consulta</button><button type="button" id="contact-clear-saved" class="contact-draft-clear">Limpiar formulario</button></div>
    <p class="contact-draft-note">Tus datos no se envían hasta que abras WhatsApp y confirmes el mensaje.</p>
    <div id="form-success" class="form-field-wide form-success" hidden><p id="contact-ready" role="status">Tu consulta está lista. Ábrela en WhatsApp y confirma el envío allí.</p><a id="contact-whatsapp" class="button button-outline" href="https://api.whatsapp.com/send?phone=593979275988" target="_blank" rel="noopener noreferrer" aria-describedby="contact-ready" aria-label="Enviar consulta por WhatsApp (se abre en una pestaña nueva)">Enviar consulta por WhatsApp <span aria-hidden="true">↗</span></a></div>
  </form>
  </div></details>
</section>
<section class="ref-store-faq section-wrap" aria-labelledby="faq-title">
  <h2 id="faq-title">Antes de tu pedido.</h2><div class="faq-list"><details><summary>¿Puedo consultar si tienen un producto?</summary><p>Sí. Escríbenos por WhatsApp para confirmar disponibilidad y presentación con la farmacia.</p></details><details><summary>¿Cómo recibo mi pedido?</summary><p>Puedes retirar en farmacia sin costo de envío o solicitar una entrega en Ecuador. Revisa la cobertura y tarifa antes de confirmar.</p></details><details><summary>¿Cómo puedo pagar?</summary><p>El pago se coordina con la farmacia. Registrar el pedido no realiza un cobro.</p><a class="text-link" href="pagos.html">Consultar formas de pago <span aria-hidden="true">→</span></a></details></div>
</section>`;
module.exports={homePage};
