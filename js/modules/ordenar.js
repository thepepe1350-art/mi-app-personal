/* =====================================================
   MÓDULO ORDENAR - ordenar.js
   Sube un Excel o CSV y aplica una instrucción
   escrita en español natural: ordenar, filtrar.
   Todo se procesa localmente en el navegador.
===================================================== */

let filasOriginales = []; /* datos completos del archivo */
let columnasArchivo = []; /* nombres de columnas detectados */
let filasResultado  = []; /* resultado después de aplicar la instrucción */

document.addEventListener('DOMContentLoaded', async () => {
  await aplicarTemaGuardado();
  configurarBotonTema();
  configurarSubida();
  configurarInstruccion();
  configurarDescargas();
});

/* ─── CARGA DE ARCHIVO ────────────────────────────── */

function configurarSubida() {
  const input    = document.getElementById('inputOrdenar');
  const zonaDrop = document.getElementById('zonaDropOrdenar');

  input.addEventListener('change', () => {
    if (input.files[0]) procesarArchivo(input.files[0]);
  });

  zonaDrop.addEventListener('dragover',  e => { e.preventDefault(); zonaDrop.classList.add('arrastrando'); });
  zonaDrop.addEventListener('dragleave', () => zonaDrop.classList.remove('arrastrando'));
  zonaDrop.addEventListener('drop', e => {
    e.preventDefault();
    zonaDrop.classList.remove('arrastrando');
    if (e.dataTransfer.files[0]) procesarArchivo(e.dataTransfer.files[0]);
  });
}

function procesarArchivo(archivo) {
  const lector = new FileReader();
  lector.onload = e => {
    try {
      const libro = XLSX.read(e.target.result, { type: 'array' });
      const hoja  = libro.Sheets[libro.SheetNames[0]];
      const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '' });

      if (filas.length < 2) { alert('El archivo no tiene datos suficientes.'); return; }

      columnasArchivo = filas[0].map(String);
      filasOriginales = filas.slice(1).map(fila =>
        Object.fromEntries(columnasArchivo.map((col, i) => [col, fila[i] ?? '']))
      );

      /* Muestra las columnas detectadas */
      document.getElementById('columnasDetectadas').textContent =
        columnasArchivo.join(', ');

      document.getElementById('paso1').style.display    = 'none';
      document.getElementById('pasos23').style.display  = '';
      document.getElementById('paso3').style.display    = 'none';
      document.getElementById('mensajeError').style.display = 'none';
    } catch {
      alert('No se pudo leer el archivo. Verifica que sea Excel o CSV válido.');
    }
  };
  lector.readAsArrayBuffer(archivo);
}

/* ─── INSTRUCCIÓN ─────────────────────────────────── */

function configurarInstruccion() {
  document.getElementById('btnAplicar').addEventListener('click', aplicarInstruccion);

  /* Clic en ejemplos → rellena el campo automáticamente */
  document.querySelectorAll('.ejemplo-instruccion').forEach(ej => {
    ej.addEventListener('click', () => {
      document.getElementById('campoInstruccion').value = ej.textContent.replace(/^•\s*/, '');
      document.getElementById('campoInstruccion').focus();
    });
  });
}

function aplicarInstruccion() {
  const instruccion = document.getElementById('campoInstruccion').value.trim();
  if (!instruccion) { mostrarError('Escribe una instrucción primero.'); return; }

  const resultado = parsearInstruccion(instruccion.toLowerCase());

  if (!resultado) {
    mostrarError(
      `No entendí la instrucción. Prueba con:<br>
       • <em>ordena por [columna] de mayor a menor</em><br>
       • <em>filtra [columna] mayor que [número]</em><br>
       • <em>filtra [columna] contiene [texto]</em>`
    );
    return;
  }

  document.getElementById('mensajeError').style.display = 'none';
  filasResultado = aplicarOperacion(resultado);

  document.getElementById('textoResultado').textContent =
    `${filasResultado.length} fila(s) como resultado de: "${document.getElementById('campoInstruccion').value.trim()}"`;

  renderizarTablaResultado();
  document.getElementById('paso3').style.display = '';
}

/* Interpreta la instrucción en español y retorna un objeto de operación */
function parsearInstruccion(txt) {
  /* ── ORDENAR ─────────────────────────────────────
     "ordena por [columna] de mayor a menor"
     "ordena por [columna] de menor a mayor"
     "ordena por [columna]"                          */
  const matchDesc = txt.match(/orden[a|ar]+\s+por\s+(.+?)\s+de\s+mayor\s+a\s+menor/);
  if (matchDesc) {
    const col = encontrarColumna(matchDesc[1]);
    if (col) return { tipo: 'ordenar', columna: col, direccion: 'desc' };
  }

  const matchAsc = txt.match(/orden[a|ar]+\s+por\s+(.+?)(?:\s+de\s+menor\s+a\s+mayor)?$/);
  if (matchAsc) {
    const nombre = matchAsc[1].replace(/\s+de\s+menor\s+a\s+mayor/, '').trim();
    const col    = encontrarColumna(nombre);
    if (col) return { tipo: 'ordenar', columna: col, direccion: 'asc' };
  }

  /* ── FILTRAR ─────────────────────────────────────
     "filtra [columna] mayor que [valor]"
     "filtra [columna] menor que [valor]"
     "filtra [columna] igual a [valor]"
     "filtra [columna] contiene [texto]"             */
  const matchMayor = txt.match(/filtr[a|ar]+\s+(.+?)\s+mayor(?:es?)?\s+(?:que|a)\s+(.+)$/);
  if (matchMayor) {
    const col = encontrarColumna(matchMayor[1]);
    if (col) return { tipo: 'filtrar', columna: col, operador: '>', valor: matchMayor[2].trim() };
  }

  const matchMenor = txt.match(/filtr[a|ar]+\s+(.+?)\s+menor(?:es?)?\s+(?:que|a)\s+(.+)$/);
  if (matchMenor) {
    const col = encontrarColumna(matchMenor[1]);
    if (col) return { tipo: 'filtrar', columna: col, operador: '<', valor: matchMenor[2].trim() };
  }

  const matchIgual = txt.match(/filtr[a|ar]+\s+(.+?)\s+igual\s+a\s+(.+)$/);
  if (matchIgual) {
    const col = encontrarColumna(matchIgual[1]);
    if (col) return { tipo: 'filtrar', columna: col, operador: '=', valor: matchIgual[2].trim() };
  }

  const matchContiene = txt.match(/filtr[a|ar]+\s+(.+?)\s+contiene?\s+(.+)$/);
  if (matchContiene) {
    const col = encontrarColumna(matchContiene[1]);
    if (col) return { tipo: 'filtrar', columna: col, operador: 'contiene', valor: matchContiene[2].trim() };
  }

  return null;
}

/* Busca la columna más parecida al texto dado (sin importar mayúsculas) */
function encontrarColumna(texto) {
  const t = texto.trim().toLowerCase();
  /* Primero busca coincidencia exacta */
  let col = columnasArchivo.find(c => c.toLowerCase() === t);
  /* Si no, busca que empiece igual */
  if (!col) col = columnasArchivo.find(c => c.toLowerCase().startsWith(t));
  /* Si no, busca que contenga el texto */
  if (!col) col = columnasArchivo.find(c => c.toLowerCase().includes(t));
  return col || null;
}

/* Aplica la operación al array de filas originales */
function aplicarOperacion(op) {
  let filas = [...filasOriginales];

  if (op.tipo === 'ordenar') {
    filas.sort((a, b) => {
      const va = a[op.columna] ?? '', vb = b[op.columna] ?? '';
      const na = parseFloat(va),     nb = parseFloat(vb);
      const comp = (!isNaN(na) && !isNaN(nb)) ? na - nb : String(va).localeCompare(String(vb), 'es');
      return op.direccion === 'asc' ? comp : -comp;
    });
  }

  if (op.tipo === 'filtrar') {
    filas = filas.filter(fila => {
      const val       = String(fila[op.columna] ?? '');
      const valNum    = parseFloat(val);
      const opNum     = parseFloat(op.valor);
      switch (op.operador) {
        case '>':        return !isNaN(valNum) && !isNaN(opNum) && valNum > opNum;
        case '<':        return !isNaN(valNum) && !isNaN(opNum) && valNum < opNum;
        case '=':        return val.toLowerCase() === op.valor.toLowerCase();
        case 'contiene': return val.toLowerCase().includes(op.valor.toLowerCase());
        default:         return true;
      }
    });
  }

  return filas;
}

/* ─── TABLA DE RESULTADO ──────────────────────────── */

function renderizarTablaResultado() {
  const thead = document.getElementById('tablaResultadoHead');
  const tbody = document.getElementById('tablaResultadoBody');

  /* Muestra solo las primeras 100 filas en pantalla para no saturar el navegador */
  const vista = filasResultado.slice(0, 100);

  thead.innerHTML = '<tr>' + columnasArchivo.map(c => `<th>${escaparHTML(c)}</th>`).join('') + '</tr>';
  tbody.innerHTML = vista.map(fila =>
    '<tr>' + columnasArchivo.map(c => `<td>${escaparHTML(String(fila[c] ?? ''))}</td>`).join('') + '</tr>'
  ).join('');

  if (vista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${columnasArchivo.length}" style="text-align:center;padding:24px;color:var(--color-texto-suave);">Sin resultados</td></tr>`;
  } else if (filasResultado.length > 100) {
    tbody.innerHTML += `<tr><td colspan="${columnasArchivo.length}" style="text-align:center;padding:12px;color:var(--color-texto-suave);font-style:italic;">Mostrando 100 de ${filasResultado.length} filas. Descarga el archivo para verlas todas.</td></tr>`;
  }
}

/* ─── DESCARGAS ───────────────────────────────────── */

function configurarDescargas() {
  document.getElementById('btnDescargarCSV').addEventListener('click', () => descargar('csv'));
  document.getElementById('btnDescargarExcel').addEventListener('click', () => descargar('xlsx'));
}

function descargar(formato) {
  if (!filasResultado.length) return;

  const filas = [columnasArchivo, ...filasResultado.map(f => columnasArchivo.map(c => f[c] ?? ''))];
  const hoja  = XLSX.utils.aoa_to_sheet(filas);
  const libro  = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Resultado');

  if (formato === 'csv') {
    const csv  = '﻿' + XLSX.utils.sheet_to_csv(hoja);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    descargarBlob(blob, 'resultado.csv');
  } else {
    const buf  = XLSX.write(libro, { bookType: 'xlsx', type: 'array' });
    descargarBlob(new Blob([buf], { type: 'application/octet-stream' }), 'resultado.xlsx');
  }
}

/* ─── UTILIDADES ─────────────────────────────────── */

function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = nombre; a.click();
  URL.revokeObjectURL(url);
}

function mostrarError(html) {
  const p = document.getElementById('mensajeError');
  p.innerHTML = html;
  p.style.display = '';
}

function escaparHTML(texto) {
  return String(texto)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
