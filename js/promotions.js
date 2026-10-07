(function (global) {
  'use strict';
  // Sustituir únicamente load() por la consulta autenticada del futuro backend.
  // Fechas ISO 8601 con zona horaria; para Ecuador continental usar -05:00.
  function visiblePromotions(data, now = Date.now()) {
    if (!Array.isArray(data)) throw new Error('Formato de promociones incorrecto.');
    const ids = new Set();
    const date = value => value == null || (typeof value === 'string'
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)));
    return data.filter(item => {
      if (!item || item.active !== true || !/^[a-z0-9-]+$/.test(item.id) || ids.has(item.id)
        || !/^[a-z0-9-]+$/.test(item.productId) || typeof item.demo !== 'boolean'
        || !['title','description','label','alt'].every(key => typeof item[key] === 'string' && item[key].trim() && item[key].length <= 300)
        || !/^assets\/images\/[a-z0-9-]+\.(jpg|png|webp|svg)$/.test(item.image)
        || !Number.isFinite(item.order) || !date(item.startsAt) || !date(item.endsAt)
        || (item.startsAt && item.endsAt && Date.parse(item.startsAt) >= Date.parse(item.endsAt))) return false;
      ids.add(item.id);
      return (!item.startsAt || now >= Date.parse(item.startsAt)) && (!item.endsAt || now < Date.parse(item.endsAt));
    }).sort((a,b) => a.order - b.order);
  }
  async function load() {
    if (global.location.protocol !== 'file:') {
      try {
        const response = await fetch('data/promociones.json', { cache:'no-cache' });
        if (!response.ok) throw new Error('Promociones no disponibles.');
        return visiblePromotions(await response.json());
      } catch (_) { /* Copia local para apertura directa y uso sin conexión. */ }
    }
    return visiblePromotions(global.Farmacia.localPromotions || []);
  }
  async function render() {
    const container = document.getElementById('promotions-list');
    if (!container) return;
    const items = await global.Farmacia.promotions.load();
    container.replaceChildren();
    const note = document.getElementById('promotions-note');
    note.textContent = items.some(item => item.demo)
      ? 'Vista previa de próximas campañas. Estos ejemplos no anuncian descuentos vigentes; consulta precios y disponibilidad con la farmacia.'
      : 'Consulta disponibilidad y condiciones de cada promoción con la farmacia.';
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'promotions-empty';
      empty.textContent = 'Estamos preparando nuevas promociones para ti. Vuelve pronto o consulta nuestras novedades por WhatsApp.';
      container.append(empty);
      return;
    }
    for (const item of items) {
      const article = document.createElement('article');
      article.className = 'promotion-card';
      const image = document.createElement('img');
      image.src = item.image; image.alt = item.alt; image.loading = 'lazy';
      const copy = document.createElement('div'); copy.className = 'promotion-copy';
      const label = document.createElement('span'); label.className = 'promotion-label';
      label.textContent = item.demo ? `${item.label} · vista previa` : item.label;
      const title = document.createElement('h3'); title.textContent = item.title;
      const description = document.createElement('p'); description.textContent = item.description;
      const link = document.createElement('a'); link.className = 'text-link';
      link.href = `producto.html?id=${encodeURIComponent(item.productId)}`;
      link.textContent = 'Explorar producto →'; link.setAttribute('aria-label', `Explorar producto: ${item.title}`);
      copy.append(label,title,description,link); article.append(image,copy); container.append(article);
    }
  }
  (global.Farmacia ||= {}).promotions = { visiblePromotions, load, render };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Farmacia.promotions;
  if (typeof document !== 'undefined') render();
})(globalThis);
