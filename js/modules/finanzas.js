/* =====================================================
   MÓDULO FINANZAS - finanzas.js
   Maneja presupuesto mensual, gastos por categoría,
   historial y exportación a CSV.
===================================================== */

/* Paleta de colores que se asignan automáticamente a las nuevas categorías */
const PALETA = [
  '#1a73e8','#0f9d58','#f9ab00','#e91e63',
  '#9c27b0','#00bcd4','#ff5722','#607d8b',
  '#795548','#4caf50','#ff9800','#2196f3'
];

/* Categorías que se crean la primera vez que se abre la app */
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

/* Estado del módulo */
let mesActual  = mesISO(new Date()); /* 'YYYY-MM', ej: '2026-06' */
let categorias = [];                 /* [{ nombre, color }, ...] */
let configMes  = {};                 /* { sueldo, presupuesto: { Cat: monto, ... } } */
let gastosMes  = [];                 /* gastos del mes seleccionado */

/* Cuando la página termina de cargarse */
document.addEventListener('DOMContentLoaded', async () => {
  await aplicarTemaGuardado();
  configurarBotonTema();
  configurarSelectorMes();
  configurarBotones();
  configurarModalGasto();
  configurarModalCats();
  await cargarTodo();
});

/* ─── CARGAR TODO ─────────────────────────────────── */

async function cargarTodo() {
  categorias = await cargarCategorias();
  configMes  = await cargarConfigMes();
  gastosMes  = await cargarGastosMes();
  renderizarTodo();
}

/* Carga las categorías desde la base de datos.
   Si es la primera vez, guarda las categorías por defecto. */
async function cargarCategorias() {
  const guardadas = await obtenerConfig('cats_finanzas').catch(() => null);
  if (guardadas && guardadas.length > 0) return guardadas;
  await guardarConfig('cats_finanzas', CATS_DEFAULT);
  return CATS_DEFAULT;
}

/* Carga la configuración del mes seleccionado (sueldo + presupuesto) */
async function cargarConfigMes() {
  const config = await obtenerConfig(`fin_${mesActual}`).catch(() => null);
  return config || { sueldo: 0, presupuesto: {} };
}

/* Carga solo los gastos que pertenecen al mes seleccionado */
async function cargarGastosMes() {
  const todos = await obtenerTodos('finanzas').catch(() => []);
  return todos.filter(g => g.fecha && g.fecha.startsWith(mesActual));
}

/* ─── RENDERIZAR ──────────────────────────────────── */

function renderizarTodo() {
  renderizarResumen();
  renderizarCategorias();
  renderizarGastos();
}

/* Dibuja los 4 números de resumen (presupuestado, gastado, disponible, sin distribuir) */
function renderizarResumen() {
  /* Rellena el campo de sueldo con el valor guardado */
  document.getElementById('campoSueldo').value = configMes.sueldo || '';

  const totalPresupuestado = Object.values(configMes.presupuesto || {})
    .reduce((suma, v) => suma + (v || 0), 0);
  const totalGastado = gastosMes.reduce((suma, g) => suma + (g.monto || 0), 0);
  const sueldo       = configMes.sueldo || 0;
  const disponible   = sueldo - totalGastado;
  const sinDistribuir = Math.max(0, sueldo - totalPresupuestado);

  document.getElementById('resumenMes').innerHTML = `
    <div class="resumen-finanzas">
      <div class="resumen-item">
        <span>Presupuestado</span>
        <strong>${formatearDinero(totalPresupuestado)}</strong>
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
      ${sinDistribuir > 0 ? `
      <div class="resumen-item">
        <span>Sin distribuir</span>
        <strong style="color:var(--color-alerta)">${formatearDinero(sinDistribuir)}</strong>
      </div>` : ''}
    </div>`;
}

/* Dibuja las barras de progreso de cada categoría con su input de presupuesto */
function renderizarCategorias() {
  const contenedor  = document.getElementById('listaCategoriasFin');
  const presupuesto = configMes.presupuesto || {};

  contenedor.innerHTML = categorias.map(cat => {
    const budgetCat  = presupuesto[cat.nombre] || 0;
    const gastadoCat = gastosMes
      .filter(g => g.categoria === cat.nombre)
      .reduce((s, g) => s + (g.monto || 0), 0);

    /* Porcentaje para la barra: máximo 100% visualmente */
    const porcentaje = budgetCat > 0 ? Math.min(100, (gastadoCat / budgetCat) * 100) : 0;
    const superado   = gastadoCat > budgetCat && budgetCat > 0;
    /* Color de la barra según qué tan cerca está del límite */
    const claseRelleno = porcentaje >= 100 ? 'peligro' : porcentaje >= 80 ? 'alerta' : '';

    return `
      <div style="margin-bottom:18px;">
        <!-- Nombre de la categoría + input del presupuesto -->
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
        <!-- Barra de progreso -->
        <div class="barra-progreso">
          <div class="barra-progreso-relleno ${claseRelleno}" style="width:${porcentaje}%;"></div>
        </div>
        <!-- Texto debajo de la barra -->
        <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:0.78rem; color:var(--color-texto-suave);">
          <span style="${superado ? 'color:var(--color-error); font-weight:700;' : ''}">
            ${formatearDinero(gastadoCat)} gastado${superado ? ' ⚠ Superado' : ''}
          </span>
          <span>${budgetCat > 0 ? `de ${formatearDinero(budgetCat)}` : 'Sin presupuesto'}</span>
        </div>
      </div>`;
  }).join('');

  /* Cada vez que el usuario cambia un valor de presupuesto, se guarda automáticamente */
  contenedor.querySelectorAll('.campo-presupuesto').forEach(input => {
    input.addEventListener('change', async () => {
      const nombre = input.dataset.cat;
      const valor  = parseInt(input.value) || 0;
      if (!configMes.presupuesto) configMes.presupuesto = {};
      configMes.presupuesto[nombre] = valor;
      await guardarConfig(`fin_${mesActual}`, configMes);
      /* Solo actualiza los totales sin redibujar toda la lista */
      renderizarResumen();
    });
  });
}

/* Dibuja la lista de gastos del mes, ordenados del más reciente al más antiguo */
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

  /* Evento de eliminar en cada fila */
  contenedor.querySelectorAll('.btn-eliminar-gasto').forEach(btn => {
    btn.addEventListener('click', () => eliminarGasto(Number(btn.dataset.id)));
  });
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
  /* También guarda al presionar Enter dentro del campo de sueldo */
  document.getElementById('campoSueldo').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') guardarSueldo();
  });
  document.getElementById('btnAgregarGasto').addEventListener('click', abrirModalGasto);
  document.getElementById('btnExportar').addEventListener('click', exportarCSV);
  document.getElementById('btnGestionarCats').addEventListener('click', abrirModalCats);
}

async function guardarSueldo() {
  const valor = parseInt(document.getElementById('campoSueldo').value) || 0;
  configMes.sueldo = valor;
  await guardarConfig(`fin_${mesActual}`, configMes);
  renderizarResumen();
}

/* ─── MODAL: REGISTRAR GASTO ─────────────────────── */

function configurarModalGasto() {
  document.getElementById('btnCerrarModalGasto').addEventListener('click', cerrarModalGasto);
  document.getElementById('formGasto').addEventListener('submit', guardarGasto);
  document.getElementById('modalGasto').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalGasto')) cerrarModalGasto();
  });
}

function abrirModalGasto() {
  /* Rellena el selector con las categorías actuales */
  const select = document.getElementById('gastoCat');
  select.innerHTML = categorias
    .map(c => `<option value="${escaparHTML(c.nombre)}">${escaparHTML(c.nombre)}</option>`)
    .join('');
  /* Fecha de hoy por defecto */
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
  /* Recarga solo los gastos y redibuja sin tocar la config del mes */
  gastosMes = await cargarGastosMes();
  renderizarResumen();
  renderizarCategorias();
  renderizarGastos();
}

/* ─── ELIMINAR GASTO ──────────────────────────────── */

async function eliminarGasto(id) {
  if (!confirm('¿Eliminar este gasto?')) return;
  await eliminar('finanzas', id);
  gastosMes = await cargarGastosMes();
  renderizarResumen();
  renderizarCategorias();
  renderizarGastos();
}

/* ─── MODAL: GESTIONAR CATEGORÍAS ────────────────── */

function configurarModalCats() {
  document.getElementById('btnCerrarModalCats').addEventListener('click', cerrarModalCats);
  document.getElementById('formNuevaCat').addEventListener('submit', agregarCategoria);
  document.getElementById('modalCats').addEventListener('click', (e) => {
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

/* Dibuja la lista de categorías dentro del modal */
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

/* Agrega una nueva categoría con color automático de la paleta */
async function agregarCategoria(e) {
  e.preventDefault();
  const nombre = document.getElementById('nuevaCatNombre').value.trim();
  if (!nombre) return;

  /* No permite duplicados (sin importar mayúsculas) */
  if (categorias.some(c => c.nombre.toLowerCase() === nombre.toLowerCase())) {
    alert('Ya existe una categoría con ese nombre.');
    return;
  }

  /* Asigna el siguiente color de la paleta de forma cíclica */
  const color = PALETA[categorias.length % PALETA.length];
  categorias.push({ nombre, color });
  await guardarConfig('cats_finanzas', categorias);

  document.getElementById('formNuevaCat').reset();
  renderizarListaCats();
  renderizarCategorias(); /* Actualiza la pantalla principal */
}

/* Elimina una categoría.
   Si tiene gastos registrados en cualquier mes, no la deja eliminar. */
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

  /* Si tenía presupuesto asignado, lo borra también */
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
    ...gastosMes.map(g => [
      g.fecha || '',
      g.categoria || '',
      g.descripcion || '',
      g.monto || 0,
    ])
  ];

  /* ﻿ es el BOM de UTF-8: hace que Excel abra el archivo con tildes correctamente */
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

/* Devuelve 'YYYY-MM' de una fecha */
function mesISO(fecha) {
  return fecha.toISOString().slice(0, 7);
}

/* Formatea una fecha 'YYYY-MM-DD' como '5 jun 2026' */
function formatearFechaCorta(fechaISO) {
  if (!fechaISO) return '';
  const [a, m, d] = fechaISO.split('-');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${a}`;
}

/* Escapa caracteres especiales para evitar problemas de seguridad */
function escaparHTML(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
