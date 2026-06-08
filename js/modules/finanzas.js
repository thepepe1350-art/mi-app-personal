/* =====================================================
   MÓDULO FINANZAS - finanzas.js
   Maneja presupuesto mensual, gastos por categoría,
   historial, gráficos, metas de ahorro y exportación.
===================================================== */

const PALETA = [
  '#1a73e8','#0f9d58','#f9ab00','#e91e63',
  '#9c27b0','#00bcd4','#ff5722','#607d8b',
  '#795548','#4caf50','#ff9800','#2196f3'
];

const CATS_DEFAULT = [
  { nombre: 'Ahorro',          color: '#0f9d58' },
  { nombre: 'Vivienda',        color: '#1a73e8' },
  { nombre: 'Alimentación',    color: '#f9ab00' },
  { nombre: 'Transporte',      color: '#e91e63' },
  { nombre: 'Salud',           color: '#00bcd4' },
  { nombre: 'Entretenimiento', color: '#9c27b0' },
  { nombre: 'Imprevistos',     color: '#ff5722' },
  { nombre: 'Otros',           color: '#607d8b' },
];

let mesActual    = mesISO(new Date());
let categorias   = [];
let configMes    = {};
let gastosMes    = [];
let metas        = [];
let graficos     = {};       /* instancias activas de Chart.js */
let tabGrafico   = 'distribucion';
let metaIdAbonar = null;

document.addEventListener('DOMContentLoaded', async () => {
  await aplicarTemaGuardado();
  configurarBotonTema();
  configurarSelectorMes();
  configurarBotones();
  configurarModalGasto();
  configurarModalCats();
  configurarModalMeta();
  configurarModalAbonar();
  configurarTabsGraficos();
  await cargarTodo();
});

/* ─── CARGAR TODO ─────────────────────────────────── */

async function cargarTodo() {
  categorias = await cargarCategorias();
  configMes  = await cargarConfigMes();
  gastosMes  = await cargarGastosMes();
  metas      = await cargarMetas();
  await renderizarTodo();
}

async function cargarCategorias() {
  const guardadas = await obtenerConfig('cats_finanzas').catch(() => null);
  if (guardadas && guardadas.length > 0) return guardadas;
  await guardarConfig('cats_finanzas', CATS_DEFAULT);
  return CATS_DEFAULT;
}

async function cargarConfigMes() {
  const config = await obtenerConfig(`fin_${mesActual}`).catch(() => null);
  return config || { sueldo: 0, presupuesto: {} };
}

async function cargarGastosMes() {
  const todos = await obtenerTodos('finanzas').catch(() => []);
  return todos.filter(g => g.fecha && g.fecha.startsWith(mesActual));
}

async function cargarMetas() {
  const guardadas = await obtenerConfig('metas_ahorro').catch(() => null);
  return guardadas || [];
}

/* ─── RENDERIZAR ──────────────────────────────────── */

async function renderizarTodo() {
  renderizarResumen();
  await renderizarGraficos();
  await renderizarMetas();
  renderizarCategorias();
  renderizarGastos();
}

/* Dibuja el resumen con sueldo, gastos, disponible, ahorro estimado y mensaje */
function renderizarResumen() {
  document.getElementById('campoSueldo').value = configMes.sueldo || '';

  const totalPresupuestado = Object.values(configMes.presupuesto || {})
    .reduce((suma, v) => suma + (v || 0), 0);
  const totalGastado   = gastosMes.reduce((suma, g) => suma + (g.monto || 0), 0);
  const sueldo         = configMes.sueldo || 0;
  const disponible     = sueldo - totalGastado;
  const sinDistribuir  = Math.max(0, sueldo - totalPresupuestado);
  const ahorroEstimado = Math.max(0, disponible);
  const pctAhorro      = sueldo > 0 ? Math.round((ahorroEstimado / sueldo) * 100) : 0;

  let mensaje = '';
  if (sueldo > 0) {
    if (disponible < 0)        mensaje = '⚠ Atención: tus gastos superan tu sueldo este mes.';
    else if (pctAhorro >= 20)  mensaje = '¡Excelente! Estás ahorrando bien este mes.';
    else if (pctAhorro >= 10)  mensaje = 'Bien, pero podés intentar ahorrar un poco más.';
    else                        mensaje = 'Cuidado, estás gastando casi todo tu sueldo.';
  }

  document.getElementById('resumenMes').innerHTML = `
    ${mensaje ? `<p style="font-size:0.82rem; color:var(--color-texto-suave); font-style:italic; margin-bottom:12px;">${mensaje}</p>` : ''}
    <div class="resumen-finanzas">
      <div class="resumen-item">
        <span>Sueldo</span>
        <strong>${formatearDinero(sueldo)}</strong>
      </div>
      <div class="resumen-item">
        <span>Gastado</span>
        <strong style="color:${totalGastado > sueldo && sueldo > 0 ? 'var(--color-error)' : 'inherit'}">
          ${formatearDinero(totalGastado)}
        </strong>
      </div>
      <div class="resumen-item">
        <span>Disponible</span>
        <strong style="color:${disponible < 0 ? 'var(--color-error)' : 'var(--color-exito)'}">
          ${formatearDinero(disponible)}
        </strong>
      </div>
      <div class="resumen-item">
        <span>Ahorro estimado</span>
        <strong style="color:var(--color-exito);">
          ${formatearDinero(ahorroEstimado)}${sueldo > 0 ? ` (${pctAhorro}%)` : ''}
        </strong>
      </div>
      ${sinDistribuir > 0 ? `
      <div class="resumen-item">
        <span>Sin distribuir</span>
        <strong style="color:var(--color-alerta)">${formatearDinero(sinDistribuir)}</strong>
      </div>` : ''}
    </div>`;
}

/* ─── GRÁFICOS ────────────────────────────────────── */

/* Configura los botones de tab para cambiar entre gráficos */
function configurarTabsGraficos() {
  document.querySelectorAll('.tab-grafico').forEach(btn => {
    btn.addEventListener('click', () => {
      tabGrafico = btn.dataset.tab;

      /* Actualiza clases de los botones */
      document.querySelectorAll('.tab-grafico').forEach(b => {
        b.className = b === btn
          ? 'tab-grafico btn btn-primario'
          : 'tab-grafico btn btn-secundario';
        b.style.cssText = 'padding:7px 14px; font-size:0.82rem; flex:1; min-width:100px;';
      });

      /* Muestra solo el panel activo */
      document.querySelectorAll('.panel-grafico').forEach(p => p.style.display = 'none');
      const panel = document.getElementById(`panel-${tabGrafico}`);
      if (panel) {
        panel.style.display = 'block';
        if (graficos[tabGrafico]) graficos[tabGrafico].resize();
      }
    });
  });

  /* Muestra el panel inicial */
  document.querySelectorAll('.panel-grafico').forEach(p => p.style.display = 'none');
  const panelInicial = document.getElementById(`panel-${tabGrafico}`);
  if (panelInicial) panelInicial.style.display = 'block';
}

/* Destruye los gráficos anteriores y crea los nuevos */
async function renderizarGraficos() {
  Object.values(graficos).forEach(c => { try { c.destroy(); } catch (e) {} });
  graficos = {};
  crearGraficoDistribucion();
  crearGraficoPresupuesto();
  await crearGraficoEvolucion();
}

/* Gráfico de dona: distribución de gastos del mes por categoría */
function crearGraficoDistribucion() {
  const datos = categorias
    .map(cat => ({
      nombre: cat.nombre,
      color:  cat.color,
      monto:  gastosMes
        .filter(g => g.categoria === cat.nombre)
        .reduce((s, g) => s + g.monto, 0)
    }))
    .filter(d => d.monto > 0);

  const panel  = document.getElementById('panel-distribucion');
  const canvas = document.getElementById('graficoDistribucion');

  if (datos.length === 0) {
    panel.innerHTML = `<p style="text-align:center; color:var(--color-texto-suave); padding:40px 0; font-size:0.85rem;">Sin gastos registrados este mes.</p>`;
    return;
  }

  /* Asegura que el canvas exista (por si fue reemplazado por el mensaje de vacío) */
  if (!document.getElementById('graficoDistribucion')) {
    panel.innerHTML = '<canvas id="graficoDistribucion" style="max-height:300px;"></canvas>';
  }

  const { texto } = coloresGrafico();
  graficos.distribucion = new Chart(
    document.getElementById('graficoDistribucion').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels:   datos.map(d => d.nombre),
      datasets: [{
        data:            datos.map(d => d.monto),
        backgroundColor: datos.map(d => d.color),
        borderWidth:     3,
        borderColor:     'transparent',
        hoverOffset:     10
      }]
    },
    options: {
      responsive:  true,
      cutout:      '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels:   { color: texto, boxWidth: 12, font: { size: 11 }, padding: 14 }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${formatearDinero(ctx.raw)}`
          }
        }
      }
    }
  });
}

/* Gráfico de barras: presupuesto asignado vs. gasto real por categoría */
function crearGraficoPresupuesto() {
  const catsConData = categorias.filter(cat =>
    (configMes.presupuesto && configMes.presupuesto[cat.nombre] > 0) ||
    gastosMes.some(g => g.categoria === cat.nombre)
  );

  const panel  = document.getElementById('panel-presupuesto');
  const canvas = document.getElementById('graficoPresupuesto');

  if (catsConData.length === 0) {
    panel.innerHTML = `<p style="text-align:center; color:var(--color-texto-suave); padding:40px 0; font-size:0.85rem;">Sin datos de presupuesto este mes.</p>`;
    return;
  }

  if (!document.getElementById('graficoPresupuesto')) {
    panel.innerHTML = '<canvas id="graficoPresupuesto" style="max-height:300px;"></canvas>';
  }

  const { texto, grid } = coloresGrafico();
  graficos.presupuesto = new Chart(
    document.getElementById('graficoPresupuesto').getContext('2d'), {
    type: 'bar',
    data: {
      labels: catsConData.map(c => c.nombre),
      datasets: [
        {
          label:           'Presupuestado',
          data:            catsConData.map(c => configMes.presupuesto[c.nombre] || 0),
          backgroundColor: 'rgba(26,115,232,0.4)',
          borderColor:     '#1a73e8',
          borderWidth:     1,
          borderRadius:    4
        },
        {
          label:           'Gastado',
          data:            catsConData.map(c =>
            gastosMes
              .filter(g => g.categoria === c.nombre)
              .reduce((s, g) => s + g.monto, 0)
          ),
          backgroundColor: catsConData.map(c => c.color + 'bb'),
          borderColor:     catsConData.map(c => c.color),
          borderWidth:     1,
          borderRadius:    4
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          grid:  { color: grid },
          ticks: { color: texto, callback: v => formatearDineroCorto(v) }
        },
        x: {
          grid:  { display: false },
          ticks: { color: texto, font: { size: 10 } }
        }
      },
      plugins: {
        legend: { position: 'top', labels: { color: texto, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${formatearDinero(ctx.raw)}`
          }
        }
      }
    }
  });
}

/* Gráfico de línea: evolución de gastos, sueldo y ahorro en los últimos 6 meses */
async function crearGraficoEvolucion() {
  const ultimosMeses = obtenerUltimosMeses(6);
  const todosGastos  = await obtenerTodos('finanzas').catch(() => []);

  const datos = await Promise.all(ultimosMeses.map(async mes => {
    const gastosDelMes = todosGastos.filter(g => g.fecha && g.fecha.startsWith(mes));
    const totalGastado = gastosDelMes.reduce((s, g) => s + g.monto, 0);
    const config       = await obtenerConfig(`fin_${mes}`).catch(() => null);
    const sueldo       = config ? (config.sueldo || 0) : 0;
    return { mes, totalGastado, sueldo, ahorro: Math.max(0, sueldo - totalGastado) };
  }));

  const { texto, grid } = coloresGrafico();
  graficos.evolucion = new Chart(
    document.getElementById('graficoEvolucion').getContext('2d'), {
    type: 'line',
    data: {
      labels: datos.map(d => formatearMesCorto(d.mes)),
      datasets: [
        {
          label:           'Gastos',
          data:            datos.map(d => d.totalGastado),
          borderColor:     '#e91e63',
          backgroundColor: 'rgba(233,30,99,0.10)',
          fill:            true,
          tension:         0.35,
          pointRadius:     5,
          pointHoverRadius: 7
        },
        {
          label:           'Sueldo',
          data:            datos.map(d => d.sueldo),
          borderColor:     '#1a73e8',
          backgroundColor: 'transparent',
          fill:            false,
          tension:         0.35,
          borderDash:      [6, 4],
          pointRadius:     5,
          pointHoverRadius: 7
        },
        {
          label:           'Ahorro',
          data:            datos.map(d => d.ahorro),
          borderColor:     '#0f9d58',
          backgroundColor: 'rgba(15,157,88,0.10)',
          fill:            true,
          tension:         0.35,
          pointRadius:     5,
          pointHoverRadius: 7
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          grid:  { color: grid },
          ticks: { color: texto, callback: v => formatearDineroCorto(v) }
        },
        x: {
          grid:  { color: grid },
          ticks: { color: texto }
        }
      },
      plugins: {
        legend: { position: 'top', labels: { color: texto, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${formatearDinero(ctx.raw)}`
          }
        }
      }
    }
  });
}

/* ─── METAS DE AHORRO ─────────────────────────────── */

/* Muestra la proyección de ahorro promedio y la lista de metas */
async function renderizarMetas() {
  await renderizarProyeccion();

  const contenedor = document.getElementById('listaMetas');
  if (metas.length === 0) {
    contenedor.innerHTML = `
      <div class="vacio" style="padding:20px 0;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p>No tenés metas de ahorro aún.<br>¡Creá una para empezar!</p>
      </div>`;
    return;
  }

  contenedor.innerHTML = metas.map(meta => {
    const restante        = Math.max(0, meta.montoObjetivo - meta.ahorroActual);
    const porcentaje      = Math.min(100, Math.round((meta.ahorroActual / meta.montoObjetivo) * 100));
    const mesesNecesarios = meta.ahorroPorMes > 0 ? Math.ceil(restante / meta.ahorroPorMes) : null;
    const fechaEstimada   = mesesNecesarios !== null ? calcularFechaFutura(mesesNecesarios) : null;
    const completada      = meta.ahorroActual >= meta.montoObjetivo;

    return `
      <div style="margin-bottom:16px; padding:14px; background:var(--color-fondo); border-radius:12px; border:1px solid var(--color-borde);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <div style="width:12px; height:12px; border-radius:50%; background:${meta.color}; flex-shrink:0;"></div>
              <span style="font-weight:700; font-size:0.95rem;">${escaparHTML(meta.nombre)}</span>
              ${completada ? '<span style="font-size:0.73rem; background:rgba(15,157,88,0.15); color:#0f9d58; padding:2px 8px; border-radius:999px; font-weight:600;">✓ Completada</span>' : ''}
            </div>
            <div style="font-size:0.78rem; color:var(--color-texto-suave); margin-top:3px; margin-left:20px;">
              Meta: ${formatearDinero(meta.montoObjetivo)} · Plan: ${formatearDinero(meta.ahorroPorMes)}/mes
            </div>
          </div>
          <div style="display:flex; gap:6px; flex-shrink:0; margin-left:8px;">
            ${!completada ? `
            <button class="btn btn-secundario btn-abonar-meta" data-id="${meta.id}" style="padding:5px 10px; font-size:0.78rem; white-space:nowrap;">
              Abonar
            </button>` : ''}
            <button class="btn-eliminar-meta" data-id="${meta.id}" title="Eliminar meta"
              style="background:none; border:none; cursor:pointer; color:var(--color-texto-suave); padding:4px; border-radius:6px; line-height:0;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"/>
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              </svg>
            </button>
          </div>
        </div>

        <div style="background:var(--color-borde); border-radius:999px; height:10px; overflow:hidden; margin-bottom:6px;">
          <div style="width:${porcentaje}%; height:100%; background:${meta.color}; border-radius:999px; transition:width .4s ease;"></div>
        </div>

        <div style="display:flex; justify-content:space-between; font-size:0.78rem; margin-bottom:${!completada && mesesNecesarios !== null ? '8px' : '0'};">
          <span style="color:${meta.color}; font-weight:600;">${formatearDinero(meta.ahorroActual)} (${porcentaje}%)</span>
          ${!completada ? `<span style="color:var(--color-texto-suave);">Faltan ${formatearDinero(restante)}</span>` : ''}
        </div>

        ${!completada && mesesNecesarios !== null ? `
        <div style="padding:8px 12px; background:${meta.color}1a; border-radius:8px; font-size:0.82rem; border-left:3px solid ${meta.color};">
          📅 Faltan <strong>${mesesNecesarios} mes${mesesNecesarios !== 1 ? 'es' : ''}</strong> → Llegás en <strong>${fechaEstimada}</strong>
        </div>` : ''}
      </div>`;
  }).join('');

  contenedor.querySelectorAll('.btn-abonar-meta').forEach(btn => {
    btn.addEventListener('click', () => abrirModalAbonar(Number(btn.dataset.id)));
  });
  contenedor.querySelectorAll('.btn-eliminar-meta').forEach(btn => {
    btn.addEventListener('click', () => eliminarMeta(Number(btn.dataset.id)));
  });
}

/* Calcula el ahorro promedio de los últimos 3 meses y lo muestra */
async function renderizarProyeccion() {
  const contenedor = document.getElementById('proyeccionAhorro');
  const ahorroProm = await calcularAhorroPromedio();

  if (ahorroProm <= 0) {
    contenedor.innerHTML = '';
    return;
  }

  contenedor.innerHTML = `
    <div style="padding:10px 14px; background:rgba(15,157,88,0.08); border-radius:10px; border:1px solid rgba(15,157,88,0.25); font-size:0.84rem; margin-bottom:14px; line-height:1.5;">
      💡 Basado en tus últimos 3 meses, tu capacidad de ahorro real es aprox.
      <strong style="color:#0f9d58;">${formatearDinero(ahorroProm)}/mes</strong>
    </div>`;
}

/* Promedia el ahorro real (sueldo - gastos) de los últimos 3 meses con sueldo cargado */
async function calcularAhorroPromedio() {
  const ultimosMeses = obtenerUltimosMeses(3);
  const todosGastos  = await obtenerTodos('finanzas').catch(() => []);
  let sumaAhorro = 0, mesesValidos = 0;

  for (const mes of ultimosMeses) {
    const config = await obtenerConfig(`fin_${mes}`).catch(() => null);
    const sueldo = config ? (config.sueldo || 0) : 0;
    if (sueldo > 0) {
      const gastosDelMes = todosGastos.filter(g => g.fecha && g.fecha.startsWith(mes));
      const totalGastado = gastosDelMes.reduce((s, g) => s + g.monto, 0);
      sumaAhorro += Math.max(0, sueldo - totalGastado);
      mesesValidos++;
    }
  }

  return mesesValidos > 0 ? Math.round(sumaAhorro / mesesValidos) : 0;
}

/* ─── MODAL: NUEVA META ───────────────────────────── */

function configurarModalMeta() {
  document.getElementById('btnCerrarModalMeta').addEventListener('click', cerrarModalMeta);
  document.getElementById('formMeta').addEventListener('submit', guardarMeta);
  document.getElementById('modalMeta').addEventListener('click', e => {
    if (e.target === document.getElementById('modalMeta')) cerrarModalMeta();
  });
  document.getElementById('metaMonto').addEventListener('input', actualizarCalculoMeta);
  document.getElementById('metaAhorroPorMes').addEventListener('input', actualizarCalculoMeta);
}

function abrirModalMeta() {
  document.getElementById('calculoMeta').style.display = 'none';
  document.getElementById('modalMeta').style.display = 'flex';
  document.getElementById('metaNombre').focus();
}

function cerrarModalMeta() {
  document.getElementById('modalMeta').style.display = 'none';
  document.getElementById('formMeta').reset();
  document.getElementById('calculoMeta').style.display = 'none';
}

/* Muestra en tiempo real cuántos meses necesitás mientras escribís */
function actualizarCalculoMeta() {
  const monto  = parseInt(document.getElementById('metaMonto').value) || 0;
  const ahorro = parseInt(document.getElementById('metaAhorroPorMes').value) || 0;
  const div    = document.getElementById('calculoMeta');

  if (monto > 0 && ahorro > 0) {
    const meses = Math.ceil(monto / ahorro);
    const fecha = calcularFechaFutura(meses);
    div.style.display = 'block';
    div.innerHTML = `
      Necesitás <strong>${meses} mes${meses !== 1 ? 'es' : ''}</strong> ahorrando ${formatearDinero(ahorro)}/mes.<br>
      Fecha estimada de logro: <strong>${fecha}</strong>`;
  } else {
    div.style.display = 'none';
  }
}

async function guardarMeta(e) {
  e.preventDefault();
  const nombre       = document.getElementById('metaNombre').value.trim();
  const montoObj     = parseInt(document.getElementById('metaMonto').value) || 0;
  const ahorroPorMes = parseInt(document.getElementById('metaAhorroPorMes').value) || 0;
  if (!nombre || montoObj <= 0 || ahorroPorMes <= 0) return;

  const color = PALETA[metas.length % PALETA.length];
  metas.push({
    id:            Date.now(),
    nombre,
    montoObjetivo: montoObj,
    ahorroPorMes,
    ahorroActual:  0,
    fechaCreacion: new Date().toISOString().slice(0, 10),
    color
  });

  await guardarConfig('metas_ahorro', metas);
  cerrarModalMeta();
  await renderizarMetas();
}

/* ─── MODAL: ABONAR A META ────────────────────────── */

function configurarModalAbonar() {
  document.getElementById('btnCerrarModalAbonar').addEventListener('click', cerrarModalAbonar);
  document.getElementById('formAbonar').addEventListener('submit', confirmarAbonar);
  document.getElementById('modalAbonar').addEventListener('click', e => {
    if (e.target === document.getElementById('modalAbonar')) cerrarModalAbonar();
  });
}

function abrirModalAbonar(id) {
  const meta = metas.find(m => m.id === id);
  if (!meta) return;
  metaIdAbonar = id;
  const restante = Math.max(0, meta.montoObjetivo - meta.ahorroActual);
  document.getElementById('infoMetaAbonar').innerHTML =
    `<strong>${escaparHTML(meta.nombre)}</strong><br>
     Ahorrado: ${formatearDinero(meta.ahorroActual)} de ${formatearDinero(meta.montoObjetivo)}<br>
     Falta: <strong style="color:#e91e63;">${formatearDinero(restante)}</strong>`;
  document.getElementById('montoAbonar').value = '';
  document.getElementById('modalAbonar').style.display = 'flex';
  document.getElementById('montoAbonar').focus();
}

function cerrarModalAbonar() {
  document.getElementById('modalAbonar').style.display = 'none';
  document.getElementById('formAbonar').reset();
  metaIdAbonar = null;
}

async function confirmarAbonar(e) {
  e.preventDefault();
  if (metaIdAbonar === null) return;
  const monto = parseInt(document.getElementById('montoAbonar').value) || 0;
  if (monto <= 0) return;

  const meta = metas.find(m => m.id === metaIdAbonar);
  if (!meta) return;
  meta.ahorroActual = Math.min(meta.montoObjetivo, meta.ahorroActual + monto);
  await guardarConfig('metas_ahorro', metas);
  cerrarModalAbonar();
  await renderizarMetas();
}

async function eliminarMeta(id) {
  const meta = metas.find(m => m.id === id);
  if (!meta) return;
  if (!confirm(`¿Eliminar la meta "${meta.nombre}"?`)) return;
  metas = metas.filter(m => m.id !== id);
  await guardarConfig('metas_ahorro', metas);
  await renderizarMetas();
}

/* ─── SELECTOR DE MES ─────────────────────────────── */

function configurarSelectorMes() {
  const selector = document.getElementById('selectorMes');
  selector.value = mesActual;
  selector.addEventListener('change', async () => {
    mesActual = selector.value;
    await cargarTodo();
  });
}

/* ─── SUELDO ──────────────────────────────────────── */

function configurarBotones() {
  document.getElementById('btnGuardarSueldo').addEventListener('click', guardarSueldo);
  document.getElementById('campoSueldo').addEventListener('keydown', e => {
    if (e.key === 'Enter') guardarSueldo();
  });
  document.getElementById('btnAgregarGasto').addEventListener('click', abrirModalGasto);
  document.getElementById('btnAgregarMeta').addEventListener('click', abrirModalMeta);
  document.getElementById('btnExportar').addEventListener('click', exportarCSV);
  document.getElementById('btnGestionarCats').addEventListener('click', abrirModalCats);
}

async function guardarSueldo() {
  const valor = parseInt(document.getElementById('campoSueldo').value) || 0;
  configMes.sueldo = valor;
  await guardarConfig(`fin_${mesActual}`, configMes);
  renderizarResumen();
}

/* ─── PRESUPUESTO POR CATEGORÍA ───────────────────── */

function renderizarCategorias() {
  const contenedor  = document.getElementById('listaCategoriasFin');
  const presupuesto = configMes.presupuesto || {};

  contenedor.innerHTML = categorias.map(cat => {
    const budgetCat  = presupuesto[cat.nombre] || 0;
    const gastadoCat = gastosMes
      .filter(g => g.categoria === cat.nombre)
      .reduce((s, g) => s + (g.monto || 0), 0);
    const porcentaje  = budgetCat > 0 ? Math.min(100, (gastadoCat / budgetCat) * 100) : 0;
    const superado    = gastadoCat > budgetCat && budgetCat > 0;
    const claseRelleno = porcentaje >= 100 ? 'peligro' : porcentaje >= 80 ? 'alerta' : '';

    return `
      <div style="margin-bottom:18px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
          <div style="width:12px; height:12px; border-radius:50%; background:${cat.color}; flex-shrink:0;"></div>
          <span style="font-weight:600; font-size:0.9rem; flex:1;">${escaparHTML(cat.nombre)}</span>
          <input
            type="number"
            class="campo campo-presupuesto"
            placeholder="0"
            value="${budgetCat || ''}"
            data-cat="${escaparHTML(cat.nombre)}"
            min="0"
            title="Presupuesto para ${escaparHTML(cat.nombre)}"
            style="width:130px; padding:6px 10px; font-size:0.85rem; text-align:right;"
          >
        </div>
        <div class="barra-progreso">
          <div class="barra-progreso-relleno ${claseRelleno}" style="width:${porcentaje}%;"></div>
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:0.78rem; color:var(--color-texto-suave);">
          <span style="${superado ? 'color:var(--color-error); font-weight:700;' : ''}">
            ${formatearDinero(gastadoCat)} gastado${superado ? ' ⚠ Superado' : ''}
          </span>
          <span>${budgetCat > 0 ? `de ${formatearDinero(budgetCat)}` : 'Sin presupuesto'}</span>
        </div>
      </div>`;
  }).join('');

  contenedor.querySelectorAll('.campo-presupuesto').forEach(input => {
    input.addEventListener('change', async () => {
      const nombre = input.dataset.cat;
      const valor  = parseInt(input.value) || 0;
      if (!configMes.presupuesto) configMes.presupuesto = {};
      configMes.presupuesto[nombre] = valor;
      await guardarConfig(`fin_${mesActual}`, configMes);
      renderizarResumen();
    });
  });
}

/* ─── HISTORIAL DE GASTOS ─────────────────────────── */

function renderizarGastos() {
  const contenedor = document.getElementById('listaGastos');

  if (gastosMes.length === 0) {
    contenedor.innerHTML = `
      <div class="vacio">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
          <line x1="12" y1="1" x2="12" y2="23"/>
          <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
        </svg>
        <p>No hay gastos registrados este mes</p>
      </div>`;
    return;
  }

  const ordenados = [...gastosMes].sort((a, b) =>
    (b.fecha || '').localeCompare(a.fecha || '')
  );

  contenedor.innerHTML = ordenados.map(g => {
    const cat   = categorias.find(c => c.nombre === g.categoria);
    const color = cat ? cat.color : '#607d8b';
    return `
      <div class="lista-item" style="justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
          <div style="width:10px; height:10px; border-radius:50%; background:${color}; flex-shrink:0;"></div>
          <div style="min-width:0;">
            <div class="lista-item-titulo" style="font-size:0.9rem;">
              ${escaparHTML(g.descripcion || g.categoria)}
            </div>
            <div class="lista-item-subtitulo">
              ${escaparHTML(g.categoria)} · ${formatearFechaCorta(g.fecha)}
            </div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:10px; flex-shrink:0;">
          <strong style="color:var(--color-error);">−${formatearDinero(g.monto)}</strong>
          <button
            class="btn-eliminar-gasto"
            data-id="${g.id}"
            title="Eliminar gasto"
            style="background:none; border:none; cursor:pointer; color:var(--color-texto-suave); padding:4px; border-radius:6px; line-height:0;"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            </svg>
          </button>
        </div>
      </div>`;
  }).join('');

  contenedor.querySelectorAll('.btn-eliminar-gasto').forEach(btn => {
    btn.addEventListener('click', () => eliminarGasto(Number(btn.dataset.id)));
  });
}

/* ─── MODAL: REGISTRAR GASTO ─────────────────────── */

function configurarModalGasto() {
  document.getElementById('btnCerrarModalGasto').addEventListener('click', cerrarModalGasto);
  document.getElementById('formGasto').addEventListener('submit', guardarGasto);
  document.getElementById('modalGasto').addEventListener('click', e => {
    if (e.target === document.getElementById('modalGasto')) cerrarModalGasto();
  });
}

function abrirModalGasto() {
  const select = document.getElementById('gastoCat');
  select.innerHTML = categorias
    .map(c => `<option value="${escaparHTML(c.nombre)}">${escaparHTML(c.nombre)}</option>`)
    .join('');
  document.getElementById('gastoFecha').value = new Date().toISOString().slice(0, 10);
  document.getElementById('modalGasto').style.display = 'flex';
  document.getElementById('gastoMonto').focus();
}

function cerrarModalGasto() {
  document.getElementById('modalGasto').style.display = 'none';
  document.getElementById('formGasto').reset();
}

async function guardarGasto(e) {
  e.preventDefault();
  const monto = parseInt(document.getElementById('gastoMonto').value) || 0;
  if (monto <= 0) { document.getElementById('gastoMonto').focus(); return; }

  const gasto = {
    monto,
    categoria:   document.getElementById('gastoCat').value,
    descripcion: document.getElementById('gastoDesc').value.trim(),
    fecha:       document.getElementById('gastoFecha').value,
  };

  await guardar('finanzas', gasto);
  cerrarModalGasto();
  gastosMes = await cargarGastosMes();
  renderizarResumen();
  renderizarCategorias();
  renderizarGastos();
  await renderizarGraficos();
}

/* ─── ELIMINAR GASTO ──────────────────────────────── */

async function eliminarGasto(id) {
  if (!confirm('¿Eliminar este gasto?')) return;
  await eliminar('finanzas', id);
  gastosMes = await cargarGastosMes();
  renderizarResumen();
  renderizarCategorias();
  renderizarGastos();
  await renderizarGraficos();
}

/* ─── MODAL: GESTIONAR CATEGORÍAS ────────────────── */

function configurarModalCats() {
  document.getElementById('btnCerrarModalCats').addEventListener('click', cerrarModalCats);
  document.getElementById('formNuevaCat').addEventListener('submit', agregarCategoria);
  document.getElementById('modalCats').addEventListener('click', e => {
    if (e.target === document.getElementById('modalCats')) cerrarModalCats();
  });
}

function abrirModalCats() {
  renderizarListaCats();
  document.getElementById('modalCats').style.display = 'flex';
}

function cerrarModalCats() {
  document.getElementById('modalCats').style.display = 'none';
  document.getElementById('formNuevaCat').reset();
}

function renderizarListaCats() {
  const lista = document.getElementById('listaCatsModal');
  lista.innerHTML = categorias.map(cat => `
    <div style="display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid var(--color-borde);">
      <div style="width:14px; height:14px; border-radius:50%; background:${cat.color}; flex-shrink:0;"></div>
      <span style="flex:1; font-size:0.9rem;">${escaparHTML(cat.nombre)}</span>
      <button
        class="btn-eliminar-cat"
        data-nombre="${escaparHTML(cat.nombre)}"
        title="Eliminar categoría"
        style="background:none; border:none; cursor:pointer; color:var(--color-error); padding:4px; border-radius:6px; line-height:0;"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3,6 5,6 21,6"/>
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
        </svg>
      </button>
    </div>`).join('');

  lista.querySelectorAll('.btn-eliminar-cat').forEach(btn => {
    btn.addEventListener('click', () => eliminarCategoria(btn.dataset.nombre));
  });
}

async function agregarCategoria(e) {
  e.preventDefault();
  const nombre = document.getElementById('nuevaCatNombre').value.trim();
  if (!nombre) return;

  if (categorias.some(c => c.nombre.toLowerCase() === nombre.toLowerCase())) {
    alert('Ya existe una categoría con ese nombre.');
    return;
  }

  const color = PALETA[categorias.length % PALETA.length];
  categorias.push({ nombre, color });
  await guardarConfig('cats_finanzas', categorias);
  document.getElementById('formNuevaCat').reset();
  renderizarListaCats();
  renderizarCategorias();
}

async function eliminarCategoria(nombre) {
  const todosGastos  = await obtenerTodos('finanzas').catch(() => []);
  const gastosDeEsta = todosGastos.filter(g => g.categoria === nombre);

  if (gastosDeEsta.length > 0) {
    alert(`La categoría "${nombre}" tiene ${gastosDeEsta.length} gasto(s) registrado(s).\nPara eliminarla, primero borra esos gastos.`);
    return;
  }

  if (!confirm(`¿Eliminar la categoría "${nombre}"?`)) return;

  categorias = categorias.filter(c => c.nombre !== nombre);
  await guardarConfig('cats_finanzas', categorias);

  if (configMes.presupuesto && configMes.presupuesto[nombre] !== undefined) {
    delete configMes.presupuesto[nombre];
    await guardarConfig(`fin_${mesActual}`, configMes);
  }

  renderizarListaCats();
  renderizarCategorias();
  renderizarResumen();
}

/* ─── EXPORTAR A CSV ──────────────────────────────── */

function exportarCSV() {
  if (gastosMes.length === 0) {
    alert('No hay gastos para exportar en este mes.');
    return;
  }

  const filas = [
    ['Fecha', 'Categoría', 'Descripción', 'Monto'],
    ...gastosMes.map(g => [g.fecha || '', g.categoria || '', g.descripcion || '', g.monto || 0])
  ];

  /* El BOM (﻿) hace que Excel abra el CSV con tildes correctamente */
  const csv  = '﻿' + filas
    .map(fila => fila.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `gastos_${mesActual}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── UTILIDADES ─────────────────────────────────── */

/* Devuelve 'YYYY-MM' de una fecha usando hora local (evita desfase de zona horaria) */
function mesISO(fecha) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/* Devuelve un array con los últimos n meses en formato 'YYYY-MM', del más antiguo al más reciente */
function obtenerUltimosMeses(n) {
  const meses = [];
  const hoy   = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push(mesISO(d));
  }
  return meses;
}

/* Calcula la fecha sumando `meses` al mes actual y la devuelve como texto */
function calcularFechaFutura(meses) {
  const hoy    = new Date();
  const futura = new Date(hoy.getFullYear(), hoy.getMonth() + meses, 1);
  const nombres = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${nombres[futura.getMonth()]} ${futura.getFullYear()}`;
}

/* Formatea 'YYYY-MM' como 'Jun '26' para los ejes del gráfico de línea */
function formatearMesCorto(mesISOStr) {
  const [y, m] = mesISOStr.split('-');
  const nombres = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${nombres[parseInt(m) - 1]} '${y.slice(2)}`;
}

/* Formatea números grandes para los ejes de gráficos (1.2M, 500K, 15K) */
function formatearDineroCorto(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000)    return `${Math.round(n / 1000)}K`;
  return String(Math.round(n));
}

/* Devuelve los colores apropiados para los gráficos según el tema activo */
function coloresGrafico() {
  const esOscuro = document.documentElement.getAttribute('data-tema') === 'oscuro';
  return {
    texto: esOscuro ? '#aaaaaa' : '#555555',
    grid:  esOscuro ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
  };
}

/* Formatea una fecha 'YYYY-MM-DD' como '5 jun 2026' */
function formatearFechaCorta(fechaISO) {
  if (!fechaISO) return '';
  const [a, m, d] = fechaISO.split('-');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${a}`;
}

/* Escapa caracteres especiales para evitar XSS en el HTML generado */
function escaparHTML(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
