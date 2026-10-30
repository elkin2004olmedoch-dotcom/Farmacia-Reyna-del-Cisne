// Portada de la tienda MVC; independiente del sitio histórico.
const homePage=categories=>`
<section class="pharmacy-hero" id="inicio" aria-labelledby="home-title">
  <div class="hero-copy">
    <span class="hero-kicker">Reina del Cisne · Puerto Quito</span>
    <h1 id="home-title">Cuidarte,<br><span>cada día.</span></h1>
    <p>Cuidado personal, bienestar y esenciales para tu familia. Encuentra lo que necesitas con la atención cercana de tu farmacia.</p>
    <div class="button-row"><a class="button button-primary" href="catalogo.html">Explorar productos <span aria-hidden="true">→</span></a><a class="button button-outline" href="#contacto">Hablemos de tu cuidado</a></div>
    <p class="hero-signature">Tu farmacia en Puerto Quito, Ecuador.</p>
  </div>
  <figure class="business-photo">
    <img src="assets/images/farmacia-fachada-reina.webp" alt="Fachada de Farmacia Reina del Cisne con su letrero y entrada" width="1672" height="941" fetchpriority="high">
    <figcaption><div><strong>El cuidado de siempre.</strong><span>Reina del Cisne · Atención cercana</span></div><a href="#ubicacion" aria-label="Ver ubicación de Farmacia Reina del Cisne">Ven a visitarnos <span aria-hidden="true">↗</span></a></figcaption>
  </figure>
</section>
<section class="benefit-strip section-wrap" aria-label="Accesos rápidos">
  <a href="checkout.html" data-customer-only><span aria-hidden="true">⌖</span><div><strong>Retiro en farmacia</strong><small>Sin costo de envío</small></div></a>
  <a href="#contacto"><span aria-hidden="true">✚</span><div><strong>Atención cercana</strong><small>Consulta con nuestro equipo</small></div></a>
  <a href="ayuda.html"><span aria-hidden="true">✓</span><div><strong>Compra a tu ritmo</strong><small>Revisa antes de confirmar</small></div></a>
  <a href="pedidos.html" data-customer-only><span aria-hidden="true">▣</span><div><strong>Consulta tu pedido</strong><small>Todo en un mismo lugar</small></div></a>
</section>
<section class="services section-wrap" id="servicios" aria-labelledby="store-categories-title">
  <div class="shop-section-title"><div><p class="eyebrow">Espacio para tu cuidado</p><h2 id="store-categories-title">Lo cotidiano también importa.</h2></div><a class="text-link" href="catalogo.html">Todo el catálogo <span aria-hidden="true">→</span></a></div>
  <div class="store-category-grid">${categories.map(([category,label,image])=>`<a class="store-category" href="catalogo.html?category=${category}"><img src="assets/images/${image}" alt="" width="100" height="100" loading="lazy"><span><strong>${label}</strong><small>Explorar la colección <span aria-hidden="true">→</span></small></span></a>`).join('')}</div>
</section>
<section class="featured-section section-wrap" aria-labelledby="featured-title">
  <div class="shop-section-title"><div><p class="eyebrow">Selección Reina del Cisne</p><h2 id="featured-title">Tus esenciales, más cerca.</h2></div><a class="text-link" href="catalogo.html">Ver catálogo <span aria-hidden="true">→</span></a></div>
  <div class="featured-grid" id="featured-products" data-loading aria-live="polite">Cargando productos…</div>
</section>
<section class="promos promotions-section" id="promos" aria-labelledby="promotions-title">
  <div class="section-wrap"><div class="shop-section-title"><div><p class="eyebrow">Para tener en cuenta</p><h2 id="promotions-title">Novedades y promociones.</h2></div><a class="text-link" href="#contacto">Consultar promociones <span aria-hidden="true">→</span></a></div><p id="promotions-note" class="promotions-note">Cargando promociones…</p><div class="promotions-grid" id="promotions-list" aria-live="polite"></div></div>
</section>
<section class="store-coverage section-wrap" id="cobertura" aria-labelledby="coverage-title">
  <div><p class="eyebrow">Estamos cerca</p><h2 id="coverage-title">Entregas en todo Puerto Quito.</h2><p>Revisa la tarifa al preparar tu pedido. Si está pendiente, coordina con la farmacia. Las zonas aledañas todavía no tienen cobertura.</p></div><a class="button button-outline" href="ayuda.html#entregas">Consulta cómo funciona <span aria-hidden="true">→</span></a>
</section>
<section class="location" id="ubicacion" aria-labelledby="location-title">
  <div class="location-inner section-wrap">
    <div class="location-copy"><p class="eyebrow">Una farmacia de aquí</p><h2 id="location-title">Nos encuentras<br>en Puerto Quito.</h2><p>Visítanos para consultar disponibilidad, presentación y los productos que necesitas.</p><div class="contact-facts"><p><b aria-hidden="true">⌖</b><span><strong>Farmacia Reina del Cisne</strong>Consulta nuestra ubicación exacta en el mapa.</span></p><p><b aria-hidden="true">◷</b><span><strong>Horario de atención</strong>Lunes a sábado · 08:00 a 19:00</span></p></div><a class="button button-outline" href="https://www.google.com/maps/search/?api=1&amp;query=Farmacia+Reina+del+Cisne+Puerto+Quito" target="_blank" rel="noopener noreferrer">Abrir en Google Maps <span aria-hidden="true">↗</span></a></div>
    <div class="map-art"><iframe src="https://www.google.com/maps?q=Farmacia%20Reina%20del%20Cisne%20Puerto%20Quito&amp;output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen title="Mapa de ubicación de Farmacia Reina del Cisne"></iframe></div>
  </div>
</section>
<section class="contact contact-form-section section-wrap" id="contacto" aria-labelledby="contact-form-title">
  <div class="contact-intro"><p class="eyebrow">De persona a persona</p><h2 id="contact-form-title">Conversemos<br>sobre tu cuidado.</h2><p>Consulta disponibilidad o pide orientación sobre tu compra. Escríbenos directamente o prepara tu mensaje con el formulario.</p><a class="button button-primary" href="https://api.whatsapp.com/send?phone=593979275988" target="_blank" rel="noopener noreferrer">WhatsApp +593 97 927 5988 <span aria-hidden="true">↗</span></a><p class="muted">El formulario prepara un mensaje. Tú lo revisas y confirmas el envío en WhatsApp. Todos los campos son obligatorios.</p></div>
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
</section>
<section class="faq section-wrap" aria-labelledby="faq-title">
  <div class="faq-heading"><p class="eyebrow">Antes de tu pedido</p><h2 id="faq-title">Lo que necesitas saber.</h2></div>
  <div class="faq-list"><details><summary>¿Puedo consultar si tienen un producto?</summary><p>Sí. Escríbenos por WhatsApp antes de venir para confirmar disponibilidad y presentación con la farmacia.</p></details><details><summary>¿Tienen servicio a domicilio?</summary><p>La cobertura inicial abarca todo Puerto Quito. Revisa la tarifa al preparar tu pedido; si está pendiente, contacta a la farmacia. Las zonas aledañas aún no están habilitadas. También puedes retirar en farmacia sin costo de envío.</p></details><details><summary>¿Puedo comprar y pagar desde el sitio?</summary><p>Puedes registrarte, iniciar sesión y confirmar tu pedido. El pago se coordina con la farmacia: registrar el pedido no realiza un cobro. PayPhone permanece desactivado hasta su habilitación comercial.</p><a class="text-link" href="pagos.html">Consultar formas de pago <span aria-hidden="true">→</span></a></details></div>
</section>`;
module.exports={homePage};
