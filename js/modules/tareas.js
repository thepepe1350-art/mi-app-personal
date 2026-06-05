/* =====================================================
   MÓDULO TAREAS - tareas.js
   Maneja todo lo relacionado con las tareas:
   crear, editar, completar, eliminar y filtrar.
===================================================== */

/* Estado interno del módulo */
let filtroEstado    = 'todas';     /* todas | pendientes | completadas */
let filtroPrioridad = 'todas';     /* todas | alta | media | baja */
let tareaEditandoId = null;        /* null = tarea nueva, número = editar existente */

/* Cuando la página termina de cargarse */
document.addEventListener('DOMContentLoaded', async () => {
  await aplicarTemaGuardado();
  configurarBotonTema();
  configurarBotonesFiltro();
  configurarModal();
  await cargarTareas();
});

/* ─── CARGAR Y MOSTRAR TAREAS ─────────────────────── */

async function cargarTareas() {
  const todas  = await obtenerTodos('tareas').catch(() => []);
  const filtradas = aplicarFiltros(todas);
  renderizarTareas(filtradas, todas.length);
  actualizarSugerenciasCategorias(todas);
}

/* Filtra el array según el estado y la prioridad seleccionados */
function aplicarFiltros(tareas) {
  return tareas.filter(t => {
    const pasaEstado =
      filtroEstado === 'todas'       ? true :
      filtroEstado === 'pendientes'  ? !t.completada :
                                       t.completada;

    const pasaPrioridad =
      filtroPrioridad === 'todas' ? true : t.prioridad === filtroPrioridad;

    return pasaEstado && pasaPrioridad;
  });
}

/* Dibuja la lista de tareas en pantalla */
function renderizarTareas(tareas, totalTareas) {
  const contenedor = document.getElementById('listaTareas');
  const contador   = document.getElementById('textoContador');

  /* Actualiza el texto del contador */
  const pendientes = tareas.filter(t => !t.completada).length;
  contador.textContent = tareas.length === 0
    ? 'No hay tareas para mostrar'
    : `${tareas.length} tarea${tareas.length !== 1 ? 's' : ''} · ${pendientes} pendiente${pendientes !== 1 ? 's' : ''}`;

  /* Si no hay tareas, muestra mensaje vacío */
  if (tareas.length === 0) {
    contenedor.innerHTML = `
      <div class="vacio">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <polyline points="9,11 12,14 22,4"/>
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
        </svg>
        <p>${totalTareas === 0 ? 'Aún no tienes tareas. ¡Crea la primera!' : 'Ninguna tarea coincide con los filtros.'}</p>
      </div>`;
    return;
  }

  /* Ordena: primero las pendientes por prioridad, luego las completadas */
  const orden = { alta: 0, media: 1, baja: 2 };
  tareas.sort((a, b) => {
    if (a.completada !== b.completada) return a.completada ? 1 : -1;
    return (orden[a.prioridad] ?? 1) - (orden[b.prioridad] ?? 1);
  });

  contenedor.innerHTML = tareas.map(t => crearHTMLTarea(t)).join('');

  /* Agrega eventos a cada checkbox y a cada fila */
  tareas.forEach(t => {
    /* Checkbox: marcar/desmarcar completada */
    document.getElementById(`check-${t.id}`)
      ?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCompletar(t.id, !t.completada);
      });

    /* Fila: abrir el editor al tocar */
    document.getElementById(`tarea-${t.id}`)
      ?.addEventListener('click', () => abrirModalEditar(t));
  });
}

/* Genera el HTML de una tarea individual */
function crearHTMLTarea(tarea) {
  const claseFila       = tarea.completada ? 'lista-item lista-item-completado' : 'lista-item';
  const claseCheck      = tarea.completada ? 'checkbox-custom marcado' : 'checkbox-custom';
  const insignia        = tarea.prioridad ? `<span class="insignia insignia-${tarea.prioridad}">${capitalizar(tarea.prioridad)}</span>` : '';
  const fechaTexto      = tarea.fecha ? `<span>📅 ${formatearFechaCorta(tarea.fecha)}</span>` : '';
  const categoriaTexto  = tarea.categoria ? `<span>🏷 ${tarea.categoria}</span>` : '';
  const vencida         = !tarea.completada && tarea.fecha && tarea.fecha < hoyISO()
    ? '<span style="color:var(--color-error); font-weight:600;">Vencida</span>' : '';

  return `
    <div class="${claseFila}" id="tarea-${tarea.id}" style="cursor:pointer;">
      <!-- Checkbox para marcar como completada -->
      <div class="${claseCheck}" id="check-${tarea.id}" title="${tarea.completada ? 'Marcar como pendiente' : 'Marcar como completada'}"></div>

      <!-- Información de la tarea -->
      <div style="flex:1; min-width:0;">
        <div class="lista-item-titulo">${escaparHTML(tarea.titulo)}</div>
        <div class="lista-item-subtitulo" style="display:flex; gap:10px; flex-wrap:wrap; margin-top:4px;">
          ${insignia}
          ${fechaTexto}
          ${categoriaTexto}
          ${vencida}
        </div>
      </div>

      <!-- Flecha para indicar que se puede editar -->
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--color-borde); flex-shrink:0;">
        <polyline points="9,18 15,12 9,6"/>
      </svg>
    </div>`;
}

/* ─── MODAL: ABRIR / CERRAR ──────────────────────── */

function abrirModalNueva() {
  tareaEditandoId = null;
  limpiarFormulario();
  document.getElementById('modalTareasTitulo').textContent = 'Nueva tarea';
  document.getElementById('btnEliminarTarea').style.display = 'none';
  /* Pone la fecha de hoy por defecto */
  document.getElementById('tareaFecha').value = hoyISO();
  mostrarModal();
}

function abrirModalEditar(tarea) {
  tareaEditandoId = tarea.id;
  document.getElementById('tareaId').value         = tarea.id;
  document.getElementById('tareaTitulo').value     = tarea.titulo     || '';
  document.getElementById('tareaDescripcion').value= tarea.descripcion|| '';
  document.getElementById('tareaFecha').value      = tarea.fecha      || '';
  document.getElementById('tareaPrioridad').value  = tarea.prioridad  || 'media';
  document.getElementById('tareaCategoria').value  = tarea.categoria  || '';
  document.getElementById('modalTareasTitulo').textContent = 'Editar tarea';
  document.getElementById('btnEliminarTarea').style.display = '';
  mostrarModal();
}

function mostrarModal() {
  document.getElementById('modalTarea').style.display = 'flex';
  document.getElementById('tareaTitulo').focus();
}

function cerrarModal() {
  document.getElementById('modalTarea').style.display = 'none';
  limpiarFormulario();
}

function limpiarFormulario() {
  document.getElementById('formTarea').reset();
  document.getElementById('tareaId').value = '';
  tareaEditandoId = null;
}

/* ─── GUARDAR TAREA ──────────────────────────────── */

async function guardarTarea(evento) {
  evento.preventDefault();

  const titulo = document.getElementById('tareaTitulo').value.trim();
  if (!titulo) {
    document.getElementById('tareaTitulo').focus();
    return;
  }

  const tarea = {
    titulo,
    descripcion: document.getElementById('tareaDescripcion').value.trim(),
    fecha:       document.getElementById('tareaFecha').value,
    prioridad:   document.getElementById('tareaPrioridad').value,
    categoria:   document.getElementById('tareaCategoria').value.trim(),
    completada:  false,
  };

  if (tareaEditandoId !== null) {
    /* Editar: conserva el estado "completada" actual */
    const existente = await obtenerPorId('tareas', tareaEditandoId).catch(() => null);
    tarea.id        = tareaEditandoId;
    tarea.completada= existente ? existente.completada : false;
  }

  await guardar('tareas', tarea);
  cerrarModal();
  await cargarTareas();
}

/* ─── MARCAR COMO COMPLETADA ─────────────────────── */

async function toggleCompletar(id, completada) {
  const tarea = await obtenerPorId('tareas', id).catch(() => null);
  if (!tarea) return;
  tarea.completada = completada;
  await guardar('tareas', tarea);
  await cargarTareas();
}

/* ─── ELIMINAR TAREA ─────────────────────────────── */

async function eliminarTarea() {
  if (tareaEditandoId === null) return;
  const confirmar = confirm('¿Eliminar esta tarea? Esta acción no se puede deshacer.');
  if (!confirmar) return;
  await eliminar('tareas', tareaEditandoId);
  cerrarModal();
  await cargarTareas();
}

/* ─── FILTROS ────────────────────────────────────── */

function configurarBotonesFiltro() {
  /* Filtros de estado */
  document.querySelectorAll('[data-filtro-estado]').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('[data-filtro-estado]').forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');
      filtroEstado = btn.dataset.filtroEstado;
      await cargarTareas();
    });
  });

  /* Filtros de prioridad */
  document.querySelectorAll('[data-filtro-prioridad]').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('[data-filtro-prioridad]').forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');
      filtroPrioridad = btn.dataset.filtroPrioridad;
      await cargarTareas();
    });
  });
}

/* ─── CONFIGURAR MODAL Y EVENTOS ─────────────────── */

function configurarModal() {
  document.getElementById('btnAgregarTarea').addEventListener('click', abrirModalNueva);
  document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
  document.getElementById('btnEliminarTarea').addEventListener('click', eliminarTarea);
  document.getElementById('formTarea').addEventListener('submit', guardarTarea);

  /* Cerrar modal al tocar el fondo oscuro */
  document.getElementById('modalTarea').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalTarea')) cerrarModal();
  });
}

/* ─── SUGERENCIAS DE CATEGORÍAS ──────────────────── */

/* Rellena el datalist con categorías usadas previamente */
function actualizarSugerenciasCategorias(tareas) {
  const categorias = [...new Set(tareas.map(t => t.categoria).filter(Boolean))];
  const datalist   = document.getElementById('listaCategorias');
  datalist.innerHTML = categorias.map(c => `<option value="${escaparHTML(c)}">`).join('');
}

/* ─── UTILIDADES ─────────────────────────────────── */

/* Devuelve la fecha de hoy en formato YYYY-MM-DD */
function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

/* Formatea una fecha YYYY-MM-DD como "5 jun 2026" */
function formatearFechaCorta(fechaISO) {
  if (!fechaISO) return '';
  const [a, m, d] = fechaISO.split('-');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${a}`;
}

/* Pone la primera letra en mayúscula */
function capitalizar(texto) {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : '';
}

/* Escapa caracteres especiales para evitar problemas de seguridad */
function escaparHTML(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
