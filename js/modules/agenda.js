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

  const celda = document.createElement('div');
  celda.className = 'calendario-dia' +
    (otroMes  ? ' otro-mes'    : '') +
    (esHoy    ? ' hoy'         : '') +
    (esSel    ? ' seleccionado': '');
  celda.dataset.fecha = fecha;

  celda.innerHTML = `<span>${dia}</span>` +
    eventos.slice(0, 3).map(e =>
      `<div class="punto-evento" style="background:${e.color || '#1a73e8'};"></div>`
    ).join('');

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
  const titulo   = document.getElementById('tituloDia');
  const contenedor = document.getElementById('eventosDia');

  titulo.textContent = fecha === hoyISO()
    ? `Hoy — ${formatearFechaLarga(fecha)}`
    : formatearFechaLarga(fecha);

  if (eventos.length === 0) {
    contenedor.innerHTML = `
      <div class="vacio" style="padding:24px 20px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <p>Sin eventos. ¡Agrega uno!</p>
      </div>`;
    return;
  }

  /* Ordena por hora de inicio */
  eventos.sort((a, b) => (a.horaInicio || '').localeCompare(b.horaInicio || ''));

  contenedor.innerHTML = eventos.map(ev => `
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

  eventos.forEach(ev => {
    document.getElementById(`evento-${ev.id}`)
      ?.addEventListener('click', () => abrirModalEditar(ev));
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

function escaparHTML(texto) {
  return String(texto)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
