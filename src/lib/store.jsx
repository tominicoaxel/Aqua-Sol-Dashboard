import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { derivarClientes, derivarHorarios } from './datos.js'
import { aISO, hoy, parseISO, sumarMeses } from './fechas.js'
import { mensajeDeError, useSesion } from './sesion.jsx'
import { crearPersistencia } from './persistencia.js'

// ─── El estado compartido de la app ─────────────────────────
// Clientes y Horarios se editan desde los dos paneles y se leen desde los dos, así
// que no puede haber una copia por componente: hay una sola fuente y todo lo demás
// se deriva de ella en cada render. Eso es lo que hace que sacar a alguien de una
// clase se vea al toque en su ficha, sin sincronizar nada a mano.
//
// Los datos viven en Supabase. Lo que cambió al dejar de ser un demo es de dónde
// SALE el estado y adónde SE GUARDA — no la lógica: las mutaciones de más abajo
// siguen siendo las mismas funciones puras de siempre.

const VACIO = { clientes: [], horarios: [], asistencias: {}, docentes: [], listaEspera: [] }

const nuevoId = () => globalThis.crypto.randomUUID()

const DatosContext = createContext(null)

// ─── Mutaciones ─────────────────────────────────────────────────────────────
// Cada cambio es una función pura de (datos crudos) -> (datos crudos nuevos). Vive
// afuera del componente a propósito: así el mismo código que corre en la app se
// puede correr en una verificación, sin navegador de por medio.

/** Registra un pago: mueve las fechas Y lo asienta en el historial. Si la ficha
 *  dijera arriba que pagó y abajo no lo mostrara, el número dejaría de ser
 *  confiable. */
export function conPagoRegistrado(crudos, id, { fecha, monto, metodo, cuenta, recibo, vencimiento }) {
  // Se guarda SOLO el dato que corresponde al método elegido. Si alguien tipeó un
  // número de recibo, después cambió a transferencia y confirmó, ese recibo no
  // tiene que quedar colgado en el registro contradiciendo al método.
  const detalle =
    metodo === 'transferencia'
      ? { metodo, cuenta }
      : { metodo, ...(recibo ? { recibo } : {}) }

  return {
    ...crudos,
    clientes: crudos.clientes.map((c) =>
      c.id === id
        ? {
            ...c,
            fechaPago: fecha,
            fechaVencimiento: vencimiento,
            historialPagos: [{ fecha, monto, ...detalle }, ...c.historialPagos],
          }
        : c,
    ),
  }
}

/** Conserva intacta la mutación histórica de registrar y le suma el id que ya se
 *  generó antes. Así el pago nuevo se puede corregir sin obligar a recargar la
 *  ficha para recuperar el UUID que quedó en la base. */
export function conPagoIdentificado(crudos, clienteId, pago) {
  const registrados = conPagoRegistrado(crudos, clienteId, pago)
  return {
    ...registrados,
    clientes: registrados.clientes.map((c) =>
      c.id === clienteId
        ? { ...c, historialPagos: [{ ...c.historialPagos[0], id: pago.id }, ...c.historialPagos.slice(1)] }
        : c,
    ),
  }
}

/** Corrige un asiento existente. Solo si es el último pago también actualiza las
 *  fechas principales de la ficha; editar un pago viejo no debe cambiar el estado
 *  actual de la cuota. */
export function conPagoEditado(crudos, clienteId, pagoId, cambios, actualizarFechas = false) {
  const detalle =
    cambios.metodo === 'transferencia'
      ? { metodo: cambios.metodo, cuenta: cambios.cuenta }
      : { metodo: cambios.metodo, ...(cambios.recibo ? { recibo: cambios.recibo } : {}) }

  return {
    ...crudos,
    clientes: crudos.clientes.map((c) => {
      if (c.id !== clienteId) return c
      return {
        ...c,
        ...(actualizarFechas
          ? { fechaPago: cambios.fecha, fechaVencimiento: cambios.vencimiento }
          : {}),
        historialPagos: c.historialPagos.map((p) =>
          p.id === pagoId ? { id: p.id, fecha: cambios.fecha, monto: cambios.monto, ...detalle } : p,
        ),
      }
    }),
  }
}

/** Corrección a mano de las fechas (un descuento, un pago con otra fecha). No toca
 *  el historial: no es un pago nuevo, es un ajuste del que ya estaba. */
export function conFechasEditadas(crudos, id, { fechaPago, fechaVencimiento }) {
  return {
    ...crudos,
    clientes: crudos.clientes.map((c) =>
      c.id === id ? { ...c, fechaPago, fechaVencimiento } : c,
    ),
  }
}

export function conParticipanteAgregado(crudos, horarioId, clienteId) {
  return {
    ...crudos,
    horarios: crudos.horarios.map((h) =>
      h.id === horarioId && !h.participantes.includes(clienteId)
        ? { ...h, participantes: [...h.participantes, clienteId] }
        : h,
    ),
  }
}

export function conParticipanteSacado(crudos, horarioId, clienteId) {
  return {
    ...crudos,
    horarios: crudos.horarios.map((h) =>
      h.id === horarioId ? { ...h, participantes: h.participantes.filter((p) => p !== clienteId) } : h,
    ),
  }
}

/** Id libre para una clase nueva. No usa Date.now() para que dos corridas con los
 *  mismos pasos den el mismo resultado y se pueda verificar. */
/** Marca o desmarca que alguien vino a la clase de una fecha puntual.
 *
 *  La asistencia cuelga de (clase, fecha) y no de la persona: el grupo es fijo
 *  todas las semanas, así que una marca sin fecha sería permanente y no diría
 *  nada. Se guarda solo la lista de los que vinieron; el que no está, no vino. */
export function conAsistenciaMarcada(crudos, claseId, fechaISO, clienteId, presente) {
  const deLaClase = crudos.asistencias?.[claseId] ?? {}
  const delDia = deLaClase[fechaISO] ?? []
  const actualizado = presente
    ? delDia.includes(clienteId)
      ? delDia
      : [...delDia, clienteId]
    : delDia.filter((id) => id !== clienteId)

  return {
    ...crudos,
    asistencias: { ...crudos.asistencias, [claseId]: { ...deLaClase, [fechaISO]: actualizado } },
  }
}

export function generarIdClase(horarios) {
  const usados = new Set(horarios.map((h) => h.id))
  let n = horarios.length + 1
  while (usados.has(`clase-${n}`)) n++
  return `clase-${n}`
}

export function conClaseCreada(crudos, datos) {
  return {
    ...crudos,
    horarios: [
      ...crudos.horarios,
      { id: generarIdClase(crudos.horarios), participantes: [], docenteIds: [], ...datos },
    ],
  }
}

/** Edita los campos de una clase sin tocar la lista de anotados: bajar el cupo no
 *  echa a nadie, solo deja la clase por encima del cupo y avisando. */
export function conClaseEditada(crudos, id, cambios) {
  return {
    ...crudos,
    horarios: crudos.horarios.map((h) => (h.id === id ? { ...h, ...cambios } : h)),
  }
}

export function conClaseEliminada(crudos, id) {
  // Si se va la clase, se va su asistencia: no tiene sentido guardar quién vino a
  // una clase que ya no existe.
  const asistencias = { ...crudos.asistencias }
  delete asistencias[id]
  return {
    ...crudos,
    horarios: crudos.horarios.filter((h) => h.id !== id),
    asistencias,
    listaEspera: (crudos.listaEspera ?? []).map((p) =>
      p.claseId === id ? { ...p, claseId: null } : p,
    ),
  }
}

/** Reemplaza la lista de clientes de una. Es lo que usa el importador: el wizard
 *  ya calculó y mostró el resultado exacto con `aplicarClientes`, así que acá se
 *  guarda esa misma lista y no se vuelve a calcular nada — lo que ella confirmó en
 *  la vista previa es exactamente lo que queda. */
export function conClientesReemplazados(crudos, clientes) {
  return { ...crudos, clientes }
}

export function conDocenteCreado(crudos, docente) {
  return { ...crudos, docentes: [...(crudos.docentes ?? []), docente] }
}

// Los horarios no se tocan al editar a alguien: el nombre que muestra cada clase se
// arma en `derivarHorarios` a partir de esta misma lista, así que cambiarlo acá
// alcanza para que cambie en todas sus clases.
export function conDocenteEditado(crudos, id, cambios) {
  return {
    ...crudos,
    docentes: (crudos.docentes ?? []).map((d) => (d.id === id ? { ...d, ...cambios } : d)),
  }
}

/** Sale del padrón de docentes y de todas las clases donde estaba. Las clases que
 *  quedaban solo a su cargo pasan a "sin docente"; las que comparte con otra
 *  persona siguen a cargo de quien queda. */
export function conDocenteEliminado(crudos, id) {
  return {
    ...crudos,
    docentes: (crudos.docentes ?? []).filter((d) => d.id !== id),
    horarios: crudos.horarios.map((h) =>
      (h.docenteIds ?? []).includes(id)
        ? { ...h, docenteIds: h.docenteIds.filter((d) => d !== id) }
        : h,
    ),
  }
}

/** Suma o saca a una docente de una clase sin pisar al resto del equipo. Es lo que
 *  usa el panel de Docentes: dos profes y una suplente en el mismo horario conviven,
 *  asignar a alguien nuevo ya no transfiere la clase. */
export function conDocenteEnClase(crudos, claseId, docenteId, incluir) {
  return {
    ...crudos,
    horarios: crudos.horarios.map((h) => {
      if (h.id !== claseId) return h
      const actuales = h.docenteIds ?? []
      if (incluir === actuales.includes(docenteId)) return h
      return {
        ...h,
        docenteIds: incluir ? [...actuales, docenteId] : actuales.filter((d) => d !== docenteId),
      }
    }),
  }
}

export function conPersonaEnEsperaCreada(crudos, persona) {
  return { ...crudos, listaEspera: [...(crudos.listaEspera ?? []), persona] }
}

export function conPersonaEnEsperaEditada(crudos, id, cambios) {
  return {
    ...crudos,
    listaEspera: (crudos.listaEspera ?? []).map((p) => (p.id === id ? { ...p, ...cambios } : p)),
  }
}

export function conPersonaEnEsperaEliminada(crudos, id) {
  return { ...crudos, listaEspera: (crudos.listaEspera ?? []).filter((p) => p.id !== id) }
}

export function ProveedorDatos({ children, datosIniciales = null }) {
  const { usuario } = useSesion()
  // `datosIniciales` es la costura por la que la verificación monta la app con un
  // padrón de prueba sin salir a la red. La app nunca lo pasa.
  const [crudos, setCrudos] = useState(datosIniciales ?? VACIO)
  const [cargando, setCargando] = useState(!datosIniciales)
  const [errorCarga, setErrorCarga] = useState(null)
  const [errorRed, setErrorRed] = useState(null)
  const [aviso, setAviso] = useState(null)
  const temporizador = useRef(null)

  // El estado de referencia para poder revertir. `crudos` leído dentro de un
  // callback asíncrono sería el del momento en que se creó el callback, no el de
  // ahora — y revertir a un estado viejo es peor que no revertir.
  const actual = useRef(crudos)
  actual.current = crudos

  const db = useMemo(() => (usuario ? crearPersistencia(usuario.id) : null), [usuario])

  const cargar = useCallback(async () => {
    if (!db) return
    setCargando(true)
    setErrorCarga(null)
    try {
      setCrudos(await db.cargarTodo())
    } catch (e) {
      setErrorCarga(mensajeDeError(e))
    } finally {
      setCargando(false)
    }
  }, [db])

  useEffect(() => {
    if (datosIniciales || !db) return
    cargar()
  }, [db, cargar, datosIniciales])

  useEffect(() => () => clearTimeout(temporizador.current), [])

  /** Confirmación visible de que la acción pasó. Sin esto el cambio es mudo y no
   *  se sabe si el click hizo algo. */
  const avisar = useCallback((texto) => {
    setAviso({ texto, id: Date.now() })
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setAviso(null), 4000)
  }, [])

  const cerrarAviso = useCallback(() => {
    clearTimeout(temporizador.current)
    setAviso(null)
  }, [])

  /** El corazón de la actualización optimista.
   *
   *  La pantalla cambia ANTES de que el servidor conteste, porque ella usa esto
   *  parada al borde de la pileta con mala señal: registrar un pago no puede
   *  sentirse lento. Si el servidor rechaza, se vuelve atrás y se dice qué pasó,
   *  con la opción de reintentar. Lo que no puede pasar nunca es que la pantalla
   *  quede mostrando un cambio que no se guardó.
   *
   *  `mutar` es una de las funciones puras de arriba. `escribir` recibe el estado
   *  ya calculado, para los casos como crear una clase donde el id lo genera la
   *  mutación y recién ahí se sabe qué mandar. */
  const aplicar = useCallback(
    async function ejecutar(mutar, escribir) {
      if (!db) return
      const anterior = actual.current
      const nuevo = mutar(anterior)
      setCrudos(nuevo)
      setErrorRed(null)
      try {
        await escribir(nuevo, anterior)
      } catch (e) {
        setCrudos(anterior)
        setErrorRed({ ...mensajeDeError(e), reintentar: () => ejecutar(mutar, escribir) })
      }
    },
    [db],
  )

  const descartarErrorRed = useCallback(() => setErrorRed(null), [])

  const acciones = useMemo(
    () => ({
      registrarPago: (id, datos) => {
        const completos = { ...datos, id: nuevoId() }
        return aplicar(
          (prev) => conPagoIdentificado(prev, id, completos),
          () => db.registrarPago(id, completos),
        )
      },
      editarPago: (clienteId, pagoId, cambios, actualizarFechas) =>
        aplicar(
          (prev) => conPagoEditado(prev, clienteId, pagoId, cambios, actualizarFechas),
          (_nuevo, anterior) => {
            const cliente = anterior.clientes.find((c) => c.id === clienteId)
            const pago = cliente?.historialPagos.find((p) => p.id === pagoId)
            return db.editarPago(clienteId, pagoId, cambios, actualizarFechas, {
              pago,
              fechaPago: cliente?.fechaPago,
              fechaVencimiento: cliente?.fechaVencimiento,
            })
          },
        ),
      editarFechas: (id, datos) =>
        aplicar(
          (prev) => conFechasEditadas(prev, id, datos),
          () => db.editarFechas(id, datos),
        ),
      agregarParticipante: (hId, cId) =>
        aplicar(
          (prev) => conParticipanteAgregado(prev, hId, cId),
          () => db.agregarParticipante(hId, cId),
        ),
      sacarParticipante: (hId, cId) =>
        aplicar(
          (prev) => conParticipanteSacado(prev, hId, cId),
          () => db.sacarParticipante(hId, cId),
        ),
      crearClase: (datos) =>
        aplicar(
          (prev) => conClaseCreada(prev, datos),
          // El id lo genera `conClaseCreada`, así que la clase a guardar es la que
          // quedó al final de la lista nueva.
          (nuevo) => db.crearClase(nuevo.horarios[nuevo.horarios.length - 1]),
        ),
      editarClase: (id, cambios) =>
        aplicar(
          (prev) => conClaseEditada(prev, id, cambios),
          () => db.editarClase(id, cambios),
        ),
      eliminarClase: (id) =>
        aplicar(
          (prev) => conClaseEliminada(prev, id),
          () => db.eliminarClase(id),
        ),
      // Suma o saca a una sola docente. La lista completa se lee del estado YA
      // mutado: es la única que contempla al resto del equipo, que no se toca.
      cambiarDocenteDeClase: (claseId, docenteId, incluir) =>
        aplicar(
          (prev) => conDocenteEnClase(prev, claseId, docenteId, incluir),
          (nuevo) =>
            db.editarClase(claseId, {
              docenteIds: nuevo.horarios.find((h) => h.id === claseId)?.docenteIds ?? [],
            }),
        ),
      marcarAsistencia: (claseId, fechaISO, clienteId, presente) =>
        aplicar(
          (prev) => conAsistenciaMarcada(prev, claseId, fechaISO, clienteId, presente),
          () => db.marcarAsistencia(claseId, fechaISO, clienteId, presente),
        ),
      reemplazarClientes: (clientes) =>
        aplicar(
          (prev) => conClientesReemplazados(prev, clientes),
          () => db.guardarClientes(clientes),
        ),
      crearDocente: (datos) => {
        const docente = { id: nuevoId(), ...datos }
        return aplicar(
          (prev) => conDocenteCreado(prev, docente),
          () => db.crearDocente(docente),
        )
      },
      editarDocente: (id, cambios) =>
        aplicar(
          (prev) => conDocenteEditado(prev, id, cambios),
          () => db.editarDocente(id, cambios),
        ),
      eliminarDocente: (id) =>
        aplicar(
          (prev) => conDocenteEliminado(prev, id),
          () => db.eliminarDocente(id),
        ),
      crearEnEspera: (datos) => {
        const persona = { id: nuevoId(), ...datos }
        return aplicar(
          (prev) => conPersonaEnEsperaCreada(prev, persona),
          () => db.crearEnEspera(persona),
        )
      },
      editarEnEspera: (id, cambios) =>
        aplicar(
          (prev) => conPersonaEnEsperaEditada(prev, id, cambios),
          () => db.editarEnEspera(id, cambios),
        ),
      eliminarDeEspera: (id) =>
        aplicar(
          (prev) => conPersonaEnEsperaEliminada(prev, id),
          () => db.eliminarDeEspera(id),
        ),
    }),
    [aplicar, db],
  )

  const valor = useMemo(() => {
    const clientes = derivarClientes(crudos.clientes)
    const porId = new Map(clientes.map((c) => [c.id, c]))
    const docentesCrudos = crudos.docentes ?? []
    const docentesPorId = new Map(docentesCrudos.map((d) => [d.id, d]))
    const horarios = derivarHorarios(crudos.horarios, porId, docentesPorId)
    const docentes = docentesCrudos
      .map((d) => ({ ...d, clases: horarios.filter((h) => h.docenteIds.includes(d.id)) }))
      .sort((a, b) => a.rol.localeCompare(b.rol) || a.nombre.localeCompare(b.nombre, 'es'))
    const listaEspera = (crudos.listaEspera ?? [])
      .map((p) => ({ ...p, clase: horarios.find((h) => h.id === p.claseId) ?? null }))
      .sort((a, b) => a.fechaSolicitud.localeCompare(b.fechaSolicitud))
    return {
      clientes,
      horarios,
      docentes,
      listaEspera,
      // El importador trabaja contra la forma cruda, que es la que se guarda.
      clientesCrudos: crudos.clientes,
      asistencias: crudos.asistencias ?? {},
      clientePorId: (id) => porId.get(id),
      horarioPorId: (id) => horarios.find((h) => h.id === id),
      cargando,
      errorCarga,
      reintentarCarga: cargar,
      // La primera vez la base está vacía: no es un error, es el punto de partida.
      vacio: !cargando && !errorCarga && clientes.length === 0 && horarios.length === 0,
      errorRed,
      descartarErrorRed,
      aviso,
      avisar,
      cerrarAviso,
      ...acciones,
    }
  }, [
    crudos,
    cargando,
    errorCarga,
    cargar,
    errorRed,
    descartarErrorRed,
    aviso,
    avisar,
    cerrarAviso,
    acciones,
  ])

  return <DatosContext.Provider value={valor}>{children}</DatosContext.Provider>
}

export function useDatos() {
  const valor = useContext(DatosContext)
  if (!valor) throw new Error('useDatos() necesita estar dentro de <ProveedorDatos>')
  return valor
}

/** El vencimiento que corresponde a un pago hecho en esa fecha: un mes después.
 *  Si el ciclo de cobro real no fuera mensual, se cambia acá y nada más. */
export function vencimientoPara(fechaISO) {
  return aISO(sumarMeses(parseISO(fechaISO), 1))
}

export const isoDeHoy = () => aISO(hoy())
