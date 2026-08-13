import { claveNombre } from './nombres.js'

// ─── Traducción entre la base y la app ──────────────────────────────────────
// La base habla en snake_case y con los nombres del esquema; la app habla en
// camelCase y con los nombres que ya usaban los componentes. Toda la conversión
// vive acá y en ningún otro lado: si mañana cambia una columna, se toca un archivo.
//
// Esto es lo que permite que `datos.js`, `estados.js` y las mutaciones puras de
// `store.jsx` sigan sin enterarse de que existe un servidor.

const aISO = (f) =>
  `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`

const hoyISO = () => aISO(new Date())

// ── Clientes ────────────────────────────────────────────────────────────────

/** Fila de `clientes` (+ su historial ya armado) → el objeto que espera la app.
 *
 *  Las fechas nunca pueden volver en `null`: `parseISO` las parte con `.split` y
 *  reventaría la pantalla entera por una fila incompleta. Si falta alguna se pone
 *  la de hoy y la persona queda marcada para revisar — que es exactamente lo que
 *  hace el importador con una fecha ilegible. Nada se pierde en silencio. */
export function clienteDesdeFila(fila, historialPagos = []) {
  const faltaFecha = !fila.fecha_vencimiento || !fila.cliente_desde

  return {
    id: fila.id,
    nombre: fila.nombre,
    telefono: fila.telefono ?? '',
    plan: fila.plan ?? 'Sin plan',
    cuota: Number(fila.cuota ?? 0),
    ...(fila.adulto_responsable ? { responsable: fila.adulto_responsable } : {}),
    fechaAlta: fila.cliente_desde ?? hoyISO(),
    fechaPago: fila.fecha_ultimo_pago ?? fila.fecha_vencimiento ?? hoyISO(),
    fechaVencimiento: fila.fecha_vencimiento ?? hoyISO(),
    ...(fila.revisar || faltaFecha ? { revisar: true } : {}),
    historialPagos,
  }
}

/** El camino de vuelta. `historialPagos` no viaja: los pagos son su propia tabla. */
export function filaDesdeCliente(cliente) {
  return {
    id: cliente.id,
    nombre: cliente.nombre,
    // Se calcula acá y no en Postgres a propósito: replicarlo en SQL exigiría la
    // extensión `unaccent` y dejaría dos definiciones de "mismo nombre" que pueden
    // divergir. El índice único de la base se apoya en esta misma función.
    nombre_normalizado: claveNombre(cliente.nombre),
    telefono: cliente.telefono ?? '',
    plan: cliente.plan ?? 'Sin plan',
    cuota: cliente.cuota ?? 0,
    fecha_ultimo_pago: cliente.fechaPago ?? null,
    fecha_vencimiento: cliente.fechaVencimiento ?? null,
    cliente_desde: cliente.fechaAlta ?? null,
    adulto_responsable: cliente.responsable ?? null,
    revisar: Boolean(cliente.revisar),
  }
}

// ── Pagos ───────────────────────────────────────────────────────────────────

/** Fila de `pagos` → una entrada del historial. Se guarda SOLO el dato del método
 *  elegido, igual que en `conPagoRegistrado`: un recibo colgado en un pago por
 *  transferencia contradiría al método. */
export function pagoDesdeFila(fila) {
  return {
    id: fila.id,
    fecha: fila.fecha,
    monto: Number(fila.importe),
    metodo: fila.metodo,
    ...(fila.cuenta ? { cuenta: fila.cuenta } : {}),
    ...(fila.recibo ? { recibo: fila.recibo } : {}),
  }
}

export function filaDesdePago(clienteId, pago) {
  const esTransferencia = pago.metodo === 'transferencia'
  return {
    ...(pago.id ? { id: pago.id } : {}),
    cliente_id: clienteId,
    fecha: pago.fecha,
    importe: pago.monto,
    metodo: pago.metodo,
    cuenta: esTransferencia ? pago.cuenta : null,
    recibo: esTransferencia ? null : pago.recibo || null,
  }
}

// ── Docentes ───────────────────────────────────────────────────────────────

export function docenteDesdeFila(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    telefono: fila.telefono ?? '',
    email: fila.email ?? '',
    rol: fila.rol,
  }
}

export function filaDesdeDocente(docente) {
  return {
    id: docente.id,
    nombre: docente.nombre,
    nombre_normalizado: claveNombre(docente.nombre),
    telefono: docente.telefono ?? '',
    email: docente.email ?? '',
    rol: docente.rol,
  }
}

// ── Lista de espera ────────────────────────────────────────────────────────

export function esperaDesdeFila(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    edad: fila.edad == null ? null : Number(fila.edad),
    telefono: fila.telefono,
    claseId: fila.clase_id ?? null,
    fechaSolicitud: fila.fecha_solicitud,
    estado: fila.estado,
    notas: fila.notas ?? '',
  }
}

export function filaDesdeEspera(persona) {
  return {
    id: persona.id,
    nombre: persona.nombre,
    edad: persona.edad ?? null,
    telefono: persona.telefono,
    clase_id: persona.claseId || null,
    fecha_solicitud: persona.fechaSolicitud,
    estado: persona.estado,
    notas: persona.notas ?? '',
  }
}

// ── Clases ──────────────────────────────────────────────────────────────────

export function claseDesdeFila(fila, participantes = []) {
  return {
    id: fila.id,
    dia: fila.dia,
    hora: fila.hora,
    duracion: fila.duracion,
    actividad: fila.actividad,
    profe: fila.profe ?? '',
    docenteId: fila.docente_id ?? null,
    cupo: fila.cupo,
    participantes,
  }
}

/** `participantes` no viaja: es su propia tabla, y el cupo ocupado se cuenta
 *  desde ahí. Un contador guardado se desincroniza al primer borrado. */
export function filaDesdeClase(clase) {
  return {
    id: clase.id,
    actividad: clase.actividad,
    profe: clase.profe ?? '',
    docente_id: clase.docenteId || null,
    dia: clase.dia,
    hora: clase.hora,
    duracion: clase.duracion ?? 45,
    cupo: clase.cupo ?? 0,
  }
}

/** Los campos de una clase que sí son columnas. Filtra `participantes` y cualquier
 *  cosa derivada que se haya colado en el objeto. */
export function cambiosDeClase(cambios) {
  const columnas = ['actividad', 'profe', 'dia', 'hora', 'duracion', 'cupo']
  const fila = {}
  for (const c of columnas) if (c in cambios) fila[c] = cambios[c]
  if ('docenteId' in cambios) fila.docente_id = cambios.docenteId || null
  return fila
}

// ── Armado del estado completo ──────────────────────────────────────────────

/** Las cinco consultas sueltas → la misma forma que antes tenía `localStorage`:
 *  `{ clientes, horarios, asistencias }`. Desde acá para arriba, nadie sabe si
 *  esto vino de una base o de un archivo. */
export function armarCrudos({
  clientes,
  clases,
  participantes,
  pagos,
  asistencias,
  docentes = [],
  listaEspera = [],
}) {
  const historialPorCliente = new Map()
  for (const p of pagos) {
    if (!historialPorCliente.has(p.cliente_id)) historialPorCliente.set(p.cliente_id, [])
    historialPorCliente.get(p.cliente_id).push(pagoDesdeFila(p))
  }
  // Más nuevo primero, que es como lo muestra la ficha.
  for (const lista of historialPorCliente.values()) {
    lista.sort((a, b) => b.fecha.localeCompare(a.fecha))
  }

  const participantesPorClase = new Map()
  for (const p of participantes) {
    if (!participantesPorClase.has(p.clase_id)) participantesPorClase.set(p.clase_id, [])
    participantesPorClase.get(p.clase_id).push(p.cliente_id)
  }

  // { [claseId]: { "2026-08-11": [ids] } } — la misma forma de siempre.
  const porClase = {}
  for (const a of asistencias) {
    if (!porClase[a.clase_id]) porClase[a.clase_id] = {}
    if (!porClase[a.clase_id][a.fecha]) porClase[a.clase_id][a.fecha] = []
    porClase[a.clase_id][a.fecha].push(a.cliente_id)
  }

  return {
    clientes: clientes.map((c) => clienteDesdeFila(c, historialPorCliente.get(c.id) ?? [])),
    horarios: clases.map((c) => claseDesdeFila(c, participantesPorClase.get(c.id) ?? [])),
    asistencias: porClase,
    docentes: docentes.map(docenteDesdeFila),
    listaEspera: listaEspera.map(esperaDesdeFila),
  }
}
