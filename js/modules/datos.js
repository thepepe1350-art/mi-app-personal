/* =====================================================
   MÓDULO DATOS - datos.js
   Carga archivos Excel o CSV, los muestra como tabla
   con búsqueda, ordenación por columna y paginación.
===================================================== */

/* Estado del módulo */
let filasTodas     = [];   /* todos los datos del archivo */
let filasVista     = [];   /* filas después de filtrar */
let columnas       = [];   /* nombres de las columnas */
let columnaOrden   = null; /* columna por la que se ordena */
let ordenAsc       = true; /* dirección del orden */
let paginaActual   = 0;
const FILAS_PAGINA = 50;

document.addEventListener('DOMContentLoaded', async () => {
  await aplicarTemaGuardado();
  configurarBotonTema();
  configurarSubida();
  configurarControles();
});

/* ─── CARGA DE ARCHIVO ────────────────────────────── */

function configurarSubida() {
  const input   = document.getElementById('inputArchivo');
  const zonaDrop = document.getElementById('zonaDrop');

  input.addEventListener('change', () => {
    if (input.files[0]) procesarArchivo(input.files[0]);
  });

  /* Drag & drop */
  zonaDrop.addEventListener('dragover', e => { e.preventDefault(); zonaDrop.classList.add('arrastrando'); });
  zonaDrop.addEventListener('dragleave', () => zonaDrop.classList.remove('arrastrando'));
  zonaDrop.addEventListener('drop', e => {
    e.preventDefault();
    zonaDrop.classList.remove('arrastrando');
    const archivo = e.dataTransfer.files[0];
    if (archivo) procesarArchivo(archivo);
  });
}

function procesarArchivo(archivo) {
  const lector = new FileReader();
  lector.onload = (e) => {
    try {
      const datos = e.target.result;
      const libro = XLSX.read(datos, { type: 'array' });
      const hoja  = libro.Sheets[libro.SheetNames[0]];
      const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '' });

      if (filas.length < 2) { alert('El archivo parece estar vacío o no tiene datos.'); return; }

      columnas   = filas[0].map(String);
      filasTodas = filas.slice(1).map(fila =>
        /* Convierte cada fila (array) en un objeto { columna: valor } */
        Object.fromEntries(columnas.map((col, i) => [col, fila[i] ?? '']))
      );

      document.getElementById('infoArchivo').textContent =
        `${archivo.name} · ${filasTodas.length} filas`;

      document.getElementById('zonaSubida').style.display  = 'none';
      document.getElementById('controles').style.display   = '';

      paginaActual  = 0;
      columnaOrden  = null;
      aplicarFiltroYRender();
    } catch {
      alert('No se pudo leer el archivo. Verifica que sea un Excel o CSV válido.');
    }
  };
  lector.readAsArrayBuffer(archivo);
}

/* ─── CONTROLES ───────────────────────────────────── */

function configurarControles() {
  document.getElementById('campoBusquedaDatos').addEventListener('input', () => {
    paginaActual = 0;
    aplicarFiltroYRender();
  });

  document.getElementById('btnExportarDatos').addEventListener('click', exportarCSV);

  document.getElementById('btnNuevoArchivo').addEventListener('click', () => {
    document.getElementById('zonaSubida').style.display = '';
    document.getElementById('controles').style.display  = 'none';
    filasTodas = []; filasVista = []; columnas = [];
    document.getElementById('inputArchivo').value = '';
  });

  document.getElementById('btnPagAnterior').addEventListener('click', () => {
    if (paginaActual > 0) { paginaActual--; renderizarTabla(); }
  });
  document.getElementById('btnPagSiguiente').addEventListener('click', () => {
    if ((paginaActual + 1) * FILAS_PAGINA < filasVista.length) { paginaActual++; renderizarTabla(); }
  });
}

/* Filtra las filas según el texto del buscador */
function aplicarFiltroYRender() {
  const texto = document.getElementById('campoBusquedaDatos').value.toLowerCase();
  filasVista = texto
    ? filasTodas.filter(fila =>
        Object.values(fila).some(v => String(v).toLowerCase().includes(texto))
      )
    : [...filasTodas];

  if (columnaOrden) ordenarFilas();
  renderizarTabla();
}

/* ─── TABLA ───────────────────────────────────────── */

function renderizarTabla() {
  renderizarEncabezado();
  renderizarCuerpo();
  renderizarPaginacion();
}

function renderizarEncabezado() {
  const thead = document.getElementById('tablaDatosHead');
  thead.innerHTML = '<tr>' + columnas.map(col => {
    const estaOrdenando = columnaOrden === col;
    const flecha = estaOrdenando ? (ordenAsc ? ' ↑' : ' ↓') : '';
    return `<th data-col="${escaparHTML(col)}" style="${estaOrdenando ? 'color:var(--color-primario);' : ''}">${escaparHTML(col)}${flecha}</th>`;
  }).join('') + '</tr>';

  /* Clic en encabezado para ordenar */
  thead.querySelectorAll('th').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (columnaOrden === col) {
        ordenAsc = !ordenAsc;
      } else {
        columnaOrden = col;
        ordenAsc = true;
      }
      ordenarFilas();
      renderizarTabla();
    });
  });
}

function renderizarCuerpo() {
  const inicio = paginaActual * FILAS_PAGINA;
  const pagina = filasVista.slice(inicio, inicio + FILAS_PAGINA);
  const tbody  = document.getElementById('tablaDatosBody');

  tbody.innerHTML = pagina.map(fila =>
    '<tr>' + columnas.map(col => `<td>${escaparHTML(String(fila[col] ?? ''))}</td>`).join('') + '</tr>'
  ).join('');

  if (pagina.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${columnas.length}" style="text-align:center; padding:30px; color:var(--color-texto-suave);">Sin resultados</td></tr>`;
  }
}

function renderizarPaginacion() {
  const totalPaginas = Math.ceil(filasVista.length / FILAS_PAGINA);
  document.getElementById('textoPagina').textContent =
    `Página ${paginaActual + 1} de ${totalPaginas || 1} · ${filasVista.length} filas`;
  document.getElementById('btnPagAnterior').disabled  = paginaActual === 0;
  document.getElementById('btnPagSiguiente').disabled = (paginaActual + 1) >= totalPaginas;
}

/* ─── ORDENAR ─────────────────────────────────────── */

function ordenarFilas() {
  filasVista.sort((a, b) => {
    const va = a[columnaOrden] ?? '';
    const vb = b[columnaOrden] ?? '';
    /* Si ambos son números, compara numéricamente */
    const na = parseFloat(va), nb = parseFloat(vb);
    const comp = (!isNaN(na) && !isNaN(nb))
      ? na - nb
      : String(va).localeCompare(String(vb), 'es');
    return ordenAsc ? comp : -comp;
  });
}

/* ─── EXPORTAR ────────────────────────────────────── */

function exportarCSV() {
  if (filasVista.length === 0) { alert('No hay datos para exportar.'); return; }
  const filas = [columnas, ...filasVista.map(f => columnas.map(c => f[c] ?? ''))];
  const csv = '﻿' + filas
    .map(f => f.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'datos_exportados.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ─── UTILIDADES ─────────────────────────────────── */

function escaparHTML(texto) {
  return String(texto)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
