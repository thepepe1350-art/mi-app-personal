/* =====================================================
   DASHBOARD - dashboard.js
   Carga los datos del día en la pantalla principal.
===================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  mostrarSaludoYFecha();
  await cargarContadores();
  await cargarTareasDashboard();
  await cargarEventosDashboard();
});

/* Muestra el saludo y la fecha de hoy */
function mostrarSaludoYFecha() {
  const elSaludo = document.getElementById('saludo');
  const laFecha  = document.getElementById('fechaHoy');
  if (elSaludo) elSaludo.textContent = obtenerSaludo() + ' 👋';
  if (laFecha)  laFecha.textContent  = formatearFecha(new Date());
}

/* Carga los números de resumen */
async function cargarContadores() {
  try {
    const tareas    = await obtenerTodos('tareas').catch(() => []);
    const eventos   = await obtenerTodos('eventos').catch(() => []);
    const notas     = await obtenerTodos('notas').catch(() => []);
    const finanzas  = await obtenerTodos('finanzas').catch(() => []);

    const hoy = new Date().toISOString().slice(0, 10);

    /* Tareas pendientes de hoy o sin fecha */
    const tareasPendientes = tareas.filter(t => !t.completada);
    const elem1 = document.getElementById('contadorTareas');
    if (elem1) elem1.textContent = tareasPendientes.length;

    /* Eventos de hoy */
    const eventosHoy = eventos.filter(e => e.fecha && e.fecha.startsWith(hoy));
    const elem2 = document.getElementById('contadorEventos');
    if (elem2) elem2.textContent = eventosHoy.length;

    /* Total de notas */
    const elem3 = document.getElementById('contadorNotas');
    if (elem3) elem3.textContent = notas.length;

    /* Gastos del mes actual */
    const mesActual = hoy.slice(0, 7); /* ej: "2026-06" */
    const gastosMes = finanzas
      .filter(f => f.tipo === 'gasto' && f.fecha && f.fecha.startsWith(mesActual))
      .reduce((suma, f) => suma + (f.monto || 0), 0);
    const elem4 = document.getElementById('resumenGastos');
    if (elem4) elem4.textContent = gastosMes > 0 ? formatearDinero(gastosMes) : '$0';

  } catch (error) {
    /* Si falla la base de datos, deja los números en 0 */
  }
}

/* Muestra las próximas 3 tareas pendientes */
async function cargarTareasDashboard() {
  const contenedor = document.getElementById('listaTareasDash');
  if (!contenedor) return;

  try {
    const tareas = await obtenerTodos('tareas').catch(() => []);
    const pendientes = tareas
      .filter(t => !t.completada)
      .sort((a, b) => {
        /* Ordena: primero las de alta prioridad, luego por fecha */
        const orden = { alta: 0, media: 1, baja: 2 };
        return (orden[a.prioridad] ?? 1) - (orden[b.prioridad] ?? 1);
      })
      .slice(0, 3);

    if (pendientes.length === 0) return; /* Deja el mensaje vacío */

    contenedor.innerHTML = pendientes.map(t => `
      <div class="lista-item">
        <div class="checkbox-custom" onclick="marcarTarea(${t.id})"></div>
        <div style="flex:1;">
          <div class="lista-item-titulo">${escapeHtml(t.titulo)}</div>
          ${t.fecha ? `<div class="lista-item-subtitulo">${formatearFecha(t.fecha)}</div>` : ''}
        </div>
        ${t.prioridad ? `<span class="insignia insignia-${t.prioridad}">${t.prioridad}</span>` : ''}
      </div>
    `).join('');
  } catch (e) {
    /* Si falla, no muestra nada */
  }
}

/* Muestra los próximos 3 eventos */
async function cargarEventosDashboard() {
  const contenedor = document.getElementById('listaEventosDash');
  if (!contenedor) return;

  try {
    const eventos = await obtenerTodos('eventos').catch(() => []);
    const hoy = new Date().toISOString().slice(0, 10);

    const proximos = eventos
      .filter(e => e.fecha >= hoy)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(0, 3);

    if (proximos.length === 0) return;

    contenedor.innerHTML = proximos.map(e => `
      <div class="lista-item">
        <div style="width:8px; height:8px; border-radius:50%; background:var(--color-primario); flex-shrink:0;"></div>
        <div style="flex:1;">
          <div class="lista-item-titulo">${escapeHtml(e.titulo)}</div>
          <div class="lista-item-subtitulo">${formatearFecha(e.fecha)}${e.hora ? ' · ' + e.hora : ''}</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    /* Si falla, no muestra nada */
  }
}

/* Marca una tarea como completada desde el dashboard */
async function marcarTarea(id) {
  try {
    const tarea = await obtenerPorId('tareas', id);
    if (tarea) {
      tarea.completada = true;
      await guardar('tareas', tarea);
      await cargarContadores();
      await cargarTareasDashboard();
    }
  } catch (e) {}
}

/* Convierte caracteres peligrosos en texto para evitar problemas */
function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto || '';
  return div.innerHTML;
}
