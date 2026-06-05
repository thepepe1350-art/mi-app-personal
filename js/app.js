/* =====================================================
   APP PRINCIPAL - app.js
   Aquí arranca la app: registra el service worker,
   aplica el tema guardado y muestra el saludo.
===================================================== */

/* Registra el Service Worker para modo offline */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* Si falla, la app igual funciona, solo sin modo offline */
    });
  });
}

/* Cuando carga la página */
document.addEventListener('DOMContentLoaded', async () => {
  await aplicarTemaGuardado();
  configurarBotonTema();
  mostrarEstadoConexion();
  window.addEventListener('online',  mostrarEstadoConexion);
  window.addEventListener('offline', mostrarEstadoConexion);
});

/* Lee el tema guardado y lo aplica al cuerpo */
async function aplicarTemaGuardado() {
  const temaGuardado = await obtenerConfig('tema').catch(() => null);
  const tema = temaGuardado || 'claro';
  document.documentElement.setAttribute('data-tema', tema);
  const btn = document.getElementById('btnTema');
  if (btn && tema === 'oscuro') btn.classList.add('activo');
}

/* Conecta el botón de tema claro/oscuro */
function configurarBotonTema() {
  const btn = document.getElementById('btnTema');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const esOscuro = document.documentElement.getAttribute('data-tema') === 'oscuro';
    const nuevoTema = esOscuro ? 'claro' : 'oscuro';
    document.documentElement.setAttribute('data-tema', nuevoTema);
    btn.classList.toggle('activo', nuevoTema === 'oscuro');
    await guardarConfig('tema', nuevoTema).catch(() => {});
  });
}

/* Muestra si hay internet o no en el encabezado */
function mostrarEstadoConexion() {
  const indicador = document.getElementById('estadoSync');
  if (!indicador) return;

  if (navigator.onLine) {
    indicador.textContent = 'En línea';
    indicador.style.color = 'var(--color-exito)';
  } else {
    indicador.textContent = 'Sin conexión';
    indicador.style.color = 'var(--color-texto-suave)';
  }
}

/* Devuelve el saludo según la hora del día */
function obtenerSaludo() {
  const hora = new Date().getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/* Formatea una fecha como texto legible en español */
function formatearFecha(fecha) {
  return new Date(fecha).toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

/* Formatea un número como moneda */
function formatearDinero(numero) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', minimumFractionDigits: 0
  }).format(numero);
}

/* Genera un ID único para datos nuevos */
function generarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
