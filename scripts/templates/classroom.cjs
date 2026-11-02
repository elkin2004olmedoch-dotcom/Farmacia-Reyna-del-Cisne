const classroomPage=`<section class="classroom-intro" aria-labelledby="classroom-title">
  <p class="eyebrow">Reina del Cisne · Recorrido de demostración</p>
  <h1 id="classroom-title">Una compra.<br>Tres puntos de vista.</h1>
  <p class="classroom-lead">Recorre la tienda, administra un pedido y acompaña su entrega. Cambia de rol cuando quieras, sin crear cuentas ni escribir contraseñas.</p>
  <p class="classroom-notice"><strong>Todo es ficticio.</strong> Los productos, precios, tarifa de envío y pedidos de esta clase se guardan en este navegador. No hay cobros reales ni GPS real.</p>
</section>
<section class="classroom-steps" aria-label="Elige cómo empezar la demostración">
  <article class="classroom-card"><h2><span>1</span> Compra</h2><p>Explora productos, añade al carrito y confirma un pedido como cliente. Revisa la tarifa ficticia antes de elegir una entrega a domicilio.</p><a class="button button-primary" href="catalogo.html?demo=clase&amp;rol=user">Entrar como cliente <span aria-hidden="true">→</span></a></article>
  <article class="classroom-card"><h2><span>2</span> Gestiona</h2><p>Edita un producto, publica una promoción y prepara el pedido. En Entregas puedes revisar la cobertura y asignar el reparto de prueba.</p><a class="button button-outline" href="admin.html?demo=clase&amp;rol=admin">Entrar a administración <span aria-hidden="true">→</span></a></article>
  <article class="classroom-card"><h2><span>3</span> Entrega</h2><p>Abre la bandeja del repartidor y cambia los estados de la entrega. Vuelve a Cliente para consultar el seguimiento simulado del pedido.</p><a class="button button-outline" href="entregas.html?demo=clase&amp;rol=repartidor">Entrar a reparto <span aria-hidden="true">→</span></a></article>
</section>
<section class="classroom-guide" aria-labelledby="classroom-farmi-title"><div><p class="eyebrow">Una orden para probar</p><h2 id="classroom-farmi-title">Gestiona con Farmi.</h2><p>En Administración, abre Farmi y escribe esta orden del panel. Usa el nombre exacto del producto:</p><code>Actualiza el precio de "Vitamina C" a 3,50</code><p class="classroom-guide-note">Farmi interpreta comandos locales. También puedes hacer el cambio desde Productos.</p></div><div class="classroom-guide-aside"><h3>Empieza de nuevo cuando quieras.</h3><p>El botón <strong>Reiniciar</strong> restaura los ejemplos y vacía el carrito de clase. <strong>Salir de la demo</strong> vuelve a la tienda.</p><a class="text-link" href="entregas.html?demo=clase&amp;rol=admin">Ver cobertura y reparto de prueba <span aria-hidden="true">→</span></a></div></section>`;

module.exports={classroomPage};
