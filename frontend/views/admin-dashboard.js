import {escape,money} from './common.js';
const paths={
  trend:'M3 17l6-6 4 4 8-10M15 5h6v6',
  money:'M12 2v20M17 6H9a4 4 0 000 8h6a4 4 0 010 8H6',
  clock:'M12 8v4l3 2M22 12a10 10 0 11-20 0 10 10 0 0120 0',
  alert:'M12 8v5m0 4h.01M10 3L2 18a2 2 0 002 3h16a2 2 0 002-3L14 3a2 2 0 00-4 0',
  box:'M3 7l9-5 9 5v10l-9 5-9-5V7zm0 0l9 5 9-5M12 12v10M7.5 4.5l9 5',
  users:'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M18 8a4 4 0 010 8m4 5v-2a4 4 0 00-3-3M13 7a4 4 0 11-8 0 4 4 0 018 0',
  shield:'M12 2l9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4zm-5 10l3 3 7-7',
  campaign:'M3 11v4l12 4V7L3 11zm12-4l6-3v18l-6-3M5 16l1 6h4l-2-5',
};
const icon=name=>`<svg class="admin-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]}"></path></svg>`;
const count=value=>new Intl.NumberFormat('es-EC').format(value);
const date=value=>new Intl.DateTimeFormat('es-EC',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Guayaquil'}).format(new Date(value));
const stateLabel=value=>({pendiente:'Pendiente',confirmado:'Confirmado',entregado:'Entregado',cancelado:'Cancelado'}[value] || value);
function metric(key,label,value,detail,section,tone,symbol) {
  return `<a class="admin-metric" data-metric="${key}" href="admin.html?tabla=${section}"><div class="admin-metric-head"><span>${label}</span><span class="admin-metric-icon tone-${tone}">${icon(symbol)}</span></div><strong class="admin-metric-value">${value}</strong><small class="admin-metric-meta">${detail}</small></a>`;
}
function trendView(months) {
  const maximum=Math.max(...months.map(month=>month.totalCentavos),1);const ceiling=Math.max(100,Math.ceil(maximum/100)*100);const top=25,bottom=165,step=84,start=50;
  const axis=new Intl.NumberFormat('es-EC',{notation:'compact',maximumFractionDigits:1});
  const ticks=[0,0.5,1].map(ratio=>{const y=bottom-ratio*(bottom-top);return `<line x1="36" y1="${y}" x2="554" y2="${y}" stroke="#eadfce" stroke-dasharray="4 4"></line><text x="32" y="${y+4}" text-anchor="end" font-size="10" fill="#6b645b">${axis.format(ceiling*ratio/100)}</text>`;}).join('');
  const labels=new Intl.DateTimeFormat('es-EC',{month:'short',timeZone:'UTC'});
  const bars=months.map((month,index)=>{const height=month.totalCentavos/ceiling*(bottom-top),x=start+index*step;const label=labels.format(new Date(month.periodo+'-01T12:00:00Z'));return `<g><rect x="${x}" y="${bottom-height}" width="38" height="${height}" rx="4" fill="#b51c36"><title>${escape(month.etiqueta)}: ${money(month.totalCentavos)}, ${count(month.cantidad)} pedidos</title></rect><text x="${x+19}" y="187" text-anchor="middle" font-size="11" fill="#6b645b">${escape(label)}</text></g>`;}).join('');
  return `<svg class="admin-chart" viewBox="0 0 570 205" role="img" aria-labelledby="admin-trend-title" aria-describedby="admin-trend-desc"><title id="admin-trend-title">Importe de pedidos de los últimos seis meses, en dólares</title><desc id="admin-trend-desc">${escape(months.map(month=>`${month.etiqueta}: ${money(month.totalCentavos)}, ${month.cantidad} pedidos`).join('. '))}</desc>${ticks}${bars}</svg>`;
}
export function dashboardView(data) {
  const i=data.indicadores;const total=i.pedidosTotales.cantidad;
  const cards=[
    metric('mes','Pedidos del mes',money(i.pedidosMes.totalCentavos),`${count(i.pedidosMes.cantidad)} pedidos · mes en curso`,'pedidos','green','trend'),
    metric('total','Importe acumulado',money(i.pedidosTotales.totalCentavos),`${count(total)} pedidos registrados`,'pedidos','purple','money'),
    metric('pendientes','Pedidos pendientes',count(i.pedidosPendientes),'Por coordinar con la farmacia','pedidos','orange','clock'),
    metric('stock','Stock bajo',count(i.stockBajo),`Productos con ${data.umbralStock} unidades o menos`,'productos','red','alert'),
    metric('productos','Productos activos',count(i.productosActivos),'Referencias del catálogo','productos','blue','box'),
    metric('clientes','Clientes',count(i.clientesActivos),'Cuentas de clientes activas','usuarios','green','users'),
    metric('administradores','Administradores',count(i.administradoresActivos),'Cuentas de gestión activas','usuarios','purple','shield'),
    metric('campanas','Campañas vigentes',count(i.campanasVisibles),'Incluye campañas de vista previa','promociones','orange','campaign'),
  ].join('');
  const alerts=data.alertas.length?`<ul class="admin-alert-list">${data.alertas.map(item=>`<li><span>${escape(item.nombre)}</span><strong class="admin-stock-badge ${item.stock===0?'is-empty':''}">${item.stock===0?'Agotado':`${count(item.stock)} unidades`}</strong></li>`).join('')}</ul>${i.stockBajo>data.alertas.length?`<p class="admin-card-note">Mostrando ${data.alertas.length} de ${count(i.stockBajo)} productos en alerta.</p>`:''}`:'<p class="admin-empty">No hay productos por debajo del nivel de alerta.</p>';
  const states=data.estados.length?`<ul class="admin-status-list">${data.estados.map(state=>`<li><span><i class="admin-status-dot" aria-hidden="true"></i>${escape(stateLabel(state.estado))}</span><strong>${count(state.cantidad)}</strong><small>${money(state.totalCentavos)}</small></li>`).join('')}</ul>`:'<p class="admin-empty">Los estados aparecerán cuando recibas el primer pedido.</p>';
  const recent=data.recientes.length?`<div class="table-scroll admin-recent-table" role="region" aria-label="Últimos pedidos" tabindex="0"><table class="admin-data-table"><caption class="sr-only">Últimos cinco pedidos recibidos</caption><thead><tr><th scope="col">Pedido</th><th scope="col">Cliente</th><th scope="col">Fecha</th><th scope="col">Importe</th><th scope="col">Estado</th></tr></thead><tbody>${data.recientes.map(order=>`<tr><td>#${escape(order.id.slice(0,8))}</td><td>${escape(order.nombre)}</td><td>${date(order.createdAt)}</td><td>${money(order.totalCentavos)}</td><td><span class="admin-state-badge">${escape(stateLabel(order.estado))}</span></td></tr>`).join('')}</tbody></table></div>`:'<p class="admin-empty">Todavía no hay pedidos registrados. Aquí verás los más recientes.</p>';
  document.getElementById('admin-dashboard').innerHTML=`<div class="admin-metrics">${cards}</div><div class="admin-dashboard-grid"><section class="admin-card" id="stock-alerts" aria-labelledby="admin-stock-title"><div class="admin-card-heading"><h2 id="admin-stock-title"><span class="tone-red">${icon('alert')}</span>Alertas de stock</h2><a href="admin.html?tabla=productos" class="text-link">Ver inventario →</a></div>${alerts}</section><section class="admin-card" aria-labelledby="admin-quick-title"><div class="admin-card-heading"><h2 id="admin-quick-title"><span class="tone-purple">${icon('campaign')}</span>Accesos rápidos</h2></div><div class="admin-quick-links"><a href="admin.html?tabla=productos&crear=1"><strong>Nuevo producto</strong><small>Añadir al catálogo</small></a><a href="admin.html?tabla=promociones&crear=1"><strong>Nueva promoción</strong><small>Preparar una campaña</small></a><a href="admin.html?tabla=productos"><strong>Gestionar stock</strong><small>Revisar precios y existencias</small></a><a href="admin.html?tabla=pedidos"><strong>Consultar pedidos</strong><small>Atender compras de clientes</small></a></div></section><section class="admin-card" aria-labelledby="admin-states-title"><div class="admin-card-heading"><h2 id="admin-states-title">Pedidos por estado</h2></div>${states}</section><section class="admin-card" aria-labelledby="admin-trend-heading"><div class="admin-card-heading"><h2 id="admin-trend-heading">Tendencia de pedidos</h2><span class="admin-card-note">Últimos 6 meses · USD</span></div>${trendView(data.tendencia)}${data.tendencia.every(month=>month.cantidad===0)?'<p class="admin-card-note">Sin pedidos en este período.</p>':''}</section></div><section class="admin-card admin-recent" aria-labelledby="admin-recent-title"><div class="admin-card-heading"><h2 id="admin-recent-title">Pedidos recientes</h2><a href="admin.html?tabla=pedidos" class="text-link">Ver todos →</a></div>${recent}</section><div class="admin-dashboard-footer"><p>Los importes corresponden a pedidos registrados. El pago se coordina con la farmacia.</p><span>Actualizado: ${date(data.generadoEn)} · Ecuador</span></div>`;
}
export function dashboardLoadingView() {
  document.getElementById('admin-dashboard').innerHTML='<p class="admin-card admin-empty" role="status">Cargando el resumen de la farmacia…</p>';
}
export function dashboardErrorView() {
  document.getElementById('admin-dashboard').innerHTML='<section class="admin-card"><h2>No se pudo cargar el resumen.</h2><p class="admin-empty">Vuelve a intentarlo para consultar los datos actuales de la farmacia.</p><button class="button button-primary" type="button" id="admin-retry-summary">Reintentar</button></section>';
}
