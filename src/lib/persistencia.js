import { supabase } from './supabase.js'
import {
  armarCrudos,
  cambiosDeClase,
  filaDesdeClase,
  filaDesdeCliente,
  filaDesdePago,
} from './mapeo.js'

// ─── La capa de escritura ───────────────────────────────────────────────────
// Una función por acción de la app. Cada una hace UNA cosa y explota si falla —
// del reintento y de revertir la pantalla se encarga el store.
//
// Acá no se calcula nada: el estado nuevo ya lo calcularon las funciones puras de
// `store.jsx`. Esto solo lo manda. Si aparece un `if` de lógica de negocio en este
// archivo, está en el lugar equivocado.

/** Supabase devuelve `{ data, error }` en vez de tirar la excepción. Sin esto, un
 *  fallo de red se traga en silencio y la pantalla queda mostrando algo que nunca
 *  se guardó. */
const oExplota = ({ data, error }) => {
  if (error) throw error
  return data
}

export function crearPersistencia(usuarioId) {
  // ── Lectura ──────────────────────────────────────────────────────────────
  // Las cinco tablas en paralelo: son consultas chicas e independientes, y en
  // serie el arranque tardaría cinco viajes en vez de uno.
  async function cargarTodo() {
    const [clientes, clases, participantes, pagos, asistencias] = await Promise.all([
      supabase.from('clientes').select('*').order('nombre').then(oExplota),
      supabase.from('clases').select('*').order('dia').order('hora').then(oExplota),
      supabase.from('participantes').select('*').then(oExplota),
      supabase.from('pagos').select('*').order('fecha', { ascending: false }).then(oExplota),
      supabase.from('asistencias').select('*').then(oExplota),
    ])
    return armarCrudos({ clientes, clases, participantes, pagos, asistencias })
  }

  // ── Pagos ────────────────────────────────────────────────────────────────
  /** Un pago son dos escrituras: el asiento en el historial y las fechas del
   *  cliente. Postgres no las hace atómicas desde el cliente, así que si la
   *  segunda falla se deshace la primera a mano. Sin esa compensación quedaría un
   *  pago cobrado que la ficha no refleja — el peor de los dos estados posibles. */
  async function registrarPago(clienteId, { fecha, monto, metodo, cuenta, recibo, vencimiento }) {
    const insertado = await supabase
      .from('pagos')
      .insert({ usuario_id: usuarioId, ...filaDesdePago(clienteId, { fecha, monto, metodo, cuenta, recibo }) })
      .select('id')
      .single()
      .then(oExplota)

    try {
      await supabase
        .from('clientes')
        .update({ fecha_ultimo_pago: fecha, fecha_vencimiento: vencimiento })
        .eq('id', clienteId)
        .then(oExplota)
    } catch (e) {
      await supabase.from('pagos').delete().eq('id', insertado.id)
      throw e
    }
  }

  async function editarFechas(clienteId, { fechaPago, fechaVencimiento }) {
    await supabase
      .from('clientes')
      .update({ fecha_ultimo_pago: fechaPago, fecha_vencimiento: fechaVencimiento })
      .eq('id', clienteId)
      .then(oExplota)
  }

  // ── Participantes ────────────────────────────────────────────────────────
  /** `upsert` y no `insert`: si el optimismo de la pantalla se adelantó y la fila
   *  ya estaba, agregar de nuevo tiene que ser inofensivo, no un error. */
  async function agregarParticipante(claseId, clienteId) {
    await supabase
      .from('participantes')
      .upsert({ clase_id: claseId, cliente_id: clienteId }, { onConflict: 'clase_id,cliente_id' })
      .then(oExplota)
  }

  /** Borra la fila de `participantes` y NADA más. Las asistencias pasadas quedan:
   *  que vino un martes es un hecho, no una preferencia. La base lo garantiza —
   *  no hay clave foránea de `asistencias` hacia `participantes`. */
  async function sacarParticipante(claseId, clienteId) {
    await supabase
      .from('participantes')
      .delete()
      .eq('clase_id', claseId)
      .eq('cliente_id', clienteId)
      .then(oExplota)
  }

  // ── Clases ───────────────────────────────────────────────────────────────
  async function crearClase(clase) {
    await supabase
      .from('clases')
      .insert({ usuario_id: usuarioId, ...filaDesdeClase(clase) })
      .then(oExplota)
  }

  async function editarClase(id, cambios) {
    await supabase.from('clases').update(cambiosDeClase(cambios)).eq('id', id).then(oExplota)
  }

  /** Se lleva participantes y asistencias por cascada, definida en la migración.
   *  Borrarlas acá a mano sería una segunda definición de la regla. */
  async function eliminarClase(id) {
    await supabase.from('clases').delete().eq('id', id).then(oExplota)
  }

  // ── Asistencia ───────────────────────────────────────────────────────────
  /** Se guarda solo a quien vino: marcar es insertar, desmarcar es borrar. No hay
   *  fila que diga "faltó" — el que no está, no vino. */
  async function marcarAsistencia(claseId, fechaISO, clienteId, presente) {
    if (presente) {
      await supabase
        .from('asistencias')
        .upsert(
          { clase_id: claseId, fecha: fechaISO, cliente_id: clienteId },
          { onConflict: 'clase_id,fecha,cliente_id' },
        )
        .then(oExplota)
    } else {
      await supabase
        .from('asistencias')
        .delete()
        .eq('clase_id', claseId)
        .eq('fecha', fechaISO)
        .eq('cliente_id', clienteId)
        .then(oExplota)
    }
  }

  // ── Importador ───────────────────────────────────────────────────────────
  /** Un solo `upsert` con la lista completa, cruzando por `(usuario_id,
   *  nombre_normalizado)`. Es lo que mantiene el contrato del importador: AGREGA y
   *  ACTUALIZA, nunca borra. Quien está en la app y no en el archivo ni se entera.
   *
   *  Un borrar-y-reinsertar sería más simple de escribir y catastrófico: si se
   *  corta la señal entre el borrado y la inserción, ella se queda sin padrón. */
  async function guardarClientes(clientes) {
    if (clientes.length === 0) return
    await supabase
      .from('clientes')
      .upsert(
        clientes.map((c) => ({ usuario_id: usuarioId, ...filaDesdeCliente(c) })),
        { onConflict: 'usuario_id,nombre_normalizado' },
      )
      .then(oExplota)
  }

  return {
    cargarTodo,
    registrarPago,
    editarFechas,
    agregarParticipante,
    sacarParticipante,
    crearClase,
    editarClase,
    eliminarClase,
    marcarAsistencia,
    guardarClientes,
  }
}
