/* =====================================================
   MÓDULO SUPERMERCADO - supermercado.js
   Gestión de compras, productos, precios históricos,
   presupuesto y estadísticas de supermercado.
===================================================== */

/* ─── CATEGORÍAS POR DEFECTO ──────────────────────── */

const CATS_SUPER_DEFAULT = [
  'Lácteos','Carnes','Verduras','Frutas','Congelados',
  'Despensa','Bebidas','Snacks','Aseo','Mascotas','Otras'
];

const COLORES_CAT = [
  '#1a73e8','#0f9d58','#f9ab00','#e91e63','#9c27b0',
  '#00bcd4','#ff5722','#607d8b','#795548','#4caf50','#ff9800'
];

/* ─── ESTADO DEL MÓDULO ───────────────────────────── */

let seccionActiva  = 'dashboard';
let productos      = [];        /* super_productos */
let compras        = [];        /* super_compras */
let categorias     = [];        /* array de strings */
let presupuesto    = {};        /* { mensual, semanal } */
let productoEditId = null;      /* id del producto que se edita en el modal */
let itemsCompra    = [];        /* ítems acumulados en el modal de compra */
let graficos       = {};        /* instancias de Chart.js */
let filtroCatProductos = '';    /* categoría activa en la sección Productos */

/* ─── INICIO ──────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {
  await aplicarTemaGuardado();
  configurarBotonTema();
  configurarTabs();
  configurarModalCompra();
  configurarModalProducto();
  configurarModalHistorial();
  configurarSeccionPresupuesto();
  configurarFiltrosCompras();
  document.getElementById('btnNuevoProducto').addEventListener('click', () => abrirModalProducto(null));
  document.getElementById('btnRegistrarCompra').addEventListener('click', abrirModalCompra);
  await cargarTodo();
});

/* ─── CARGA DE DATOS ──────────────────────────────── */

async function cargarTodo() {
  [productos, compras, categorias, presupuesto] = await Promise.all([
    obtenerTodos('super_productos').catch(() => []),
    obtenerTodos('super_compras').catch(() => []),
    obtenerConfig('super_categorias').then(v => v || CATS_SUPER_DEFAULT),
    obtenerConfig('super_presupuesto').then(v => v || { mensual: 0, semanal: 0 }),
  ]);
  await renderizarSeccion(seccionActiva);
}

/* ─── TABS DE SECCIÓN ─────────────────────────────── */

function configurarTabs() {
  document.querySelectorAll('.tab[data-seccion]').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.tab[data-seccion]').forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');
      seccionActiva = btn.dataset.seccion;
      document.querySelectorAll('main > section').forEach(s => s.style.display = 'none');
      document.getElementById(`sec-${seccionActiva}`).style.display = 'block';
      await renderizarSeccion(seccionActiva);
    });
  });
}

async function renderizarSeccion(nombre) {
  switch (nombre) {
    case 'dashboard':    await renderizarDashboard();    break;
    case 'productos':    renderizarProductos();           break;
    case 'compras':      renderizarCompras();             break;
    case 'presupuesto':  renderizarPresupuesto();         break;
    case 'estadisticas': await renderizarEstadisticas(); break;
  }
}

/* ─── SECCIÓN: DASHBOARD ──────────────────────────── */

async function renderizarDashboard() {
  const mes        = mesActual();
  const comprasMes = compras.filter(c => c.fecha && c.fecha.startsWith(mes));
  const totalMes   = comprasMes.reduce((s, c) => s + (c.precio * c.cantidad), 0);
  const pptoMensual = presupuesto.mensual || 0;
  const pct         = pptoMensual > 0 ? Math.min(100, Math.round((totalMes / pptoMensual) * 100)) : 0;

  /* Resumen */
  const colorBarra = pct >= 90 ? 'var(--color-error)' : pct >= 70 ? 'var(--color-alerta)' : 'var(--color-primario)';
  document.getElementById('dashResumen').innerHTML = `
    <div class="tarjeta-titulo">Resumen de ${formatearMesLargo(mes)}</div>
    <div class="resumen-finanzas" style="margin-bottom:${pptoMensual > 0 ? '14px' : '0'};">
      <div class="resumen-item">
        <span>Gastado este mes</span>
        <strong>${formatearDinero(totalMes)}</strong>
      </div>
      <div class="resumen-item">
        <span>Presupuesto mensual</span>
        <strong>${pptoMensual > 0 ? formatearDinero(pptoMensual) : '—'}</strong>
      </div>
      <div class="resumen-item">
        <span>Disponible</span>
        <strong style="color:${pptoMensual > 0 && totalMes > pptoMensual ? 'var(--color-error)' : 'var(--color-exito)'}">
          ${pptoMensual > 0 ? formatearDinero(pptoMensual - totalMes) : '—'}
        </strong>
      </div>
      <div class="resumen-item">
        <span>Nº de compras</span>
        <strong>${new Set(comprasMes.map(c => c.fecha + (c.supermercado||''))).size}</strong>
      </div>
    </div>
    ${pptoMensual > 0 ? `
    <div>
      <div style="display:flex; justify-content:space-between; font-size:0.78rem; color:var(--color-texto-suave); margin-bottom:4px;">
        <span>Uso del presupuesto</span><span>${pct}%</span>
      </div>
      <div style="background:var(--color-borde); border-radius:999px; height:8px; overflow:hidden;">
        <div style="width:${pct}%; height:100%; background:${colorBarra}; border-radius:999px; transition:width .4s;"></div>
      </div>
    </div>` : ''}`;

  /* Alerta */
  const alertaEl = document.getElementById('dashAlerta');
  if (pptoMensual > 0 && pct >= 80) {
    alertaEl.style.display = 'block';
    alertaEl.innerHTML = `
      <div style="padding:10px 14px; background:${pct >= 100 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)'}; border-radius:10px; border-left:3px solid ${pct >= 100 ? 'var(--color-error)' : 'var(--color-alerta)'}; font-size:0.84rem;">
        ${pct >= 100 ? '⚠ Superaste el presupuesto mensual.' : `⚡ Llevas el ${pct}% del presupuesto mensual. ¡Cuidado!`}
      </div>`;
  } else {
    alertaEl.style.display = 'none';
  }

  /* Gráfico dona por categoría */
  const gastoCat = {};
  comprasMes.forEach(c => {
    gastoCat[c.categoria || 'Otras'] = (gastoCat[c.categoria || 'Otras'] || 0) + (c.precio * c.cantidad);
  });
  const catLabels  = Object.keys(gastoCat);
  const catValores = Object.values(gastoCat);

  if (graficos.dash) { try { graficos.dash.destroy(); } catch(e) {} }

  const container = document.getElementById('dashGraficoContainer');
  if (catLabels.length === 0) {
    container.innerHTML = `<p style="text-align:center; color:var(--color-texto-suave); padding:30px 0; font-size:0.85rem;">Sin compras este mes.</p>`;
  } else {
    if (!document.getElementById('dashGrafico')) {
      container.innerHTML = '<canvas id="dashGrafico" style="max-height:260px;"></canvas>';
    }
    const { texto } = coloresGrafico();
    graficos.dash = new Chart(document.getElementById('dashGrafico').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels:   catLabels,
        datasets: [{ data: catValores, backgroundColor: catLabels.map((_, i) => COLORES_CAT[i % COLORES_CAT.length]), borderWidth: 3, borderColor: 'transparent', hoverOffset: 8 }]
      },
      options: {
        responsive: true, cutout: '62%',
        plugins: {
          legend: { position: 'bottom', labels: { color: texto, boxWidth: 12, font: { size: 11 }, padding: 12 } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatearDinero(ctx.raw)}` } }
        }
      }
    });
  }

  /* Últimas compras */
  const ultimas = [...compras]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 10);

  const porFecha = {};
  ultimas.forEach(c => {
    const clave = c.fecha + '|' + (c.supermercado || '');
    if (!porFecha[clave]) porFecha[clave] = { fecha: c.fecha, super: c.supermercado, items: [], total: 0 };
    porFecha[clave].items.push(c);
    porFecha[clave].total += c.precio * c.cantidad;
  });

  const grupos = Object.values(porFecha).slice(0, 3);
  const el = document.getElementById('dashUltimasCompras');
  if (grupos.length === 0) {
    el.innerHTML = `<div class="vacio" style="padding:20px 0;"><p>Sin compras registradas aún.</p></div>`;
  } else {
    el.innerHTML = grupos.map(g => `
      <div style="padding:10px 0; border-bottom:1px solid var(--color-borde);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <div>
            <span style="font-weight:600; font-size:0.9rem;">${formatearFechaCorta(g.fecha)}</span>
            ${g.super ? `<span style="font-size:0.78rem; color:var(--color-texto-suave); margin-left:6px;">${escaparHTML(g.super)}</span>` : ''}
          </div>
          <strong style="color:var(--color-primario);">${formatearDinero(g.total)}</strong>
        </div>
        <div style="font-size:0.78rem; color:var(--color-texto-suave);">
          ${g.items.length} ítem${g.items.length !== 1 ? 's' : ''}: ${g.items.slice(0,3).map(i => escaparHTML(i.nombre)).join(', ')}${g.items.length > 3 ? '…' : ''}
        </div>
      </div>`).join('');
  }
}

/* ─── SECCIÓN: PRODUCTOS ──────────────────────────── */

function renderizarProductos() {
  /* Filtros de categoría */
  const filtroCont = document.getElementById('filtrosCatProducto');
  const cats = ['', ...categorias];
  filtroCont.innerHTML = cats.map(c => `
    <button class="btn-filtro${c === filtroCatProductos ? ' activo' : ''}" data-cat="${escaparHTML(c)}"
      style="padding:5px 12px; font-size:0.78rem; border-radius:999px; border:1px solid var(--color-borde); background:${c === filtroCatProductos ? 'var(--color-primario)' : 'var(--color-superficie)'}; color:${c === filtroCatProductos ? '#fff' : 'var(--color-texto)'}; cursor:pointer; white-space:nowrap;">
      ${c === '' ? 'Todas' : escaparHTML(c)}
    </button>`).join('');

  filtroCont.querySelectorAll('[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      filtroCatProductos = btn.dataset.cat;
      renderizarProductos();
    });
  });

  /* Filtro por búsqueda */
  const busqueda = (document.getElementById('buscarProducto').value || '').toLowerCase();

  let lista = productos.filter(p => {
    const coincideCat = !filtroCatProductos || p.categoria === filtroCatProductos;
    const coincideBusq = !busqueda || p.nombre.toLowerCase().includes(busqueda) || (p.marca || '').toLowerCase().includes(busqueda);
    return coincideCat && coincideBusq;
  });

  lista.sort((a, b) => a.nombre.localeCompare(b.nombre));

  const cont = document.getElementById('listaProductos');
  if (lista.length === 0) {
    cont.innerHTML = `<div class="vacio"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="44" height="44"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/></svg><p>Sin productos${busqueda ? ' que coincidan con la búsqueda' : '. ¡Registrá una compra o creá uno!'}</p></div>`;
    return;
  }

  cont.innerHTML = lista.map(p => {
    const stats = calcularStatsProducto(p.id);
    const colorPrio = p.prioridad === 'esencial' ? '#dc2626' : p.prioridad === 'importante' ? '#d97706' : '#059669';
    const bgPrio    = p.prioridad === 'esencial' ? '#fee2e2' : p.prioridad === 'importante' ? '#fef3c7' : '#d1fae5';
    return `
      <div class="lista-item" data-id="${p.id}" style="flex-direction:column; align-items:stretch; cursor:pointer;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:2px;">
              <span class="lista-item-titulo">${escaparHTML(p.nombre)}</span>
              <span style="font-size:0.72rem; padding:2px 7px; border-radius:999px; background:${bgPrio}; color:${colorPrio}; font-weight:600; white-space:nowrap;">${p.prioridad}</span>
            </div>
            <div class="lista-item-subtitulo">${escaparHTML(p.categoria || '')}${p.marca ? ' · ' + escaparHTML(p.marca) : ''} · ${escaparHTML(p.unidad || 'unidad')}</div>
          </div>
          <div style="text-align:right; flex-shrink:0;">
            ${stats.ultimo > 0 ? `<div style="font-weight:700; font-size:0.95rem;">${formatearDinero(stats.ultimo)}</div>` : '<div style="color:var(--color-texto-suave); font-size:0.8rem;">Sin precio</div>'}
            ${stats.variacion !== null ? `<div style="font-size:0.75rem; color:${stats.variacion > 0 ? 'var(--color-error)' : stats.variacion < 0 ? 'var(--color-exito)' : 'var(--color-texto-suave)'};">${stats.variacion > 0 ? '▲' : stats.variacion < 0 ? '▼' : ''}${Math.abs(stats.variacion)}% vs promedio</div>` : ''}
          </div>
        </div>
        ${stats.compras > 0 ? `
        <div style="display:flex; gap:12px; margin-top:6px; font-size:0.75rem; color:var(--color-texto-suave);">
          <span>Prom: ${formatearDinero(stats.promedio)}</span>
          <span>Min: ${formatearDinero(stats.min)}</span>
          <span>Max: ${formatearDinero(stats.max)}</span>
          <span>${stats.compras} compra${stats.compras !== 1 ? 's' : ''}</span>
        </div>` : ''}
      </div>`;
  }).join('');

  /* Eventos de click: abre historial */
  cont.querySelectorAll('.lista-item[data-id]').forEach(el => {
    el.addEventListener('click', () => abrirModalHistorial(Number(el.dataset.id)));
  });

  /* Evento búsqueda */
  document.getElementById('buscarProducto').addEventListener('input', renderizarProductos, { once: true });
}

/* ─── SECCIÓN: COMPRAS ────────────────────────────── */

function renderizarCompras() {
  /* Rellenar selector de categorías */
  const selCat = document.getElementById('filtroCatCompras');
  if (selCat.options.length <= 1) {
    categorias.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      selCat.appendChild(opt);
    });
  }

  const mes    = document.getElementById('filtroMesCompras').value || mesActual();
  const cat    = selCat.value;

  let lista = compras.filter(c => {
    const coincideMes = c.fecha && c.fecha.startsWith(mes);
    const coincideCat = !cat || c.categoria === cat;
    return coincideMes && coincideCat;
  });

  lista.sort((a, b) => b.fecha.localeCompare(a.fecha));

  /* Agrupar por fecha + supermercado */
  const grupos = {};
  lista.forEach(c => {
    const clave = c.fecha + '||' + (c.supermercado || '');
    if (!grupos[clave]) grupos[clave] = { fecha: c.fecha, super: c.supermercado || '', items: [], total: 0 };
    grupos[clave].items.push(c);
    grupos[clave].total += c.precio * c.cantidad;
  });

  const totalMes = lista.reduce((s, c) => s + c.precio * c.cantidad, 0);

  const cont = document.getElementById('listaCompras');
  if (Object.keys(grupos).length === 0) {
    cont.innerHTML = `<div class="vacio"><p>Sin compras registradas${mes ? ' en ' + formatearMesLargo(mes) : ''}.</p></div>`;
    return;
  }

  cont.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding:10px 12px; background:var(--color-primario-claro); border-radius:10px;">
      <span style="font-size:0.85rem; font-weight:600;">Total del período</span>
      <strong style="color:var(--color-primario); font-size:1rem;">${formatearDinero(totalMes)}</strong>
    </div>` +
    Object.values(grupos).map(g => `
      <div class="tarjeta" style="margin-bottom:10px; padding:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div>
            <span style="font-weight:700; font-size:0.9rem;">${formatearFechaCorta(g.fecha)}</span>
            ${g.super ? `<span style="font-size:0.8rem; color:var(--color-texto-suave); margin-left:8px;">${escaparHTML(g.super)}</span>` : ''}
          </div>
          <strong style="color:var(--color-primario);">${formatearDinero(g.total)}</strong>
        </div>
        ${g.items.map(item => `
          <div style="display:flex; justify-content:space-between; padding:5px 0; border-top:1px solid var(--color-borde); font-size:0.83rem;">
            <span style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-right:8px;">${escaparHTML(item.nombre)}</span>
            <span style="color:var(--color-texto-suave); margin-right:12px;">${item.cantidad} ${item.unidad || 'u.'}</span>
            <span style="font-weight:600; color:var(--color-error); white-space:nowrap;">−${formatearDinero(item.precio * item.cantidad)}</span>
          </div>`).join('')}
      </div>`).join('');
}

function configurarFiltrosCompras() {
  document.getElementById('filtroMesCompras').value = mesActual();
  document.getElementById('filtroMesCompras').addEventListener('change', renderizarCompras);
  document.getElementById('filtroCatCompras').addEventListener('change', renderizarCompras);
}

/* ─── SECCIÓN: PRESUPUESTO ────────────────────────── */

function renderizarPresupuesto() {
  document.getElementById('pptoMensual').value = presupuesto.mensual || '';
  document.getElementById('pptoSemanal').value = presupuesto.semanal || '';

  const mes        = mesActual();
  const comprasMes = compras.filter(c => c.fecha && c.fecha.startsWith(mes));
  const totalMes   = comprasMes.reduce((s, c) => s + c.precio * c.cantidad, 0);
  const pptoM      = presupuesto.mensual || 0;
  const pptoS      = presupuesto.semanal || 0;

  /* Calcular gasto de la semana actual */
  const hoy        = new Date();
  const inicioSem  = new Date(hoy); inicioSem.setDate(hoy.getDate() - hoy.getDay());
  const gastoPtoSemana = compras.filter(c => {
    const f = new Date(c.fecha + 'T00:00:00');
    return f >= inicioSem && f <= hoy;
  }).reduce((s, c) => s + c.precio * c.cantidad, 0);

  document.getElementById('estadoPpto').innerHTML = `
    <div class="tarjeta-titulo">Estado de ${formatearMesLargo(mes)}</div>
    <div class="resumen-finanzas">
      <div class="resumen-item">
        <span>Gastado este mes</span>
        <strong>${formatearDinero(totalMes)}</strong>
      </div>
      <div class="resumen-item">
        <span>Presupuesto mensual</span>
        <strong>${pptoM > 0 ? formatearDinero(pptoM) : '—'}</strong>
      </div>
      <div class="resumen-item">
        <span>Resta mensual</span>
        <strong style="color:${pptoM > 0 && totalMes > pptoM ? 'var(--color-error)' : 'var(--color-exito)'}">
          ${pptoM > 0 ? formatearDinero(pptoM - totalMes) : '—'}
        </strong>
      </div>
      <div class="resumen-item">
        <span>Gastado esta semana</span>
        <strong style="color:${pptoS > 0 && gastoPtoSemana > pptoS ? 'var(--color-error)' : 'inherit'}">
          ${formatearDinero(gastoPtoSemana)}${pptoS > 0 ? ` / ${formatearDinero(pptoS)}` : ''}
        </strong>
      </div>
    </div>`;
}

/* ─── SECCIÓN: ESTADÍSTICAS ───────────────────────── */

async function renderizarEstadisticas() {
  const hoy         = new Date();
  const mesActualStr = mesActual();
  const mesAnterior = mesISO(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1));
  const anioActual  = hoy.getFullYear();

  /* Gasto anual */
  const gastoAnual = compras
    .filter(c => c.fecha && c.fecha.startsWith(String(anioActual)))
    .reduce((s, c) => s + c.precio * c.cantidad, 0);

  /* Gasto mes actual */
  const gastoMesActual = compras
    .filter(c => c.fecha && c.fecha.startsWith(mesActualStr))
    .reduce((s, c) => s + c.precio * c.cantidad, 0);

  /* Gasto mes anterior */
  const gastoMesAnterior = compras
    .filter(c => c.fecha && c.fecha.startsWith(mesAnterior))
    .reduce((s, c) => s + c.precio * c.cantidad, 0);

  /* Producto más comprado */
  const frecuencia = {};
  compras.forEach(c => { frecuencia[c.nombre] = (frecuencia[c.nombre] || 0) + c.cantidad; });
  const masComprado = Object.entries(frecuencia).sort((a, b) => b[1] - a[1])[0];

  /* Producto más caro (por precio unitario) */
  const maxPrecio = compras.reduce((max, c) => (!max || c.precio > max.precio ? c : max), null);

  /* Cards */
  document.getElementById('statsCards').innerHTML = `
    <div class="resumen-item">
      <span>Gasto este año</span>
      <strong>${formatearDinero(gastoAnual)}</strong>
    </div>
    <div class="resumen-item">
      <span>Gasto este mes</span>
      <strong>${formatearDinero(gastoMesActual)}</strong>
    </div>
    <div class="resumen-item">
      <span>Más comprado</span>
      <strong style="font-size:0.82rem;">${masComprado ? escaparHTML(masComprado[0]) : '—'}</strong>
    </div>
    <div class="resumen-item">
      <span>Precio más alto</span>
      <strong style="font-size:0.82rem;">${maxPrecio ? formatearDinero(maxPrecio.precio) : '—'}</strong>
    </div>`;

  /* Comparación mes actual vs anterior */
  const diff = gastoMesActual - gastoMesAnterior;
  const pct  = gastoMesAnterior > 0 ? Math.round((diff / gastoMesAnterior) * 100) : null;
  document.getElementById('statsComparacion').innerHTML = `
    <div class="tarjeta-titulo">Mes actual vs mes anterior</div>
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div>
        <div style="font-size:0.8rem; color:var(--color-texto-suave);">${formatearMesLargo(mesAnterior)}</div>
        <div style="font-weight:700; font-size:1rem;">${formatearDinero(gastoMesAnterior)}</div>
      </div>
      <div style="font-size:1.4rem; color:var(--color-texto-suave);">→</div>
      <div style="text-align:right;">
        <div style="font-size:0.8rem; color:var(--color-texto-suave);">${formatearMesLargo(mesActualStr)}</div>
        <div style="font-weight:700; font-size:1rem;">${formatearDinero(gastoMesActual)}</div>
      </div>
      ${pct !== null ? `
      <div style="padding:6px 14px; border-radius:8px; font-weight:700; font-size:0.9rem; background:${diff > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'}; color:${diff > 0 ? 'var(--color-error)' : 'var(--color-exito)'};">
        ${diff > 0 ? '▲' : '▼'} ${Math.abs(pct)}% (${formatearDinero(Math.abs(diff))})
      </div>` : ''}
    </div>`;

  /* Gráfico de barras: gasto mensual últimos 6 meses */
  const ultMeses = obtenerUltimosMeses(6);
  const datosBarras = ultMeses.map(m => ({
    mes: formatearMesCorto(m),
    total: compras.filter(c => c.fecha && c.fecha.startsWith(m)).reduce((s, c) => s + c.precio * c.cantidad, 0)
  }));

  if (graficos.barras) { try { graficos.barras.destroy(); } catch(e) {} }
  const { texto, grid } = coloresGrafico();
  graficos.barras = new Chart(document.getElementById('statsBarras').getContext('2d'), {
    type: 'bar',
    data: {
      labels: datosBarras.map(d => d.mes),
      datasets: [{
        label: 'Gasto mensual',
        data: datosBarras.map(d => d.total),
        backgroundColor: datosBarras.map(d => d.mes === formatearMesCorto(mesActualStr) ? '#1a73e8' : 'rgba(26,115,232,0.45)'),
        borderRadius: 6, borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true, grid: { color: grid }, ticks: { color: texto, callback: v => formatearDineroCorto(v) } },
        x: { grid: { display: false }, ticks: { color: texto } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${formatearDinero(ctx.raw)}` } }
      }
    }
  });

  /* Ranking de productos (top 5 por gasto total) */
  const gastoProducto = {};
  compras.forEach(c => {
    gastoProducto[c.nombre] = (gastoProducto[c.nombre] || 0) + c.precio * c.cantidad;
  });
  const ranking = Object.entries(gastoProducto)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const maxGasto = ranking[0] ? ranking[0][1] : 1;
  document.getElementById('statsRanking').innerHTML = ranking.length === 0
    ? '<p style="color:var(--color-texto-suave); font-size:0.85rem;">Sin datos aún.</p>'
    : ranking.map(([nombre, gasto], i) => `
        <div style="margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; font-size:0.83rem; margin-bottom:3px;">
            <span>${i + 1}. ${escaparHTML(nombre)}</span>
            <strong>${formatearDinero(gasto)}</strong>
          </div>
          <div style="background:var(--color-borde); border-radius:999px; height:6px; overflow:hidden;">
            <div style="width:${Math.round((gasto / maxGasto) * 100)}%; height:100%; background:var(--color-primario); border-radius:999px;"></div>
          </div>
        </div>`).join('');
}

/* ─── MODAL: REGISTRAR COMPRA ─────────────────────── */

function configurarModalCompra() {
  document.getElementById('btnCerrarModalCompra').addEventListener('click', cerrarModalCompra);
  document.getElementById('modalCompra').addEventListener('click', e => {
    if (e.target === document.getElementById('modalCompra')) cerrarModalCompra();
  });
  document.getElementById('btnAgregarItem').addEventListener('click', agregarItemCompra);
  document.getElementById('btnGuardarCompra').addEventListener('click', guardarCompra);

  /* Autocompletar precio cuando se selecciona un producto conocido */
  document.getElementById('itemNombre').addEventListener('change', autocompletarPrecio);
}

function abrirModalCompra() {
  itemsCompra = [];
  document.getElementById('compraFecha').value = new Date().toISOString().slice(0, 10);
  document.getElementById('compraNombreSuper').value = '';
  document.getElementById('itemNombre').value = '';
  document.getElementById('itemPrecio').value = '';
  document.getElementById('itemCantidad').value = '1';
  actualizarListaItemsModal();

  /* Llenar datalist con productos del catálogo */
  const dl = document.getElementById('sugerenciasProductos');
  dl.innerHTML = productos.map(p => `<option value="${escaparHTML(p.nombre)}">`).join('');

  document.getElementById('modalCompra').style.display = 'flex';
  document.getElementById('itemNombre').focus();
}

function cerrarModalCompra() {
  document.getElementById('modalCompra').style.display = 'none';
  itemsCompra = [];
}

function autocompletarPrecio() {
  const nombre  = document.getElementById('itemNombre').value.trim();
  const prod    = productos.find(p => p.nombre.toLowerCase() === nombre.toLowerCase());
  if (!prod) return;

  /* Llenar cantidad típica */
  document.getElementById('itemCantidad').value = prod.cantidad_tipica || 1;

  /* Llenar último precio conocido */
  const ultimaCompra = [...compras]
    .filter(c => c.productoId === prod.id)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  if (ultimaCompra) document.getElementById('itemPrecio').value = ultimaCompra.precio;
}

function agregarItemCompra() {
  const nombre   = document.getElementById('itemNombre').value.trim();
  const precio   = parseInt(document.getElementById('itemPrecio').value) || 0;
  const cantidad = parseInt(document.getElementById('itemCantidad').value) || 1;

  if (!nombre) { document.getElementById('itemNombre').focus(); return; }
  if (precio <= 0) { document.getElementById('itemPrecio').focus(); return; }

  /* Buscar producto en el catálogo */
  const prod = productos.find(p => p.nombre.toLowerCase() === nombre.toLowerCase());

  itemsCompra.push({
    nombre:     prod ? prod.nombre : nombre,
    productoId: prod ? prod.id : null,
    categoria:  prod ? prod.categoria : 'Otras',
    unidad:     prod ? prod.unidad : 'unidad',
    precio,
    cantidad
  });

  /* Limpiar inputs */
  document.getElementById('itemNombre').value = '';
  document.getElementById('itemPrecio').value = '';
  document.getElementById('itemCantidad').value = '1';
  document.getElementById('itemNombre').focus();

  actualizarListaItemsModal();
}

function actualizarListaItemsModal() {
  const cont  = document.getElementById('listaItemsModal');
  const total = itemsCompra.reduce((s, i) => s + i.precio * i.cantidad, 0);

  document.getElementById('totalCompraModal').textContent = formatearDinero(total);

  if (itemsCompra.length === 0) {
    cont.innerHTML = `<p style="text-align:center; color:var(--color-texto-suave); padding:16px 0; font-size:0.83rem;">Aún no agregaste ítems.</p>`;
    return;
  }

  cont.innerHTML = itemsCompra.map((item, idx) => `
    <div style="display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid var(--color-borde); font-size:0.83rem;">
      <div style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escaparHTML(item.nombre)}</div>
      <div style="color:var(--color-texto-suave); white-space:nowrap;">${item.cantidad} × ${formatearDinero(item.precio)}</div>
      <div style="font-weight:600; color:var(--color-error); white-space:nowrap;">${formatearDinero(item.precio * item.cantidad)}</div>
      <button data-idx="${idx}" class="btn-quitar-item" title="Quitar" style="background:none; border:none; cursor:pointer; color:var(--color-texto-suave); padding:2px; line-height:0; flex-shrink:0;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`).join('');

  cont.querySelectorAll('.btn-quitar-item').forEach(btn => {
    btn.addEventListener('click', () => {
      itemsCompra.splice(Number(btn.dataset.idx), 1);
      actualizarListaItemsModal();
    });
  });
}

async function guardarCompra() {
  if (itemsCompra.length === 0) {
    alert('Agregá al menos un ítem a la compra.');
    return;
  }
  const fecha = document.getElementById('compraFecha').value;
  const super_ = document.getElementById('compraNombreSuper').value.trim();

  if (!fecha) { alert('Seleccioná una fecha.'); return; }

  /* Para cada ítem: si el producto no existe en el catálogo, crearlo */
  for (const item of itemsCompra) {
    if (!item.productoId) {
      const nuevoId = await guardar('super_productos', {
        nombre: item.nombre, categoria: item.categoria || 'Otras',
        marca: '', unidad: item.unidad || 'unidad',
        prioridad: 'importante', cantidad_tipica: item.cantidad, activo_en_lista: true
      });
      item.productoId = nuevoId;
    }
    await guardar('super_compras', {
      productoId:   item.productoId,
      nombre:       item.nombre,
      categoria:    item.categoria,
      unidad:       item.unidad,
      precio:       item.precio,
      cantidad:     item.cantidad,
      fecha,
      supermercado: super_
    });
  }

  cerrarModalCompra();
  await cargarTodo();
}

/* ─── MODAL: NUEVO / EDITAR PRODUCTO ─────────────── */

function configurarModalProducto() {
  document.getElementById('btnCerrarModalProducto').addEventListener('click', cerrarModalProducto);
  document.getElementById('formProducto').addEventListener('submit', guardarProducto);
  document.getElementById('btnEliminarProducto').addEventListener('click', eliminarProducto);
  document.getElementById('modalProducto').addEventListener('click', e => {
    if (e.target === document.getElementById('modalProducto')) cerrarModalProducto();
  });
}

function abrirModalProducto(id) {
  productoEditId = id;

  /* Rellenar select de categorías */
  const selCat = document.getElementById('prodCategoria');
  selCat.innerHTML = categorias.map(c => `<option value="${escaparHTML(c)}">${escaparHTML(c)}</option>`).join('');

  if (id === null) {
    /* Nuevo */
    document.getElementById('tituloModalProducto').textContent = 'Nuevo producto';
    document.getElementById('formProducto').reset();
    document.querySelector('[name="prodPrioridad"][value="importante"]').checked = true;
    document.getElementById('btnEliminarProducto').style.display = 'none';
  } else {
    /* Editar */
    const prod = productos.find(p => p.id === id);
    if (!prod) return;
    document.getElementById('tituloModalProducto').textContent = 'Editar producto';
    document.getElementById('prodNombre').value         = prod.nombre;
    document.getElementById('prodCategoria').value      = prod.categoria;
    document.getElementById('prodMarca').value          = prod.marca || '';
    document.getElementById('prodUnidad').value         = prod.unidad || 'unidad';
    document.getElementById('prodCantidadTipica').value = prod.cantidad_tipica || 1;
    const radio = document.querySelector(`[name="prodPrioridad"][value="${prod.prioridad}"]`);
    if (radio) radio.checked = true;
    document.getElementById('btnEliminarProducto').style.display = 'inline-flex';
  }

  document.getElementById('modalProducto').style.display = 'flex';
  document.getElementById('prodNombre').focus();
}

function cerrarModalProducto() {
  document.getElementById('modalProducto').style.display = 'none';
}

async function guardarProducto(e) {
  e.preventDefault();
  const nombre = document.getElementById('prodNombre').value.trim();
  if (!nombre) return;

  const datos = {
    nombre,
    categoria:      document.getElementById('prodCategoria').value,
    marca:          document.getElementById('prodMarca').value.trim(),
    unidad:         document.getElementById('prodUnidad').value,
    cantidad_tipica: parseInt(document.getElementById('prodCantidadTipica').value) || 1,
    prioridad:      document.querySelector('[name="prodPrioridad"]:checked')?.value || 'importante',
    activo_en_lista: true
  };

  if (productoEditId !== null) datos.id = productoEditId;
  await guardar('super_productos', datos);
  cerrarModalProducto();
  await cargarTodo();
}

async function eliminarProducto() {
  if (productoEditId === null) return;
  const tieneCompras = compras.some(c => c.productoId === productoEditId);
  if (tieneCompras) {
    alert('Este producto tiene compras registradas. No se puede eliminar.');
    return;
  }
  const prod = productos.find(p => p.id === productoEditId);
  if (!confirm(`¿Eliminar el producto "${prod?.nombre}"?`)) return;
  await eliminar('super_productos', productoEditId);
  cerrarModalProducto();
  await cargarTodo();
}

/* ─── MODAL: HISTORIAL DE PRECIOS ─────────────────── */

function configurarModalHistorial() {
  document.getElementById('btnCerrarModalHistorial').addEventListener('click', cerrarModalHistorial);
  document.getElementById('modalHistorial').addEventListener('click', e => {
    if (e.target === document.getElementById('modalHistorial')) cerrarModalHistorial();
  });
}

function abrirModalHistorial(productoId) {
  const prod = productos.find(p => p.id === productoId);
  if (!prod) return;

  document.getElementById('tituloModalHistorial').textContent = prod.nombre;

  const historial = compras
    .filter(c => c.productoId === productoId)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  /* Stats */
  const stats = calcularStatsProducto(productoId);
  document.getElementById('historialStats').innerHTML = [
    { label: 'Último', valor: stats.ultimo > 0 ? formatearDinero(stats.ultimo) : '—' },
    { label: 'Promedio', valor: stats.promedio > 0 ? formatearDinero(stats.promedio) : '—' },
    { label: 'Mínimo', valor: stats.min > 0 ? formatearDinero(stats.min) : '—' },
    { label: 'Máximo', valor: stats.max > 0 ? formatearDinero(stats.max) : '—' },
  ].map(s => `
    <div style="text-align:center; padding:8px; background:var(--color-fondo); border-radius:8px;">
      <div style="font-size:0.72rem; color:var(--color-texto-suave); margin-bottom:2px;">${s.label}</div>
      <div style="font-weight:700; font-size:0.9rem;">${s.valor}</div>
    </div>`).join('');

  /* Gráfico de línea */
  if (graficos.historial) { try { graficos.historial.destroy(); } catch(e) {} }
  if (historial.length > 0) {
    const { texto, grid } = coloresGrafico();
    graficos.historial = new Chart(document.getElementById('historialGrafico').getContext('2d'), {
      type: 'line',
      data: {
        labels: historial.map(c => formatearFechaCorta(c.fecha)),
        datasets: [{
          label: 'Precio',
          data: historial.map(c => c.precio),
          borderColor: '#1a73e8',
          backgroundColor: 'rgba(26,115,232,0.1)',
          fill: true, tension: 0.3, pointRadius: 5, pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: false, grid: { color: grid }, ticks: { color: texto, callback: v => formatearDineroCorto(v) } },
          x: { grid: { display: false }, ticks: { color: texto, font: { size: 10 } } }
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${formatearDinero(ctx.raw)}` } }
        }
      }
    });
  }

  /* Tabla */
  document.getElementById('historialTabla').innerHTML = [...historial].reverse().map(c => `
    <tr style="border-bottom:1px solid var(--color-borde);">
      <td style="padding:6px 8px;">${formatearFechaCorta(c.fecha)}</td>
      <td style="padding:6px 8px; text-align:right; font-weight:600;">${formatearDinero(c.precio)}</td>
      <td style="padding:6px 8px; text-align:right; color:var(--color-texto-suave);">${c.cantidad}</td>
      <td style="padding:6px 8px; color:var(--color-texto-suave);">${escaparHTML(c.supermercado || '—')}</td>
    </tr>`).join('');

  document.getElementById('modalHistorial').style.display = 'flex';
}

function cerrarModalHistorial() {
  document.getElementById('modalHistorial').style.display = 'none';
  if (graficos.historial) { try { graficos.historial.destroy(); graficos.historial = null; } catch(e) {} }
}

/* ─── PRESUPUESTO: GUARDAR Y OPTIMIZAR ────────────── */

function configurarSeccionPresupuesto() {
  document.getElementById('btnGuardarPpto').addEventListener('click', guardarPresupuesto);
  document.getElementById('btnOptimizar').addEventListener('click', generarListaOptimizada);
}

async function guardarPresupuesto() {
  presupuesto = {
    mensual:  parseInt(document.getElementById('pptoMensual').value) || 0,
    semanal:  parseInt(document.getElementById('pptoSemanal').value) || 0,
  };
  await guardarConfig('super_presupuesto', presupuesto);
  renderizarPresupuesto();
}

function generarListaOptimizada() {
  const pptoDisp = parseInt(document.getElementById('pptoOptimizar').value) || 0;
  if (pptoDisp <= 0) { alert('Ingresá un presupuesto mayor a 0.'); return; }

  const orden = { esencial: 0, importante: 1, opcional: 2 };

  const prodsOrdenados = productos
    .filter(p => p.activo_en_lista)
    .map(p => {
      const ultima = [...compras]
        .filter(c => c.productoId === p.id)
        .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
      const precioEst = ultima ? ultima.precio * (p.cantidad_tipica || 1) : 0;
      return { ...p, precioEstimado: precioEst };
    })
    .filter(p => p.precioEstimado > 0)
    .sort((a, b) => orden[a.prioridad] - orden[b.prioridad] || b.precioEstimado - a.precioEstimado);

  let total = 0;
  const incluidos  = [];
  const excluidos  = [];

  for (const p of prodsOrdenados) {
    if (total + p.precioEstimado <= pptoDisp) {
      incluidos.push(p);
      total += p.precioEstimado;
    } else {
      excluidos.push(p);
    }
  }

  const colorPrio = p => p.prioridad === 'esencial' ? '#dc2626' : p.prioridad === 'importante' ? '#d97706' : '#059669';
  const bgPrio    = p => p.prioridad === 'esencial' ? '#fee2e2' : p.prioridad === 'importante' ? '#fef3c7' : '#d1fae5';

  const filaProducto = p => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--color-borde); font-size:0.83rem;">
      <div>
        <span>${escaparHTML(p.nombre)}</span>
        <span style="font-size:0.72rem; padding:1px 6px; border-radius:999px; background:${bgPrio(p)}; color:${colorPrio(p)}; margin-left:5px;">${p.prioridad}</span>
      </div>
      <span style="font-weight:600; white-space:nowrap;">${formatearDinero(p.precioEstimado)}</span>
    </div>`;

  const resultEl = document.getElementById('resultadoOptimizacion');
  resultEl.style.display = 'block';
  resultEl.innerHTML = `
    <div class="tarjeta" style="border-top:3px solid var(--color-exito); margin-bottom:10px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <div class="tarjeta-titulo" style="margin-bottom:0; color:var(--color-exito);">✓ Lista sugerida — ${incluidos.length} productos</div>
        <strong style="color:var(--color-primario);">${formatearDinero(total)}</strong>
      </div>
      ${incluidos.map(filaProducto).join('')}
      <div style="display:flex; justify-content:space-between; padding:8px 0 0; font-size:0.82rem; color:var(--color-texto-suave);">
        <span>Presupuesto disponible: ${formatearDinero(pptoDisp)}</span>
        <span style="color:var(--color-exito); font-weight:600;">Sobra: ${formatearDinero(pptoDisp - total)}</span>
      </div>
    </div>
    ${excluidos.length > 0 ? `
    <div class="tarjeta" style="border-top:3px solid var(--color-error);">
      <div class="tarjeta-titulo" style="margin-bottom:10px; color:var(--color-error);">✗ No entra en el presupuesto — ${excluidos.length} productos</div>
      ${excluidos.map(filaProducto).join('')}
    </div>` : ''}`;
}

/* ─── UTILIDADES ──────────────────────────────────── */

/* Calcula estadísticas de precio para un producto */
function calcularStatsProducto(productoId) {
  const historial = compras.filter(c => c.productoId === productoId);
  if (historial.length === 0) return { ultimo: 0, promedio: 0, min: 0, max: 0, compras: 0, variacion: null };

  const precios = historial.map(c => c.precio);
  const ultimo  = [...historial].sort((a, b) => b.fecha.localeCompare(a.fecha))[0].precio;
  const promedio = Math.round(precios.reduce((s, v) => s + v, 0) / precios.length);
  const min = Math.min(...precios);
  const max = Math.max(...precios);
  const variacion = promedio > 0 ? Math.round(((ultimo - promedio) / promedio) * 100) : null;

  return { ultimo, promedio, min, max, compras: historial.length, variacion };
}

function mesActual() {
  return mesISO(new Date());
}

function mesISO(fecha) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function obtenerUltimosMeses(n) {
  const meses = [];
  const hoy   = new Date();
  for (let i = n - 1; i >= 0; i--) {
    meses.push(mesISO(new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)));
  }
  return meses;
}

function formatearMesCorto(mesStr) {
  const [y, m] = mesStr.split('-');
  const nombres = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${nombres[parseInt(m) - 1]} '${y.slice(2)}`;
}

function formatearMesLargo(mesStr) {
  const [y, m] = mesStr.split('-');
  const nombres = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${nombres[parseInt(m) - 1]} ${y}`;
}

function formatearFechaCorta(fechaISO) {
  if (!fechaISO) return '';
  const [a, m, d] = fechaISO.split('-');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${a}`;
}

function formatearDineroCorto(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000)    return `${Math.round(n / 1000)}K`;
  return String(Math.round(n));
}

function coloresGrafico() {
  const esOscuro = document.documentElement.getAttribute('data-tema') === 'oscuro';
  return {
    texto: esOscuro ? '#aaaaaa' : '#555555',
    grid:  esOscuro ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
  };
}

function escaparHTML(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
