/* =====================================================
   MÓDULO NOTAS - notas.js
   Maneja todo lo relacionado con las notas:
   crear, editar, eliminar, anclar, buscar y filtrar.
===================================================== */

/* Estado interno del módulo */
let textoBusqueda   = '';   /* texto que el usuario escribe en el buscador */
let etiquetaActiva  = null; /* null = todas, o el nombre de una etiqueta */
let notaEditandoId  = null; /* null = nota nueva, número = editar existente */

/* Cuando la página termina de cargarse */
document.addEventListener('DOMContentLoaded', async () => {
  await aplicarTemaGuardado();
  configurarBotonTema();
  configurarBusqueda();
  configurarModal();
  await cargarNotas();
});

/* ─── CARGAR Y MOSTRAR NOTAS ─────────────────────── */

async function cargarNotas() {
  const todas     = await obtenerTodos('notas').catch(() => []);
  const filtradas = aplicarFiltros(todas);
  renderizarNotas(filtradas, todas.length);
  renderizarEtiquetas(todas);
}

/* Filtra el array según búsqueda y etiqueta activa */
function aplicarFiltros(notas) {
  return notas.filter(n => {
    /* Filtro por texto: busca en título y contenido */
    const texto = textoBusqueda.toLowerCase();
    const pasaBusqueda = !texto ||
      (n.titulo   && n.titulo.toLowerCase().includes(texto)) ||
      (n.contenido && n.contenido.toLowerCase().includes(texto));

    /* Filtro por etiqueta */
    const pasaEtiqueta = !etiquetaActiva ||
      (n.etiquetas && n.etiquetas.includes(etiquetaActiva));

    return pasaBusqueda && pasaEtiqueta;
  });
}

/* Dibuja las notas como tarjetas en pantalla */
function renderizarNotas(notas, totalNotas) {
  const contenedor = document.getElementById('cuadriculaNotas');
  const contador   = document.getElementById('textoContador');

  contador.textContent = notas.length === 0
    ? 'No hay notas para mostrar'
    : `${notas.length} nota${notas.length !== 1 ? 's' : ''}`;

  if (notas.length === 0) {
    contenedor.innerHTML = `
      <div class="vacio">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        <p>${totalNotas === 0 ? '¡Crea tu primera nota!' : 'Ninguna nota coincide con la búsqueda.'}</p>
      </div>`;
    return;
  }

  /* Ordena: ancladas primero, luego por fecha (más reciente arriba) */
  notas.sort((a, b) => {
    if (a.anclada !== b.anclada) return a.anclada ? -1 : 1;
    return (b.fechaCreacion || 0) - (a.fechaCreacion || 0);
  });

  contenedor.innerHTML = notas.map(n => crearHTMLNota(n)).join('');

  /* Agrega el evento de clic a cada tarjeta */
  notas.forEach(n => {
    document.getElementById(`nota-${n.id}`)
      ?.addEventListener('click', () => abrirModalEditar(n));
  });
}

/* Genera el HTML de una tarjeta de nota */
function crearHTMLNota(nota) {
  /* Recorta el contenido a 120 caracteres para la vista previa */
  const preview = nota.contenido
    ? (nota.contenido.length > 120
        ? escaparHTML(nota.contenido.slice(0, 120)) + '…'
        : escaparHTML(nota.contenido))
    : '<span style="color:var(--color-texto-suave); font-style:italic;">Sin contenido</span>';

  /* Genera los chips de etiquetas */
  const chipsEtiquetas = (nota.etiquetas || [])
    .map(e => `<span class="chip-etiqueta">${escaparHTML(e)}</span>`)
    .join('');

  /* Icono de pin si está anclada */
  const iconPin = nota.anclada
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="var(--color-primario)" stroke="var(--color-primario)" stroke-width="1">
         <path d="M12 2l3 7h6l-5 4 2 7-6-4-6 4 2-7L3 9h6z"/>
       </svg>`
    : '';

  const fechaTexto = nota.fechaCreacion
    ? formatearFechaCorta(nota.fechaCreacion)
    : '';

  return `
    <div class="tarjeta-nota${nota.anclada ? ' anclada' : ''}" id="nota-${nota.id}">
      <!-- Cabecera: título e icono de pin -->
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px; margin-bottom:8px;">
        <div class="nota-titulo">${escaparHTML(nota.titulo)}</div>
        <div style="flex-shrink:0; margin-top:2px;">${iconPin}</div>
      </div>

      <!-- Vista previa del contenido -->
      <div class="nota-preview">${preview}</div>

      <!-- Etiquetas y fecha -->
      <div style="margin-top:10px; display:flex; flex-wrap:wrap; gap:5px;">
        ${chipsEtiquetas}
      </div>
      ${fechaTexto ? `<div class="nota-fecha">${fechaTexto}</div>` : ''}
    </div>`;
}

/* ─── FILTRO DE ETIQUETAS ────────────────────────── */

/* Muestra los botones de etiqueta según las notas existentes */
function renderizarEtiquetas(notas) {
  /* Recoge todas las etiquetas únicas de todas las notas */
  const todasLasEtiquetas = [...new Set(
    notas.flatMap(n => n.etiquetas || [])
  )].sort();

  const contenedorFiltro = document.getElementById('filtroEtiquetas');
  const listaEtiquetas   = document.getElementById('listaEtiquetasFiltro');

  if (todasLasEtiquetas.length === 0) {
    contenedorFiltro.style.display = 'none';
    return;
  }

  contenedorFiltro.style.display = '';

  /* Botón "Todas" + uno por cada etiqueta */
  const botones = [
    { valor: null, texto: 'Todas' },
    ...todasLasEtiquetas.map(e => ({ valor: e, texto: e }))
  ];

  listaEtiquetas.innerHTML = botones.map(b => `
    <button
      class="btn-filtro${etiquetaActiva === b.valor ? ' activo' : ''}"
      data-etiqueta="${b.valor === null ? '__todas__' : escaparHTML(b.valor)}"
    >${escaparHTML(b.texto)}</button>
  `).join('');

  listaEtiquetas.querySelectorAll('[data-etiqueta]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const val = btn.dataset.etiqueta;
      etiquetaActiva = val === '__todas__' ? null : val;
      await cargarNotas();
    });
  });
}

/* ─── BÚSQUEDA EN TIEMPO REAL ────────────────────── */

function configurarBusqueda() {
  document.getElementById('campoBusqueda').addEventListener('input', async (e) => {
    textoBusqueda = e.target.value.trim();
    await cargarNotas();
  });
}

/* ─── MODAL: ABRIR / CERRAR ──────────────────────── */

function abrirModalNueva() {
  notaEditandoId = null;
  limpiarFormulario();
  document.getElementById('modalNotasTitulo').textContent = 'Nueva nota';
  document.getElementById('btnEliminarNota').style.display = 'none';
  mostrarModal();
}

function abrirModalEditar(nota) {
  notaEditandoId = nota.id;
  document.getElementById('notaId').value        = nota.id;
  document.getElementById('notaTitulo').value    = nota.titulo    || '';
  document.getElementById('notaContenido').value = nota.contenido || '';
  document.getElementById('notaEtiquetas').value = (nota.etiquetas || []).join(', ');
  document.getElementById('notaAnclada').checked = !!nota.anclada;
  document.getElementById('modalNotasTitulo').textContent = 'Editar nota';
  document.getElementById('btnEliminarNota').style.display = '';
  mostrarModal();
}

function mostrarModal() {
  document.getElementById('modalNota').style.display = 'flex';
  document.getElementById('notaTitulo').focus();
}

function cerrarModal() {
  document.getElementById('modalNota').style.display = 'none';
  limpiarFormulario();
}

function limpiarFormulario() {
  document.getElementById('formNota').reset();
  document.getElementById('notaId').value = '';
  notaEditandoId = null;
}

/* ─── GUARDAR NOTA ───────────────────────────────── */

async function guardarNota(evento) {
  evento.preventDefault();

  const titulo = document.getElementById('notaTitulo').value.trim();
  if (!titulo) {
    document.getElementById('notaTitulo').focus();
    return;
  }

  /* Convierte el texto "trabajo, ideas, urgente" en ["trabajo","ideas","urgente"] */
  const etiquetasTexto = document.getElementById('notaEtiquetas').value;
  const etiquetas = etiquetasTexto
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length > 0);

  const nota = {
    titulo,
    contenido:    document.getElementById('notaContenido').value.trim(),
    etiquetas,
    anclada:      document.getElementById('notaAnclada').checked,
    fechaCreacion: notaEditandoId === null ? Date.now() : undefined,
  };

  if (notaEditandoId !== null) {
    /* Al editar, conserva la fecha original */
    const existente = await obtenerPorId('notas', notaEditandoId).catch(() => null);
    nota.id           = notaEditandoId;
    nota.fechaCreacion = existente ? existente.fechaCreacion : Date.now();
  }

  await guardar('notas', nota);
  cerrarModal();
  await cargarNotas();
}

/* ─── ELIMINAR NOTA ──────────────────────────────── */

async function eliminarNota() {
  if (notaEditandoId === null) return;
  const confirmar = confirm('¿Eliminar esta nota? Esta acción no se puede deshacer.');
  if (!confirmar) return;
  await eliminar('notas', notaEditandoId);
  cerrarModal();
  await cargarNotas();
}

/* ─── CONFIGURAR MODAL Y EVENTOS ─────────────────── */

function configurarModal() {
  document.getElementById('btnAgregarNota').addEventListener('click', abrirModalNueva);
  document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
  document.getElementById('btnEliminarNota').addEventListener('click', eliminarNota);
  document.getElementById('formNota').addEventListener('submit', guardarNota);

  /* Cerrar al tocar el fondo oscuro */
  document.getElementById('modalNota').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalNota')) cerrarModal();
  });
}

/* ─── UTILIDADES ─────────────────────────────────── */

/* Formatea un timestamp como "5 jun 2026" */
function formatearFechaCorta(timestamp) {
  const fecha = new Date(timestamp);
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${fecha.getDate()} ${meses[fecha.getMonth()]} ${fecha.getFullYear()}`;
}

/* Escapa caracteres especiales para evitar problemas de seguridad */
function escaparHTML(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
