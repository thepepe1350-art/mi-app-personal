/* =====================================================
   MÓDULO CONVERSOR - conversor.js
   Herramientas de conversión sin subir archivos a internet:
   - Imágenes (formato + compresión) con Canvas
   - CSV ↔ JSON (sin librerías)
   - Excel ↔ CSV con SheetJS
   - Generador de códigos QR
===================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  await aplicarTemaGuardado();
  configurarBotonTema();
  configurarTabs();
  configurarImagenes();
  configurarDocumentos();
  configurarQR();
});

/* ─── PESTAÑAS ────────────────────────────────────── */

function configurarTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('activo'));
      document.querySelectorAll('.tab-contenido').forEach(c => c.style.display = 'none');
      tab.classList.add('activo');
      document.getElementById(`tab-${tab.dataset.tab}`).style.display = '';
    });
  });
}

/* ─── IMÁGENES ────────────────────────────────────── */

function configurarImagenes() {
  /* Conversión de formato */
  const inputConvertir = document.getElementById('inputImgConvertir');
  inputConvertir.addEventListener('change', () => {
    const archivo = inputConvertir.files[0];
    if (!archivo) return;
    document.getElementById('nombreImgConvertir').textContent = archivo.name;
    /* Muestra vista previa */
    const url = URL.createObjectURL(archivo);
    const img = document.getElementById('imgPreview');
    img.src = url;
    document.getElementById('previewImgConvertir').style.display = '';
  });

  document.getElementById('btnConvertirImagen').addEventListener('click', () => {
    const archivo = inputConvertir.files[0];
    if (!archivo) { alert('Primero selecciona una imagen.'); return; }
    const formato  = document.getElementById('formatoDestino').value;
    const calidad  = parseInt(document.getElementById('calidadImagen').value) / 100;
    const extension = formato.split('/')[1] === 'jpeg' ? 'jpg' : formato.split('/')[1];
    convertirImagen(archivo, formato, calidad, `imagen_convertida.${extension}`);
  });

  /* Compresión */
  const inputComprimir = document.getElementById('inputImgComprimir');
  const rangeCalidad   = document.getElementById('rangeCalidad');
  const valorCalidad   = document.getElementById('valorCalidadComprimir');

  rangeCalidad.addEventListener('input', () => {
    valorCalidad.textContent = rangeCalidad.value;
  });

  inputComprimir.addEventListener('change', () => {
    const archivo = inputComprimir.files[0];
    if (archivo) document.getElementById('nombreImgComprimir').textContent = archivo.name;
  });

  document.getElementById('btnComprimirImagen').addEventListener('click', () => {
    const archivo = inputComprimir.files[0];
    if (!archivo) { alert('Primero selecciona una imagen.'); return; }
    const calidad = parseInt(rangeCalidad.value) / 100;
    /* Conserva el formato original pero comprime */
    const formato = archivo.type || 'image/jpeg';
    const ext     = formato.split('/')[1] === 'jpeg' ? 'jpg' : formato.split('/')[1];
    convertirImagen(archivo, formato, calidad, `imagen_comprimida.${ext}`, (original, resultado) => {
      const pct = Math.round((1 - resultado / original) * 100);
      document.getElementById('resultadoCompresion').textContent =
        pct > 0
          ? `Reducido un ${pct}% (${formatearBytes(original)} → ${formatearBytes(resultado)})`
          : `El archivo ya estaba optimizado (${formatearBytes(original)})`;
    });
  });
}

/* Usa el Canvas del navegador para convertir/comprimir una imagen */
function convertirImagen(archivo, formatoDestino, calidad, nombreDescarga, onDone) {
  const lector = new FileReader();
  lector.onload = () => {
    const img = new Image();
    img.onload = () => {
      const canvas    = document.createElement('canvas');
      canvas.width    = img.naturalWidth;
      canvas.height   = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);

      canvas.toBlob(blob => {
        if (!blob) { alert('No se pudo convertir la imagen.'); return; }
        if (onDone) onDone(archivo.size, blob.size);
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = nombreDescarga;
        a.click();
        URL.revokeObjectURL(url);
      }, formatoDestino, calidad);
    };
    img.src = lector.result;
  };
  lector.readAsDataURL(archivo);
}

/* ─── DOCUMENTOS ──────────────────────────────────── */

function configurarDocumentos() {
  /* CSV ↔ JSON */
  document.getElementById('btnCSVaJSON').addEventListener('click', () => convertirTexto('csv-json'));
  document.getElementById('btnJSONaCSV').addEventListener('click', () => convertirTexto('json-csv'));
  document.getElementById('btnCopiarDoc').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('resultadoDoc').value)
      .then(() => { document.getElementById('btnCopiarDoc').textContent = '¡Copiado!'; setTimeout(() => { document.getElementById('btnCopiarDoc').textContent = 'Copiar resultado'; }, 2000); })
      .catch(() => {});
  });

  /* Excel ↔ CSV */
  const inputExcel = document.getElementById('inputArchivoExcel');
  let archivoExcelCargado = null;

  inputExcel.addEventListener('change', () => {
    archivoExcelCargado = inputExcel.files[0] || null;
    document.getElementById('nombreArchivoExcel').textContent =
      archivoExcelCargado ? archivoExcelCargado.name : 'Haz clic para seleccionar';
    const tieneArchivo = !!archivoExcelCargado;
    document.getElementById('btnExcelACSV').disabled = !tieneArchivo;
    document.getElementById('btnCSVaExcel').disabled = !tieneArchivo;
  });

  document.getElementById('btnExcelACSV').addEventListener('click', () => {
    if (!archivoExcelCargado) return;
    leerExcelYDescargar(archivoExcelCargado, 'csv');
  });

  document.getElementById('btnCSVaExcel').addEventListener('click', () => {
    if (!archivoExcelCargado) return;
    leerExcelYDescargar(archivoExcelCargado, 'xlsx');
  });
}

/* Convierte el texto del textarea entre CSV y JSON */
function convertirTexto(modo) {
  const entrada = document.getElementById('textoDoc').value.trim();
  if (!entrada) { alert('Pega el contenido primero.'); return; }

  let resultado = '';
  try {
    if (modo === 'csv-json') {
      resultado = JSON.stringify(csvAJson(entrada), null, 2);
    } else {
      const datos = JSON.parse(entrada);
      resultado = jsonACSV(Array.isArray(datos) ? datos : [datos]);
    }
    document.getElementById('resultadoDoc').value    = resultado;
    document.getElementById('resultadoDocContenedor').style.display = '';
  } catch (err) {
    alert(`Error al convertir: ${err.message}`);
  }
}

/* Convierte texto CSV a array de objetos JSON */
function csvAJson(csv) {
  const lineas  = csv.split('\n').map(l => l.trim()).filter(l => l);
  const headers = parsearLineaCSV(lineas[0]);
  return lineas.slice(1).map(linea => {
    const valores = parsearLineaCSV(linea);
    return Object.fromEntries(headers.map((h, i) => [h, valores[i] ?? '']));
  });
}

/* Parsea una línea CSV respetando comillas */
function parsearLineaCSV(linea) {
  const resultado = [];
  let campo = '', dentroComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"' && linea[i+1] === '"') { campo += '"'; i++; }
    else if (c === '"') dentroComillas = !dentroComillas;
    else if (c === ',' && !dentroComillas) { resultado.push(campo); campo = ''; }
    else campo += c;
  }
  resultado.push(campo);
  return resultado;
}

/* Convierte array de objetos a texto CSV */
function jsonACSV(datos) {
  if (!datos.length) return '';
  const cols  = Object.keys(datos[0]);
  const filas = [cols, ...datos.map(d => cols.map(c => d[c] ?? ''))];
  return filas.map(f => f.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
}

/* Usa SheetJS para leer un archivo y descargarlo en otro formato */
function leerExcelYDescargar(archivo, formatoSalida) {
  const lector = new FileReader();
  lector.onload = e => {
    try {
      const libro  = XLSX.read(e.target.result, { type: 'array' });
      const nombre = archivo.name.replace(/\.[^.]+$/, '');

      if (formatoSalida === 'csv') {
        const hoja = libro.Sheets[libro.SheetNames[0]];
        const csv  = '﻿' + XLSX.utils.sheet_to_csv(hoja);
        descargarBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${nombre}.csv`);
      } else {
        /* Si el archivo era CSV, lo convierte a Excel */
        const archivoXLSX = XLSX.write(libro, { bookType: 'xlsx', type: 'array' });
        descargarBlob(new Blob([archivoXLSX], { type: 'application/octet-stream' }), `${nombre}.xlsx`);
      }
    } catch { alert('No se pudo convertir el archivo. Verifica que sea válido.'); }
  };
  lector.readAsArrayBuffer(archivo);
}

/* ─── QR ──────────────────────────────────────────── */

let instanciaQR = null;

function configurarQR() {
  document.getElementById('btnGenerarQR').addEventListener('click', generarQR);
  document.getElementById('btnDescargarQR').addEventListener('click', descargarQR);
}

function generarQR() {
  const texto = document.getElementById('textoQR').value.trim();
  if (!texto) { alert('Escribe un texto o enlace primero.'); return; }

  const contenedor = document.getElementById('contenedorQR');
  contenedor.innerHTML = ''; /* limpia el QR anterior */

  instanciaQR = new QRCode(contenedor, {
    text:   texto,
    width:  256,
    height: 256,
    correctLevel: QRCode.CorrectLevel.M,
  });

  document.getElementById('resultadoQR').style.display = '';
}

function descargarQR() {
  const canvas = document.querySelector('#contenedorQR canvas');
  const img    = document.querySelector('#contenedorQR img');
  let urlDescarga = '';

  if (canvas) {
    urlDescarga = canvas.toDataURL('image/png');
  } else if (img) {
    urlDescarga = img.src;
  } else { return; }

  const a   = document.createElement('a');
  a.href     = urlDescarga;
  a.download = 'codigo_qr.png';
  a.click();
}

/* ─── UTILIDADES ─────────────────────────────────── */

function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = nombre; a.click();
  URL.revokeObjectURL(url);
}

function formatearBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
