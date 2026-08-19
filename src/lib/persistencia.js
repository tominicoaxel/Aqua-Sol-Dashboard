import { supabase } from './supabase.js'
import {
  armarCrudos,
  cambiosDeClase,
  filaDesdeClase,
  filaDesdeCliente,
  filaDesdeDocente,
  filaDesdeEspera,
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
    const [
      clientes, clases, participantes, pagos, asistencias, docentes, claseDocentes, clasesDictadas,
      listaEspera,
    ] = await Promise.all([
        supabase.from('clientes').select('*').order('nombre').then(oExplota),
        supabase.from('clases').select('*').order('dia').order('hora').then(oExplota),
        supabase.from('participantes').select('*').then(oExplota),
        supabase.from('pagos').select('*').order('fecha', { ascending: false }).then(oExplota),
        supabase.from('asistencias').select('*').then(oExplota),
        supabase.from('docentes').select('*').order('rol').order('nombre').then(oExplota),
        supabase.from('clase_docentes').select('*').then(oExplota),
        supabase.from('clases_dictadas').select('*').then(oExplota),
        supabase.from('lista_espera').select('*').order('fecha_solicitud').then(oExplota),
      ])
    return armarCrudos({
      clientes, clases, participantes, pagos, asistencias, docentes, claseDocentes, clasesDictadas,
      listaEspera,
    })
  }

  // ── Pagos ────────────────────────────────────────────────────────────────
  /** Un pago son dos escrituras: el asiento en el historial y las fechas del
   *  cliente. Postgres no las hace atómicas desde el cliente, así que si la
   *  segunda falla se deshace la primera a mano. Sin esa compensación quedaría un
   *  pago cobrado que la ficha no refleja — el peor de los dos estados posibles. */
  async function registrarPago(clienteId, { id, fecha, monto, metodo, cuenta, recibo, vencimiento }) {
    const insertado = await supabase
      .from('pagos')
      .insert({ usuario_id: usuarioId, ...filaDesdePago(clienteId, { id, fecha, monto, metodo, cuenta, recibo }) })
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

  /** Corregir el último pago también mueve las fechas visibles de la ficha. Son
   *  dos escrituras, así que si falla la segunda se devuelve el asiento a su valor
   *  anterior para no dejar el resumen contradiciendo al historial. */
  async function editarPago(clienteId, pagoId, cambios, actualizarFechas, anterior) {
    const filaNueva = filaDesdePago(clienteId, { id: pagoId, ...cambios })
    delete filaNueva.id

    await supabase
      .from('pagos')
      .update(filaNueva)
      .eq('id', pagoId)
      .eq('cliente_id', clienteId)
      .select('id')
      .single()
      .then(oExplota)

    if (!actualizarFechas) return

    try {
      await supabase
        .from('clientes')
        .update({ fecha_ultimo_pago: cambios.fecha, fecha_vencimiento: cambios.vencimiento })
        .eq('id', clienteId)
        .then(oExplota)
    } catch (e) {
      const filaAnterior = filaDesdePago(clienteId, anterior.pago)
      delete filaAnterior.id
      await supabase.from('pagos').update(filaAnterior).eq('id', pagoId)
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
    await guardarDocentesDeClase(clase.id, clase.docenteIds ?? [])
  }

  async function editarClase(id, cambios) {
    const columnas = cambiosDeClase(cambios)
    // Un `update` sin campos es un viaje al servidor para no cambiar nada: pasa
    // cada vez que solo se suma o se saca a una docente.
    if (Object.keys(columnas).length) {
      await supabase.from('clases').update(columnas).eq('id', id).then(oExplota)
    }
    if ('docenteIds' in cambios) await guardarDocentesDeClase(id, cambios.docenteIds ?? [])
  }

  /** El equipo a cargo de una clase se reemplaza entero: son dos o tres filas, y
   *  calcular el diff acá sería repetir en el cliente lo que la clave primaria
   *  compuesta ya garantiza. Se borra primero para que sacar a alguien funcione
   *  igual que sumarlo. */
  async function guardarDocentesDeClase(claseId, docenteIds) {
    await supabase.from('clase_docentes').delete().eq('clase_id', claseId).then(oExplota)
    if (!docenteIds.length) return
    await supabase
      .from('clase_docentes')
      .insert(docenteIds.map((docenteId) => ({ clase_id: claseId, docente_id: docenteId })))
      .then(oExplota)
  }

  /** Se lleva participantes y asistencias por cascada, definida en la migración.
   *  Borrarlas acá a mano sería una segunda definición de la regla. */
  async function eliminarClase(id) {
    await supabase.from('clases').delete().eq('id', id).then(oExplota)
  }

  // ── Docentes ────────────────────────────────────────────────────────────
  async function crearDocente(docente) {
    await supabase
      .from('docentes')
      .insert({ usuario_id: usuarioId, ...filaDesdeDocente(docente) })
      .then(oExplota)
  }

  async function editarDocente(id, cambios) {
    const fila = filaDesdeDocente({ id, ...cambios })
    delete fila.id
    await supabase.from('docentes').update(fila).eq('id', id).then(oExplota)
  }

  async function eliminarDocente(id) {
    await supabase.from('docentes').delete().eq('id', id).then(oExplota)
  }

  // ── Lista de espera ─────────────────────────────────────────────────────
  async function crearEnEspera(persona) {
    await supabase
      .from('lista_espera')
      .insert({ usuario_id: usuarioId, ...filaDesdeEspera(persona) })
      .then(oExplota)
  }

  async function editarEnEspera(id, cambios) {
    const fila = filaDesdeEspera({ id, ...cambios })
    delete fila.id
    await supabase.from('lista_espera').update(fila).eq('id', id).then(oExplota)
  }

  async function eliminarDeEspera(id) {
    await supabase.from('lista_espera').delete().eq('id', id).then(oExplota)
  }

  // ── Asistencia ───────────────────────────────────────────────────────────
  /** Se guarda solo a quien vino: marcar es insertar, desmarcar es borrar. No hay
   *  fila que diga "faltó" — el que no está, no vino. */
  /** Deja constancia de quiénes dieron la clase de una fecha. Se reemplaza la fecha
   *  entera y no la fila suelta: son una o dos filas, y sumar a una suplente puede
   *  arrastrar también a la titular que estaba a cargo. Sin filas, la dio quien
   *  figura en el horario. */
  async function guardarDictadoDelDia(claseId, fechaISO, docenteIds) {
    await supabase
      .from('clases_dictadas')
      .delete()
      .eq('clase_id', claseId)
      .eq('fecha', fechaISO)
      .then(oExplota)
    if (!docenteIds.length) return
    await supabase
      .from('clases_dictadas')
      .insert(docenteIds.map((id) => ({ clase_id: claseId, fecha: fechaISO, docente_id: id })))
      .then(oExplota)
  }

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
    editarPago,
    editarFechas,
    agregarParticipante,
    sacarParticipante,
    crearClase,
    editarClase,
    eliminarClase,
    crearDocente,
    editarDocente,
    eliminarDocente,
    crearEnEspera,
    editarEnEspera,
    eliminarDeEspera,
    marcarAsistencia,
    guardarDictadoDelDia,
    guardarClientes,
  }
}
