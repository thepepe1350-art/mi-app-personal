/* =====================================================
   BASE DE DATOS LOCAL - db.js
   Guarda todos los datos en el navegador usando
   IndexedDB. Funciona aunque no haya internet.
===================================================== */

const BD_NOMBRE = 'MiAppPersonal';
const BD_VERSION = 1;
let bd = null;

/* Abre (o crea) la base de datos */
function abrirBD() {
  return new Promise((resolver, rechazar) => {
    if (bd) { resolver(bd); return; }

    const solicitud = indexedDB.open(BD_NOMBRE, BD_VERSION);

    /* Se ejecuta cuando se crea o actualiza la base de datos */
    solicitud.onupgradeneeded = (evento) => {
      const db = evento.target.result;

      /* Crea las "tablas" (se llaman almacenes) si no existen */
      if (!db.objectStoreNames.contains('tareas')) {
        const t = db.createObjectStore('tareas', { keyPath: 'id', autoIncrement: true });
        t.createIndex('fecha', 'fecha', { unique: false });
        t.createIndex('prioridad', 'prioridad', { unique: false });
      }
      if (!db.objectStoreNames.contains('eventos')) {
        const e = db.createObjectStore('eventos', { keyPath: 'id', autoIncrement: true });
        e.createIndex('fecha', 'fecha', { unique: false });
      }
      if (!db.objectStoreNames.contains('notas')) {
        const n = db.createObjectStore('notas', { keyPath: 'id', autoIncrement: true });
        n.createIndex('anclada', 'anclada', { unique: false });
      }
      if (!db.objectStoreNames.contains('contactos')) {
        const c = db.createObjectStore('contactos', { keyPath: 'id', autoIncrement: true });
        c.createIndex('nombre', 'nombre', { unique: false });
      }
      if (!db.objectStoreNames.contains('finanzas')) {
        db.createObjectStore('finanzas', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('configuracion')) {
        db.createObjectStore('configuracion', { keyPath: 'clave' });
      }
    };

    solicitud.onsuccess = (evento) => {
      bd = evento.target.result;
      resolver(bd);
    };

    solicitud.onerror = () => rechazar(solicitud.error);
  });
}

/* Agrega o actualiza un elemento en un almacén */
async function guardar(almacen, dato) {
  const db = await abrirBD();
  return new Promise((resolver, rechazar) => {
    const transaccion = db.transaction(almacen, 'readwrite');
    const store = transaccion.objectStore(almacen);
    const solicitud = store.put(dato);
    solicitud.onsuccess = () => resolver(solicitud.result);
    solicitud.onerror = () => rechazar(solicitud.error);
  });
}

/* Obtiene todos los elementos de un almacén */
async function obtenerTodos(almacen) {
  const db = await abrirBD();
  return new Promise((resolver, rechazar) => {
    const transaccion = db.transaction(almacen, 'readonly');
    const store = transaccion.objectStore(almacen);
    const solicitud = store.getAll();
    solicitud.onsuccess = () => resolver(solicitud.result);
    solicitud.onerror = () => rechazar(solicitud.error);
  });
}

/* Obtiene un elemento por su ID */
async function obtenerPorId(almacen, id) {
  const db = await abrirBD();
  return new Promise((resolver, rechazar) => {
    const transaccion = db.transaction(almacen, 'readonly');
    const store = transaccion.objectStore(almacen);
    const solicitud = store.get(id);
    solicitud.onsuccess = () => resolver(solicitud.result);
    solicitud.onerror = () => rechazar(solicitud.error);
  });
}

/* Elimina un elemento por su ID */
async function eliminar(almacen, id) {
  const db = await abrirBD();
  return new Promise((resolver, rechazar) => {
    const transaccion = db.transaction(almacen, 'readwrite');
    const store = transaccion.objectStore(almacen);
    const solicitud = store.delete(id);
    solicitud.onsuccess = () => resolver();
    solicitud.onerror = () => rechazar(solicitud.error);
  });
}

/* Guarda un valor de configuración (ej: tema, preferencias) */
async function guardarConfig(clave, valor) {
  return guardar('configuracion', { clave, valor });
}

/* Obtiene un valor de configuración */
async function obtenerConfig(clave) {
  const resultado = await obtenerPorId('configuracion', clave);
  return resultado ? resultado.valor : null;
}
