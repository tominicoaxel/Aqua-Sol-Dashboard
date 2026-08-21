// ─── La planilla del mes ────────────────────────────────────────────────────
// Es la cuenta que ella hacía a mano en el Excel a fin de mes, pero salida de los
// datos que ya están cargados: qué se cobró y por dónde entró, quién pagó, quién
// vino a cada clase y quién la dio.
//
// Dos reglas explican todo lo de abajo:
//
//  1. Los HECHOS son del mes elegido (pagos, asistencias, quién dio cada clase);
//     el PADRÓN es la foto de HOY (clientes, cuotas, horarios, docentes). La base
//     guarda el estado actual de cada ficha, no sus versiones anteriores, así que
//     escribir "el plan que tenía en marzo" sería inventarlo. La planilla lo dice
//     en su hoja de Resumen en vez de dejarlo librado a la interpretación.
//
//  2. Acá todo es puro salvo `descargarMesExcel`: la planilla entera se calcula
//     sin SheetJS y recién al final se la escribe. Eso es lo que permite que la
//     verificación chequee los números sin abrir un archivo, y que SheetJS —512
//     kB— entre recién cuando ella aprieta el botón.

import { ESTADOS } from './estados.js'
import { CUENTAS, TITULARES, cobradoDelMes, cuentaPorId } from './pagos.js'
import { aISO, formatoFecha, hoy, nombreDia, nombreMes, parseISO } from './fechas.js'
import { grupoEdadEspera } from './edades.js'
import { ESTADOS_ESPERA, SIGUE_ESPERANDO } from './listaEspera.js'

// Formatos de celda de Excel. El importe va como NÚMERO con formato de moneda y
// no como el texto "$42.000": un texto no se suma, y lo primero que ella va a
// hacer con esta planilla es sumar una columna.
const FECHA = 'dd/mm/yyyy'
const PESOS = '"$"#,##0'

/** "2026-08" — el mes al que pertenece una fecha. Es el mismo prefijo que ya
 *  tienen las fechas ISO guardadas, así que preguntar "¿es de este mes?" es
 *  comparar texto y no hacer cuentas con zonas horarias. */
export const idDeMes = (fecha) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`

/** "Agosto 2026" — con mayúscula porque es un título, no parte de una oración. */
export function etiquetaDeMes(mesId) {
  const [anio, mes] = mesId.split('-').map(Number)
  const nombre = nombreMes(mes - 1)
  return `${nombre[0].toUpperCase()}${nombre.slice(1)} ${anio}`
}

/** El primer y el último día del mes, en hora local. `new Date(anio, mes, 0)` es
 *  el día cero del mes siguiente, o sea el último del elegido: sirve igual para
 *  febrero, para los meses de 30 y para los de 31. */
export function rangoDelMes(mesId) {
  const [anio, mes] = mesId.split('-').map(Number)
  return { desde: new Date(anio, mes - 1, 1), hasta: new Date(anio, mes, 0) }
}

/** Los datos derivados traen las fechas como `Date` y los crudos como texto ISO.
 *  Esta función acepta las dos formas para que la planilla se pueda armar con
 *  cualquiera de las dos — y devuelve `null` antes que una fecha inválida. */
function comoFecha(valor) {
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor)) return parseISO(valor.slice(0, 10))
  return null
}

/** Los meses que se pueden descargar, del más nuevo al más viejo.
 *
 *  Salen de los datos —un mes sin un solo pago ni una sola asistencia no tiene
 *  nada que bajar— más el mes en curso, que siempre está aunque todavía esté
 *  vacío: es justamente el que ella va a querer el último día del mes. */
export function mesesConDatos(
  { clientes = [], asistencias = {}, dictados = {} } = {},
  referencia = hoy(),
) {
  const ids = new Set([idDeMes(referencia)])

  for (const cliente of clientes) {
    for (const pago of cliente.historial ?? cliente.historialPagos ?? []) {
      const fecha = comoFecha(pago.fecha)
      if (fecha) ids.add(idDeMes(fecha))
    }
  }
  for (const porFecha of [...Object.values(asistencias), ...Object.values(dictados)]) {
    for (const [fechaISO, quienes] of Object.entries(porFecha)) {
      if (quienes?.length) ids.add(fechaISO.slice(0, 7))
    }
  }

  return [...ids]
    .sort()
    .reverse()
    .map((id) => ({ id, etiqueta: etiquetaDeMes(id) }))
}

const porNombre = (a, b) => String(a).localeCompare(String(b), 'es')

/** Encabezado, filas, anchos y formatos declarados juntos, columna por columna:
 *  el título y el formato de una columna no pueden vivir en dos listas separadas
 *  o se agrega una columna al medio y los formatos quedan corridos. */
function armarHoja(nombre, columnas, filas) {
  return {
    nombre,
    filas: [columnas.map((c) => c.titulo), ...filas],
    anchos: columnas.map((c) => c.ancho),
    formatos: Object.fromEntries(
      columnas.map((c, i) => [i, c.formato]).filter(([, formato]) => formato),
    ),
    // Sin filas no hay nada que filtrar, y un autofiltro sobre una hoja vacía
    // molesta más de lo que ayuda.
    filtro: filas.length > 0,
  }
}

/** Toda la planilla del mes, hoja por hoja, sin tocar SheetJS.
 *
 *  `datos` es lo que ya tiene el store derivado: `clientes` con su historial,
 *  `horarios` con sus participantes, `asistencias`, `dictados`, `docentes` y
 *  `listaEspera`. */
export function datosDelMes(datos, mesId) {
  const {
    clientes = [],
    horarios = [],
    asistencias = {},
    dictados = {},
    docentes = [],
    listaEspera = [],
  } = datos ?? {}

  const { desde, hasta } = rangoDelMes(mesId)
  const hastaISO = aISO(hasta)
  const etiqueta = etiquetaDeMes(mesId)
  const clientePorId = new Map(clientes.map((c) => [c.id, c]))
  const docentePorId = new Map(docentes.map((d) => [d.id, d]))

  // ── Los pagos del mes, de todas las fichas juntas ────────────────────────
  const pagos = []
  for (const cliente of clientes) {
    for (const pago of cliente.historial ?? cliente.historialPagos ?? []) {
      const fecha = comoFecha(pago.fecha)
      if (!fecha || idDeMes(fecha) !== mesId) continue
      pagos.push({ ...pago, fecha, cliente })
    }
  }
  pagos.sort((a, b) => a.fecha - b.fecha || porNombre(a.cliente.nombre, b.cliente.nombre))

  // El desglose por titular y por cuenta sale de la MISMA función que pinta el
  // tablero de Inicio. Si la planilla lo recalculara por su cuenta, algún día iba
  // a decir un número distinto del que ella tiene en pantalla.
  const cobrado = cobradoDelMes(clientes, desde)

  // ── Cada vez que se dio una clase en el mes ──────────────────────────────
  // Una fecha entra si tiene asistencia marcada o si quedó registrado quién la
  // dio. Una lista de presentes vacía y sin registro de dictado es una fecha que
  // se abrió y se dejó como estaba: en la base son cero filas, y acá también.
  const dictadas = []
  for (const clase of horarios) {
    const fechas = new Set([
      ...Object.keys(asistencias[clase.id] ?? {}),
      ...Object.keys(dictados[clase.id] ?? {}),
    ])
    for (const fechaISO of fechas) {
      if (!fechaISO.startsWith(mesId)) continue
      const presentes = asistencias[clase.id]?.[fechaISO] ?? []
      const registrado = dictados[clase.id]?.[fechaISO]
      if (!presentes.length && !registrado?.length) continue
      dictadas.push({
        clase,
        fechaISO,
        fecha: parseISO(fechaISO),
        presentes,
        // Sin registro propio, la clase la dio quien está a cargo del horario: es
        // el caso de casi todos los días.
        docenteIds: registrado?.length ? registrado : (clase.docenteIds ?? []),
      })
    }
  }
  dictadas.sort(
    (a, b) => a.fechaISO.localeCompare(b.fechaISO) || a.clase.hora.localeCompare(b.clase.hora),
  )

  const nombresDocentes = (ids) =>
    ids
      .map((id) => docentePorId.get(id)?.nombre)
      .filter(Boolean)
      .sort(porNombre)
      .join(', ') || 'Sin docente asignado'

  const clasesDe = (clienteId) =>
    horarios
      .filter((h) => h.participantes?.includes(clienteId))
      .sort((a, b) => a.dia - b.dia || a.hora.localeCompare(b.hora))
      .map((h) => `${nombreDia(h.dia)} ${h.hora} ${h.actividad}`)
      .join(' · ')

  // Lo cobrado a cada persona en el mes: es la misma lista de pagos mirada desde
  // la ficha, y contesta la pregunta más frecuente de todas ("¿este pagó agosto?").
  const pagosPorCliente = new Map()
  for (const pago of pagos) {
    const previo = pagosPorCliente.get(pago.cliente.id) ?? { cantidad: 0, total: 0 }
    pagosPorCliente.set(pago.cliente.id, {
      cantidad: previo.cantidad + 1,
      total: previo.total + (Number(pago.monto) || 0),
    })
  }

  // La lista de espera se corta al último día del mes: un pedido hecho en
  // septiembre no puede aparecer en la planilla de agosto.
  const espera = listaEspera
    .filter((p) => !p.fechaSolicitud || p.fechaSolicitud <= hastaISO)
    .sort((a, b) => (a.fechaSolicitud ?? '').localeCompare(b.fechaSolicitud ?? ''))
  const pedidosDelMes = espera.filter((p) => p.fechaSolicitud?.startsWith(mesId)).length
  const esperando = espera.filter((p) => SIGUE_ESPERANDO.includes(p.estado)).length

  const asistenciasTotales = dictadas.reduce((a, d) => a + d.presentes.length, 0)
  const conteo = { 'al-dia': 0, 'por-vencer': 0, vencido: 0 }
  for (const c of clientes) if (c.estado in conteo) conteo[c.estado]++

  // ── Las hojas ────────────────────────────────────────────────────────────
  const hojas = [
    // El resumen va primero porque es la hoja que se mira; el resto es el respaldo
    // de estos números. Tres columnas (concepto, cantidad, importe) y no dos, para
    // no mezclar un conteo con un importe en la misma celda: en Excel el formato
    // es de la columna entera y habría que elegir uno solo para las dos cosas.
    {
      nombre: 'Resumen',
      anchos: [46, 12, 16],
      formatos: { 2: PESOS },
      filtro: false,
      filas: [
        [`Datos de ${etiqueta}`, '', ''],
        ['Generado el', formatoFecha(hoy()), ''],
        [],
        ['PADRÓN (como está hoy)', '', ''],
        ['Clientes', clientes.length, ''],
        [ESTADOS['al-dia'].etiqueta, conteo['al-dia'], ''],
        [ESTADOS['por-vencer'].etiqueta, conteo['por-vencer'], ''],
        [ESTADOS.vencido.etiqueta, conteo.vencido, ''],
        [],
        [`COBRADO EN ${etiqueta.toUpperCase()}`, '', ''],
        ['Pagos registrados', cobrado.cantidad, ''],
        ['Total cobrado', '', cobrado.total],
        ...TITULARES.map((t) => [`Transferencias a ${t}`, '', cobrado.porTitular[t]]),
        ['Efectivo', '', cobrado.efectivo],
        ...(cobrado.otros > 0 ? [['Sin detalle de cuenta', '', cobrado.otros]] : []),
        [],
        ['DETALLE POR CUENTA', '', ''],
        ...CUENTAS.map((c) => [c.etiqueta, '', cobrado.porCuenta[c.id]]),
        [],
        ['CLASES', '', ''],
        ['Clases dadas en el mes', dictadas.length, ''],
        ['Asistencias registradas', asistenciasTotales, ''],
        ['Clases en el horario semanal', horarios.length, ''],
        ['Docentes', docentes.length, ''],
        [],
        ['LISTA DE ESPERA', '', ''],
        ['Pedidos hechos en el mes', pedidosDelMes, ''],
        ['Personas todavía esperando', esperando, ''],
        [],
        ['Los pagos, las asistencias y las clases dadas son de este mes.', '', ''],
        ['El padrón, los horarios, las cuotas y los docentes son la foto de hoy:', '', ''],
        ['la app guarda el estado actual de cada ficha, no sus versiones anteriores.', '', ''],
      ],
    },

    armarHoja(
      'Pagos',
      [
        { titulo: 'Fecha', ancho: 12, formato: FECHA },
        { titulo: 'Cliente', ancho: 26 },
        { titulo: 'Plan', ancho: 22 },
        { titulo: 'Importe', ancho: 14, formato: PESOS },
        { titulo: 'Método', ancho: 15 },
        { titulo: 'Cuenta', ancho: 13 },
        { titulo: 'Titular', ancho: 10 },
        { titulo: 'Recibo', ancho: 10 },
      ],
      pagos.map((p) => {
        const cuenta = cuentaPorId(p.cuenta)
        return [
          p.fecha,
          p.cliente.nombre,
          p.cliente.plan ?? '',
          Number(p.monto) || 0,
          p.metodo === 'efectivo' ? 'Efectivo' : 'Transferencia',
          cuenta?.etiqueta ?? '',
          cuenta?.titular ?? '',
          p.recibo ?? '',
        ]
      }),
    ),

    armarHoja(
      'Clientes',
      [
        { titulo: 'Nombre', ancho: 26 },
        { titulo: 'Teléfono', ancho: 16 },
        { titulo: 'Plan', ancho: 22 },
        { titulo: 'Cuota', ancho: 13, formato: PESOS },
        { titulo: 'Estado', ancho: 12 },
        { titulo: 'Último pago', ancho: 13, formato: FECHA },
        { titulo: 'Vence', ancho: 13, formato: FECHA },
        { titulo: 'Cliente desde', ancho: 14, formato: FECHA },
        { titulo: 'Adulto responsable', ancho: 24 },
        { titulo: 'Pagos en el mes', ancho: 15 },
        { titulo: 'Cobrado en el mes', ancho: 17, formato: PESOS },
        { titulo: 'Clases', ancho: 46 },
        { titulo: 'Revisar', ancho: 9 },
      ],
      [...clientes]
        .sort((a, b) => porNombre(a.nombre, b.nombre))
        .map((c) => {
          const delMes = pagosPorCliente.get(c.id) ?? { cantidad: 0, total: 0 }
          return [
            c.nombre,
            c.telefono ?? '',
            c.plan ?? '',
            Number(c.cuota) || 0,
            ESTADOS[c.estado]?.etiqueta ?? '',
            comoFecha(c.pago ?? c.fechaPago) ?? '',
            comoFecha(c.vence ?? c.fechaVencimiento) ?? '',
            comoFecha(c.alta ?? c.fechaAlta) ?? '',
            c.responsable ?? '',
            delMes.cantidad,
            delMes.total,
            clasesDe(c.id),
            // La bandera del importador: la persona entró con una fecha ilegible y
            // hay que confirmarla. Viaja a la planilla para que no se pierda.
            c.revisar ? 'Sí' : '',
          ]
        }),
    ),

    armarHoja(
      'Clases dadas',
      [
        { titulo: 'Fecha', ancho: 12, formato: FECHA },
        { titulo: 'Día', ancho: 11 },
        { titulo: 'Hora', ancho: 8 },
        { titulo: 'Actividad', ancho: 26 },
        { titulo: 'La dieron', ancho: 30 },
        { titulo: 'Presentes', ancho: 11 },
        { titulo: 'Anotados hoy', ancho: 13 },
        { titulo: 'Cupo', ancho: 8 },
      ],
      dictadas.map((d) => [
        d.fecha,
        nombreDia(d.clase.dia),
        d.clase.hora,
        d.clase.actividad,
        nombresDocentes(d.docenteIds),
        d.presentes.length,
        // Los anotados son los de HOY y no los de esa fecha: la app no guarda cómo
        // estaba el grupo hace tres semanas. Por eso la columna lo aclara en su
        // propio título en vez de dejar que se lea como un dato histórico.
        d.clase.participantes?.length ?? 0,
        d.clase.cupo ?? 0,
      ]),
    ),

    armarHoja(
      'Asistencias',
      [
        { titulo: 'Fecha', ancho: 12, formato: FECHA },
        { titulo: 'Día', ancho: 11 },
        { titulo: 'Hora', ancho: 8 },
        { titulo: 'Actividad', ancho: 26 },
        { titulo: 'Persona', ancho: 26 },
        { titulo: 'Plan', ancho: 22 },
      ],
      dictadas.flatMap((d) =>
        d.presentes
          .map((id) => clientePorId.get(id))
          .filter(Boolean)
          .sort((a, b) => porNombre(a.nombre, b.nombre))
          .map((c) => [
            d.fecha,
            nombreDia(d.clase.dia),
            d.clase.hora,
            d.clase.actividad,
            c.nombre,
            c.plan ?? '',
          ]),
      ),
    ),

    armarHoja(
      'Docentes',
      [
        { titulo: 'Nombre', ancho: 26 },
        { titulo: 'Función', ancho: 12 },
        { titulo: 'Teléfono', ancho: 16 },
        { titulo: 'Email', ancho: 26 },
        { titulo: 'Clases a cargo', ancho: 15 },
        { titulo: 'Clases dadas en el mes', ancho: 22 },
      ],
      [...docentes]
        .sort((a, b) => porNombre(a.rol, b.rol) || porNombre(a.nombre, b.nombre))
        .map((d) => [
          d.nombre,
          d.rol === 'suplente' ? 'Suplente' : 'Titular',
          d.telefono ?? '',
          d.email ?? '',
          horarios.filter((h) => (h.docenteIds ?? []).includes(d.id)).length,
          // Cuenta las suplencias: si cubrió un martes que no es suyo, ese martes
          // es de ella. Es el número con el que se le liquida.
          dictadas.filter((x) => x.docenteIds.includes(d.id)).length,
        ]),
    ),

    armarHoja(
      'Lista de espera',
      [
        { titulo: 'Fecha del pedido', ancho: 16, formato: FECHA },
        { titulo: 'Nombre', ancho: 26 },
        { titulo: 'Edad', ancho: 7 },
        { titulo: 'Grupo', ancho: 20 },
        { titulo: 'Teléfono', ancho: 16 },
        { titulo: 'Clase que pidió', ancho: 34 },
        { titulo: 'Estado', ancho: 13 },
        { titulo: 'Pidió en el mes', ancho: 15 },
        { titulo: 'Notas', ancho: 40 },
      ],
      espera.map((p) => {
        const clase = p.clase ?? horarios.find((h) => h.id === p.claseId) ?? null
        return [
          comoFecha(p.fechaSolicitud) ?? '',
          p.nombre,
          p.edad ?? '',
          grupoEdadEspera(p.edad)?.etiqueta ?? '',
          p.telefono ?? '',
          clase ? `${clase.actividad} · ${nombreDia(clase.dia)} ${clase.hora}` : 'Sin clase asignada',
          ESTADOS_ESPERA[p.estado]?.etiqueta ?? p.estado,
          p.fechaSolicitud?.startsWith(mesId) ? 'Sí' : '',
          p.notas ?? '',
        ]
      }),
    ),
  ]

  return {
    mesId,
    etiqueta,
    // Sin acentos ni espacios: el nombre del archivo pasa por el sistema de
    // archivos, por WhatsApp y por el mail de la contadora.
    archivo: `pileta-${nombreMes(desde.getMonth())}-${desde.getFullYear()}.xlsx`,
    hojas,
    // El recuento que la pantalla muestra ANTES de bajar el archivo, para que se
    // sepa qué se está llevando y no haya que abrirlo para enterarse.
    totales: {
      pagos: pagos.length,
      cobrado: cobrado.total,
      clientes: clientes.length,
      clasesDadas: dictadas.length,
      asistencias: asistenciasTotales,
    },
  }
}

/** El formato de número vive en la celda y no en la columna, así que se lo pone
 *  celda por celda. Se saltea el encabezado y las celdas vacías: un '' con
 *  formato de moneda se ve como "$-" y ensucia la columna entera. */
function aplicarFormatos(XLSX, hoja, { filas, formatos }) {
  for (const [columna, z] of Object.entries(formatos)) {
    for (let fila = 1; fila < filas.length; fila++) {
      const celda = hoja[XLSX.utils.encode_cell({ r: fila, c: Number(columna) })]
      if (celda && celda.v !== '' && celda.v != null) celda.z = z
    }
  }
}

/** El libro de Excel ya armado, con SheetJS recibido por parámetro.
 *
 *  Está separado de la descarga a propósito: así la verificación puede escribir el
 *  archivo a un buffer y volver a leerlo —para chequear que los importes sigan
 *  siendo números y las fechas, fechas— sin depender de un navegador que baje
 *  nada. `writeFile` en Node necesita además que le enchufen `fs`; acá no. */
export function libroDelMes(XLSX, datos, mesId) {
  const planilla = datosDelMes(datos, mesId)

  const libro = XLSX.utils.book_new()
  for (const h of planilla.hojas) {
    const hoja = XLSX.utils.aoa_to_sheet(h.filas, { cellDates: true, dateNF: FECHA })
    hoja['!cols'] = h.anchos.map((wch) => ({ wch }))
    aplicarFormatos(XLSX, hoja, h)
    if (h.filtro) {
      hoja['!autofilter'] = {
        ref: XLSX.utils.encode_range({
          s: { r: 0, c: 0 },
          e: { r: h.filas.length - 1, c: h.anchos.length - 1 },
        }),
      }
    }
    XLSX.utils.book_append_sheet(libro, hoja, h.nombre)
  }

  return { libro, planilla }
}

/** Arma el .xlsx y lo baja. Es lo único de este archivo que no es puro y lo único
 *  que necesita SheetJS: por eso el import es dinámico, igual que el del
 *  importador. La biblioteca pesa 512 kB y no puede entrar al bundle de Inicio,
 *  que es la pantalla que ella abre todos los días. */
export async function descargarMesExcel(datos, mesId) {
  const XLSX = await import('xlsx')
  const { libro, planilla } = libroDelMes(XLSX, datos, mesId)
  XLSX.writeFile(libro, planilla.archivo)
  return planilla
}
