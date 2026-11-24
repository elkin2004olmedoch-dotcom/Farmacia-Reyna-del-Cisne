'use strict';
const el = id => document.getElementById(id);
let cases = [];
let active = null;
let step = 0;

function showStep(index) {
  step = index;
  const item = active.steps[step];
  el('contador').textContent = 'Paso ' + (step + 1) + ' de ' + active.steps.length;
  el('operacion').textContent = item.title;
  el('accion').textContent = item.action;
  el('resultado').textContent = item.result;
  el('salida').textContent = item.evidence;
  el('fuente').href = item.source;
  el('evidencia').open = false;
  const photo = el('captura');
  photo.hidden = !item.image;
  if (item.image) {
    photo.src = item.image + '.webp';
    photo.alt = {producto:'Ficha del producto en el catálogo del aula', carrito:'Carrito abierto con el producto y su imagen', entrega:'Seguimiento del pedido del aula en el estado Entregado', teclado:'Fotografía del producto ampliada con el teclado'}[item.image];
  } else {
    photo.removeAttribute('src');
    photo.alt = '';
  }
  [...el('pasos').children].forEach((button, n) => {
    if (step === n) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  el('anterior').disabled = step === 0;
  el('siguiente').disabled = step === active.steps.length - 1;
}

function navigate() {
  const id = location.hash.slice(1);
  active = cases.find(item => item.id === id);
  el('indice').hidden = Boolean(active);
  el('caso').hidden = !active;
  el('estado').textContent = id && !active ? 'Esa auditoría no existe. Elige una de la lista.' : '';
  if (!active) {
    document.title = 'Auditorías del Reto 2 · Farmacia Reina del Cisne';
    return;
  }
  el('numero').textContent = 'Reto 2 · Auditoría ' + (cases.indexOf(active) + 1) + ' de ' + cases.length;
  el('titulo').textContent = active.title;
  document.title = active.title + ' · Auditorías del Reto 2';
  el('pregunta').textContent = active.question;
  el('abrir').href = active.link;
  el('abrir').textContent = active.label + ' ↗';
  el('pasos').replaceChildren(...active.steps.map((item, n) => {
    const button = document.createElement('button');
    button.textContent = (n + 1) + '. ' + item.title;
    button.addEventListener('click', () => showStep(n));
    return button;
  }));
  showStep(0);
  el('titulo').focus();
}

async function start() {
  const response = await fetch('casos.json');
  if (!response.ok) throw Error();
  cases = await response.json();
  for (const [n, item] of cases.entries()) {
    const link = document.createElement('a');
    link.href = '#' + item.id;
    for (const [tag, text] of [['small','Auditoría ' + (n + 1)], ['b',item.title], ['span',item.question]]) {
      const part = document.createElement(tag);
      part.textContent = text;
      link.append(part);
    }
    const row = document.createElement('li');
    row.append(link);
    el('lista').append(row);
  }
  window.addEventListener('hashchange', navigate);
  el('anterior').addEventListener('click', () => showStep(step - 1));
  el('siguiente').addEventListener('click', () => showStep(step + 1));
  navigate();
}
start().catch(() => { el('estado').textContent = 'No se pudieron cargar las auditorías. Recarga la página para reintentar.'; });
