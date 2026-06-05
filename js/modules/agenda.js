/* =====================================================
   MÓDULO AGENDA - agenda.js
   Calendario mensual con eventos: crear, editar,
   eliminar. Guarda en IndexedDB.
===================================================== */

/* Colores disponibles para los eventos */
const COLORES_EVENTO = [
  { hex: '#1a73e8', nombre: 'Azul'    },
  { hex: '#0f9d58', nombre: 'Verde'   },
  { hex: '#e91e63', nombre: 'Rosa'    },
  { hex: '#f9ab00', nombre: 'Amarillo'},
  { hex: '#9c27b0', nombre: 'Morado'  },
  { hex: '#ff5722', nombre: 'Naranja' },
];

/* Estado del módulo */
let mesViendose    = new Date();        /* primer día del mes actual en pantalla */
let diaSeleccionado = hoyISO();         /* 'YYYY-MM-DD' del día seleccionado */
let eventoEditandoId = null;
let colorSeleccionado = COLORES_EVENTO[0].hex;
let todosLosEventos = [];               /* caché de eventos cargados */
let todasLasTareas  = [];              /* caché de tareas con fecha */

document.addEventListener('DOMContentLoaded', async () => {
  mesViendose = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  await aplicarTemaGuardado();
  configurarBotonTema();
  configurarNavMes();
  configurarModal();
  await cargarEventos();
});

/* ─── CARGAR EVENTOS ──────────────────────────────── */

async function cargarEventos() {
  todosLosEventos = await obtenerTodos('eventos').catch(() => []);
  todasLasTareas  = (await obtenerTodos('tareas').catch(() => [])).filter(t => t.fecha);
  renderizarCalendario();
  renderizarEventosDia(diaSeleccionado);
}

/* ─── CALENDARIO ──────────────────────────────────── */

function renderizarCalendario() {
  const anio = mesViendose.getFullYear();
  const mes  = mesViendose.getMonth(); /* 0-11 */

  /* Actualiza el título del mes */
  document.getElementById('tituloMes').textContent =
    mesViendose.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  /* Primer día del mes: ajusta para que la semana empiece en lunes (0=lun) */
  const primerDia  = new Date(anio, mes, 1);
  const ultimoDia  = new Date(anio, mes + 1, 0).getDate();
  let inicioGrid   = (primerDia.getDay() + 6) % 7; /* lunes = 0 */

  const grid = document.getElementById('calendarioGrid');
  grid.innerHTML = '';

  /* Días del mes anterior para completar la primera fila */
  const diasMesAnterior = new Date(anio, mes, 0).getDate();
  for (let i = inicioGrid - 1; i >= 0; i--) {
    grid.appendChild(crearCeldaDia(diasMesAnterior - i, anio, mes - 1, true));
  }

  /* Días del mes actual */
  for (let d = 1; d <= ultimoDia; d++) {
    grid.appendChild(crearCeldaDia(d, anio, mes, false));
  }

  /* Días del mes siguiente para completar la última fila */
  const celdas   = inicioGrid + ultimoDia;
  const restantes = celdas % 7 === 0 ? 0 : 7 - (celdas % 7);
  for (let d = 1; d <= restantes; d++) {
    grid.appendChild(crearCeldaDia(d, anio, mes + 1, true));
  }
}

/* Crea una celda del calendario para un día */
function crearCeldaDia(dia, anio, mes, otroMes) {
  const fecha   = fechaISO(anio, mes, dia);
  const esHoy   = fecha === hoyISO();
  const esSel   = fecha === diaSeleccionado;
  const eventos = todosLosEventos.filter(e => e.fecha === fecha);
  const tareas  = todasLasTareas.filter(t => t.fecha === fecha);

  const celda = document.createElement('div');
  celda.className = 'calendario-dia' +
    (otroMes  ? ' otro-mes'    : '') +
    (esHoy    ? ' hoy'         : '') +
    (esSel    ? ' seleccionado': '');
  celda.dataset.fecha = fecha;

  /* Etiquetas con título (hasta 3 en total entre eventos y tareas) */
  const etiquetasEventos = eventos.slice(0, 3).map(e =>
    `<div class="etiqueta-cal" style="background:${e.color || '#1a73e8'};">${escaparHTML(e.titulo)}</div>`
  );
  const espacioRestante = 3 - etiquetasEventos.length;
  const etiquetasTareas = tareas.slice(0, espacioRestante).map(t =>
    `<div class="etiqueta-cal" style="background:${t.completada ? '#9ca3af' : '#f59e0b'};">${escaparHTML(t.titulo)}</div>`
  );

  celda.innerHTML = `<span>${dia}</span>` + etiquetasEventos.join('') + etiquetasTareas.join('');

  celda.addEventListener('click', () => {
    diaSeleccionado = fecha;
    renderizarCalendario(); /* redibuja para resaltar el día */
    renderizarEventosDia(fecha);
  });

  return celda;
}

/* ─── EVENTOS DEL DÍA ─────────────────────────────── */

function renderizarEventosDia(fecha) {
  const eventos  = todosLosEventos.filter(e => e.fecha === fecha);
  const tareas   = todasLasTareas.filter(t => t.fecha === fecha);
  const titulo   = document.getElementById('tituloDia');
  const contenedor = document.getElementById('eventosDia');

  titulo.textContent = fecha === hoyISO()
    ? `Hoy — ${formatearFechaLarga(fecha)}`
    : formatearFechaLarga(fecha);

  if (eventos.length === 0 && tareas.length === 0) {
    contenedor.innerHTML = `
      <div class="vacio" style="padding:24px 20px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <p>Sin eventos ni tareas. ¡Agrega uno!</p>
      </div>`;
    return;
  }

  let html = '';

  /* ── Eventos ── */
  if (eventos.length > 0) {
    eventos.sort((a, b) => (a.horaInicio || '').localeCompare(b.horaInicio || ''));
    html += eventos.map(ev => `
      <div class="lista-item" id="evento-${ev.id}" style="border-left:4px solid ${ev.color || '#1a73e8'}; cursor:pointer;">
        <div style="flex:1; min-width:0;">
          <div class="lista-item-titulo">${escaparHTML(ev.titulo)}</div>
          <div class="lista-item-subtitulo">
            ${ev.horaInicio ? `${ev.horaInicio}${ev.horaFin ? ' – ' + ev.horaFin : ''}` : 'Sin hora'}
            ${ev.descripcion ? ' · ' + escaparHTML(ev.descripcion.slice(0,50)) : ''}
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--color-borde); flex-shrink:0;"><polyline points="9,18 15,12 9,6"/></svg>
      </div>`).join('');
  }

  /* ── Tareas ── */
  if (tareas.length > 0) {
    if (eventos.length > 0) {
      html += `<div style="font-size:0.75rem; font-weight:600; color:var(--color-texto-suave); padding:10px 12px 4px; text-transform:uppercase; letter-spacing:0.05em;">Tareas</div>`;
    }
    const coloresPrioridad = { alta: '#dc2626', media: '#d97706', baja: '#059669' };
    html += tareas.map(t => `
      <div class="lista-item${t.completada ? ' lista-item-completado' : ''}" id="agenda-tarea-${t.id}" style="border-left:4px solid ${t.completada ? '#9ca3af' : '#f59e0b'};">
        <div class="checkbox-custom${t.completada ? ' marcado' : ''}" id="agenda-check-${t.id}" title="${t.completada ? 'Marcar como pendiente' : 'Marcar como completada'}" style="cursor:pointer; flex-shrink:0;"></div>
        <div style="flex:1; min-width:0;">
          <div class="lista-item-titulo">${escaparHTML(t.titulo)}</div>
          <div class="lista-item-subtitulo" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:3px;">
            ${t.prioridad ? `<span style="color:${coloresPrioridad[t.prioridad] || '#6b7280'}; font-weight:600;">${capitalizar(t.prioridad)}</span>` : ''}
            ${t.categoria ? `<span>🏷 ${escaparHTML(t.categoria)}</span>` : ''}
          </div>
        </div>
      </div>`).join('');
  }

  contenedor.innerHTML = html;

  /* Eventos: abrir modal al hacer clic */
  eventos.forEach(ev => {
    document.getElementById(`evento-${ev.id}`)
      ?.addEventListener('click', () => abrirModalEditar(ev));
  });

  /* Tareas: toggle completada al hacer clic en el checkbox */
  tareas.forEach(t => {
    document.getElementById(`agenda-check-${t.id}`)
      ?.addEventListener('click', async () => {
        const tarea = await obtenerPorId('tareas', t.id).catch(() => null);
        if (!tarea) return;
        tarea.completada = !tarea.completada;
        await guardar('tareas', tarea);
        await cargarEventos();
      });
  });
}

/* ─── NAVEGACIÓN DEL MES ──────────────────────────── */

function configurarNavMes() {
  document.getElementById('btnMesAnterior').addEventListener('click', async () => {
    mesViendose = new Date(mesViendose.getFullYear(), mesViendose.getMonth() - 1, 1);
    renderizarCalendario();
  });
  document.getElementById('btnMesSiguiente').addEventListener('click', async () => {
    mesViendose = new Date(mesViendose.getFullYear(), mesViendose.getMonth() + 1, 1);
    renderizarCalendario();
  });
}

/* ─── MODAL ───────────────────────────────────────── */

function configurarModal() {
  /* Selector de colores */
  const selectorColor = document.getElementById('selectorColor');
  selectorColor.innerHTML = COLORES_EVENTO.map(c => `
    <div
      class="bola-color${c.hex === colorSeleccionado ? ' seleccionado' : ''}"
      data-color="${c.hex}"
      title="${c.nombre}"
      style="background:${c.hex};"
    ></div>`).join('');
  selectorColor.querySelectorAll('.bola-color').forEach(b => {
    b.addEventListener('click', () => {
      colorSeleccionado = b.dataset.color;
      selectorColor.querySelectorAll('.bola-color').forEach(x => x.classList.remove('seleccionado'));
      b.classList.add('seleccionado');
    });
  });

  document.getElementById('btnNuevoEvento').addEventListener('click',   abrirModalNuevo);
  document.getElementById('btnCerrarModalEvento').addEventListener('click', cerrarModal);
  document.getElementById('btnEliminarEvento').addEventListener('click', eliminarEvento);
  document.getElementById('formEvento').addEventListener('submit',       guardarEvento);
  document.getElementById('modalEvento').addEventListener('click', e => {
    if (e.target === document.getElementById('modalEvento')) cerrarModal();
  });
}

function abrirModalNuevo() {
  eventoEditandoId = null;
  document.getElementById('formEvento').reset();
  document.getElementById('eventoId').value    = '';
  document.getElementById('eventoFecha').value = diaSeleccionado;
  document.getElementById('modalEventoTitulo').textContent = 'Nuevo evento';
  document.getElementById('btnEliminarEvento').style.display = 'none';
  seleccionarColor(COLORES_EVENTO[0].hex);
  document.getElementById('modalEvento').style.display = 'flex';
  document.getElementById('eventoTitulo').focus();
}

function abrirModalEditar(ev) {
  eventoEditandoId = ev.id;
  document.getElementById('eventoId').value          = ev.id;
  document.getElementById('eventoTitulo').value      = ev.titulo      || '';
  document.getElementById('eventoFecha').value       = ev.fecha       || '';
  document.getElementById('eventoHoraInicio').value  = ev.horaInicio  || '';
  document.getElementById('eventoHoraFin').value     = ev.horaFin     || '';
  document.getElementById('eventoDescripcion').value = ev.descripcion || '';
  document.getElementById('modalEventoTitulo').textContent = 'Editar evento';
  document.getElementById('btnEliminarEvento').style.display = '';
  seleccionarColor(ev.color || COLORES_EVENTO[0].hex);
  document.getElementById('modalEvento').style.display = 'flex';
  document.getElementById('eventoTitulo').focus();
}

function seleccionarColor(hex) {
  colorSeleccionado = hex;
  document.querySelectorAll('.bola-color').forEach(b => {
    b.classList.toggle('seleccionado', b.dataset.color === hex);
  });
}

function cerrarModal() {
  document.getElementById('modalEvento').style.display = 'none';
  eventoEditandoId = null;
}

async function guardarEvento(e) {
  e.preventDefault();
  const titulo = document.getElementById('eventoTitulo').value.trim();
  if (!titulo) { document.getElementById('eventoTitulo').focus(); return; }

  const evento = {
    titulo,
    fecha:       document.getElementById('eventoFecha').value,
    horaInicio:  document.getElementById('eventoHoraInicio').value,
    horaFin:     document.getElementById('eventoHoraFin').value,
    descripcion: document.getElementById('eventoDescripcion').value.trim(),
    color:       colorSeleccionado,
  };
  if (eventoEditandoId !== null) evento.id = eventoEditandoId;

  await guardar('eventos', evento);
  cerrarModal();
  await cargarEventos();
}

async function eliminarEvento() {
  if (eventoEditandoId === null) return;
  if (!confirm('¿Eliminar este evento?')) return;
  await eliminar('eventos', eventoEditandoId);
  cerrarModal();
  await cargarEventos();
}

/* ─── UTILIDADES ─────────────────────────────────── */

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

/* Construye 'YYYY-MM-DD' desde componentes (maneja meses negativos/superiores a 11) */
function fechaISO(anio, mes, dia) {
  return new Date(anio, mes, dia).toISOString().slice(0, 10);
}

function formatearFechaLarga(fechaISO) {
  const [a, m, d] = fechaISO.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
}

function capitalizar(texto) {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : '';
}

function escaparHTML(texto) {
  return String(texto)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
