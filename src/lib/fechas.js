// Utilidades de fecha. Todo el demo calcula las fechas RELATIVAS al día en que se
// abre, para que no se pudra: si esto tuviera fechas fijas, en dos meses todos los
// clientes aparecerían vencidos y la demo dejaría de contar la historia.

const MS_POR_DIA = 24 * 60 * 60 * 1000

export function hoy() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function sumarDias(fecha, dias) {
  const d = new Date(fecha)
  d.setDate(d.getDate() + dias)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Días enteros desde `desde` hasta `hasta` (negativo si `hasta` ya pasó). */
export function diasEntre(desde, hasta) {
  return Math.round((hasta.getTime() - desde.getTime()) / MS_POR_DIA)
}

/** 14/08/2026 — formato argentino, pensado para leerse en columna con mono. */
export function formatoFecha(fecha) {
  const dd = String(fecha.getDate()).padStart(2, '0')
  const mm = String(fecha.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${fecha.getFullYear()}`
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** "agosto" — en minúscula, que es como se lee dentro de una oración. */
export function nombreMes(indice) {
  return MESES[indice]
}

export function formatoFechaLarga(fecha) {
  return `${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`
}

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export function nombreDia(indice) {
  return DIAS_SEMANA[indice]
}

/** "todos los lunes" pero "todos los sábados": los días de lunes a viernes no
 *  cambian en plural, sábado y domingo sí. */
export function nombreDiaPlural(indice) {
  const d = DIAS_SEMANA[indice]
  return d.endsWith('s') ? d : `${d}s`
}

/** La fecha en que cayó por última vez ese día de la semana (hoy mismo, si es hoy).
 *  `semanasAtras` retrocede de a una semana.
 *
 *  Sirve para la asistencia: una clase de los martes se toma sobre el martes que
 *  pasó, no sobre el que viene — la lista se marca durante o después de la clase,
 *  nunca antes. */
export function ocurrenciaMasReciente(dia, semanasAtras = 0) {
  const h = hoy()
  const diasDesde = (h.getDay() - dia + 7) % 7
  return sumarDias(h, -diasDesde - semanasAtras * 7)
}

/** 0 = domingo … 6 = sábado, igual que Date.getDay(). */
export function diaDeHoy() {
  return hoy().getDay()
}

/** "en 12 días" / "vence hoy" / "hace 5 días" — el texto que acompaña al color. */
export function textoVencimiento(dias) {
  if (dias === 0) return 'vence hoy'
  if (dias === 1) return 'vence mañana'
  if (dias === -1) return 'venció ayer'
  if (dias > 1) return `en ${dias} días`
  return `hace ${Math.abs(dias)} días`
}

/** Antigüedad como cliente, en la unidad que se entiende sola. */
export function textoAntiguedad(dias) {
  if (dias < 14) return `${dias} días`
  if (dias < 60) return `${Math.round(dias / 7)} semanas`
  const meses = Math.round(dias / 30.44)
  if (meses < 12) return `${meses} meses`
  const años = Math.floor(meses / 12)
  const resto = meses % 12
  const base = años === 1 ? '1 año' : `${años} años`
  return resto === 0 ? base : `${base} ${resto} ${resto === 1 ? 'mes' : 'meses'}`
}

export function formatoMonto(pesos) {
  return `$${pesos.toLocaleString('es-AR')}`
}

/** Parsea "2026-08-14" en hora LOCAL.
 *  `new Date('2026-08-14')` se interpreta como UTC y en Argentina (UTC-3) devuelve
 *  el día anterior. Este parseo evita ese corrimiento de un día. */
export function parseISO(texto) {
  const [a, m, d] = texto.split('-').map(Number)
  return new Date(a, m - 1, d)
}

/** Suma meses de calendario, no 30 días: el 31/01 + 1 mes es el 28/02, no el 02/03.
 *  Es el ciclo de cobro mensual del que habla el panel de pagos. */
export function sumarMeses(fecha, meses) {
  const d = new Date(fecha)
  const diaOriginal = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + meses)
  const ultimoDelMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(diaOriginal, ultimoDelMes))
  d.setHours(0, 0, 0, 0)
  return d
}

/** Date -> "2026-08-14". Es el formato que piden los <input type="date"> y el que
 *  se guarda en localStorage, para que lo persistido tenga la misma forma que los
 *  datos de ejemplo. */
export function aISO(fecha) {
  const mm = String(fecha.getMonth() + 1).padStart(2, '0')
  const dd = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mm}-${dd}`
}
