// ─── Carga en Supabase del payload de la planilla ───────────────────────────
// Toma el JSON que produce `leer-planilla.mjs` y lo escribe en la base.
//
//   node scripts/cargar-planilla.mjs <payload.json> [--limpiar | --sumar]
//
// Sin bandera se niega a escribir si ya hay clientes: la planilla se carga una vez y
// después la app es la fuente de verdad. Reimportar encima duplicaría pagos y
// asistencias, que no tienen upsert por nombre como sí tiene `clientes`.
//
//   --limpiar  borra todo lo de esta usuaria y vuelve a cargar de cero.
//   --sumar    agrega una segunda hoja al padrón que ya está. Quien aparezca en las
//              dos con el mismo nombre NO se duplica: se reusa su ficha, se la anota
//              también en las clases nuevas y se le recalcula el plan.
//
// Va por REST y no por `@supabase/supabase-js` a propósito: el cliente arrastra
// realtime, que en Node 20 explota buscando un WebSocket nativo que no existe.

import { readFileSync } from 'node:fs'
import { credencialesSupabase, haySesionDePrueba } from '../verificacion/entorno.mjs'
import { nombrePlan } from './plan.mjs'

const [rutaPayload] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const limpiar = process.argv.includes('--limpiar')
const sumar = process.argv.includes('--sumar')

if (!rutaPayload || (limpiar && sumar)) {
  console.error('uso: node scripts/cargar-planilla.mjs <payload.json> [--limpiar | --sumar]')
  process.exit(1)
}
if (!haySesionDePrueba()) {
  console.error('\nFaltan credenciales en .env.local (las cuatro). Ver supabase/LEEME.md.\n')
  process.exit(1)
}

const { url, anon, email, password } = credencialesSupabase()
const payload = JSON.parse(readFileSync(rutaPayload, 'utf8'))

// ── Sesión ──────────────────────────────────────────────────────────────────
const respuestaLogin = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
const sesion = await respuestaLogin.json()
if (!sesion.access_token) {
  console.error(`\nNo se pudo entrar: ${sesion.error_description ?? sesion.msg ?? JSON.stringify(sesion)}\n`)
  process.exit(1)
}
const usuarioId = sesion.user.id
const cabeceras = {
  apikey: anon,
  Authorization: `Bearer ${sesion.access_token}`,
  'Content-Type': 'application/json',
}

console.log(`\n── Carga de la planilla ─────────────────────────────────────`)
console.log(`  Entrando como ${email}`)

const contar = async (tabla) => {
  const r = await fetch(`${url}/rest/v1/${tabla}?select=*`, {
    headers: { ...cabeceras, Prefer: 'count=exact', Range: '0-0' },
  })
  return Number(r.headers.get('content-range')?.split('/')[1] ?? 0)
}

const traer = async (tabla, consulta) => {
  const r = await fetch(`${url}/rest/v1/${tabla}?${consulta}`, { headers: cabeceras })
  if (!r.ok) throw new Error(`leer ${tabla}: ${r.status} ${await r.text()}`)
  return r.json()
}

const parchear = async (tabla, filtro, cambios) => {
  const r = await fetch(`${url}/rest/v1/${tabla}?${filtro}`, {
    method: 'PATCH',
    headers: { ...cabeceras, Prefer: 'return=minimal' },
    body: JSON.stringify(cambios),
  })
  if (!r.ok) throw new Error(`actualizar ${tabla}: ${r.status} ${await r.text()}`)
}

const borrar = async (tabla, filtro) => {
  const r = await fetch(`${url}/rest/v1/${tabla}?${filtro}`, { method: 'DELETE', headers: cabeceras })
  if (!r.ok) throw new Error(`borrar ${tabla}: ${r.status} ${await r.text()}`)
}

/** Inserta de a tandas: 200 filas por request entran cómodas y si algo falla el
 *  error dice en qué tanda fue. */
const insertar = async (tabla, filas, tanda = 200) => {
  for (let i = 0; i < filas.length; i += tanda) {
    const r = await fetch(`${url}/rest/v1/${tabla}`, {
      method: 'POST',
      headers: { ...cabeceras, Prefer: 'return=minimal' },
      body: JSON.stringify(filas.slice(i, i + tanda)),
    })
    if (!r.ok) throw new Error(`${tabla} [${i}..${i + tanda}): ${r.status} ${await r.text()}`)
  }
  console.log(`  ${String(filas.length).padStart(4)} ${tabla}`)
}

// ── ¿Ya hay algo? ───────────────────────────────────────────────────────────
const yaHay = await contar('clientes')
if (yaHay > 0 && !limpiar && !sumar) {
  console.error(`\n  La base ya tiene ${yaHay} cliente(s). No se escribe encima.`)
  console.error(`  Para agregar esta hoja al padrón:  ... ${rutaPayload} --sumar`)
  console.error(`  Para reemplazar todo:              ... ${rutaPayload} --limpiar\n`)
  process.exit(1)
}

if (limpiar) {
  console.log('  Borrando lo que había…')
  // En este orden por las claves foráneas.
  await borrar('asistencias', 'cliente_id=gte.0')
  await borrar('participantes', 'cliente_id=gte.0')
  await borrar('pagos', `usuario_id=eq.${usuarioId}`)
  await borrar('clases', `usuario_id=eq.${usuarioId}`)
  await borrar('clientes', `usuario_id=eq.${usuarioId}`)
}

// ── Quién ya está en el padrón ──────────────────────────────────────────────
// `nombre_normalizado` sale de la misma función que usa el importador de la app: el
// índice único de la base se apoya en ella y dos definiciones divergentes significan
// clientes duplicados.
const { claveNombre } = await import('../src/lib/nombres.js')

const existentes = new Map()
if (sumar) {
  const filas = await traer('clientes', 'select=id,nombre,nombre_normalizado,telefono,cliente_desde&limit=5000')
  for (const f of filas) existentes.set(f.nombre_normalizado, f)
}

// Quien está en las dos hojas es UNA persona que viene cuatro días, no dos fichas.
const nuevos = []
const reusados = []
for (const c of payload.clientes) {
  const previo = existentes.get(claveNombre(c.nombre))
  if (previo) reusados.push({ nuevo: c, previo })
  else nuevos.push(c)
}

/** Inserta el padrón nuevo y devuelve el corrimiento que hubo que aplicarle a los ids.
 *
 *  `clientes_pkey` es sobre `id` solo, sin `usuario_id`: dos usuarias del mismo
 *  proyecto no pueden repetir un id aunque RLS no las deje verse entre ellas, y este
 *  proyecto comparte base con el demo. Por eso "la tabla se ve vacía" no quiere decir
 *  que el 1 esté libre.
 *
 *  Se resuelve reintentando en vez de sondeando: el INSERT es atómico, así que un
 *  choque no deja nada a medias y el siguiente intento arranca más arriba. Sondear
 *  id por id serían cien viajes de ida y vuelta, y sondear solo las puntas del tramo
 *  daría por libre un hueco fragmentado. */
const insertarClientes = async (lista) => {
  if (!lista.length) return 0
  const salto = Math.max(lista.length, 100)
  for (let corrimiento = 0; corrimiento <= salto * 50; corrimiento += salto) {
    const filas = lista.map((c) => ({
      id: c.id + corrimiento,
      usuario_id: usuarioId,
      nombre: c.nombre,
      nombre_normalizado: claveNombre(c.nombre),
      telefono: c.telefono ?? '',
      plan: c.plan,
      cuota: c.cuota,
      fecha_ultimo_pago: c.fecha_ultimo_pago,
      fecha_vencimiento: c.fecha_vencimiento,
      cliente_desde: c.cliente_desde,
      adulto_responsable: c.responsable ?? null,
      revisar: c.revisar,
    }))
    const r = await fetch(`${url}/rest/v1/clientes`, {
      method: 'POST',
      headers: { ...cabeceras, Prefer: 'return=minimal' },
      body: JSON.stringify(filas),
    })
    if (r.ok) {
      if (corrimiento) console.log(`  Ids corridos +${corrimiento}: los de más abajo los ocupa otra usuaria del mismo proyecto.`)
      console.log(`  ${String(lista.length).padStart(4)} clientes`)
      return corrimiento
    }
    const detalle = await r.json().catch(() => ({}))
    if (detalle.code !== '23505' || !String(detalle.message ?? '').includes('clientes_pkey')) {
      throw new Error(`clientes: ${r.status} ${JSON.stringify(detalle)}`)
    }
  }
  throw new Error('No se encontró un tramo de ids libre para `clientes`.')
}

// ── Escritura ───────────────────────────────────────────────────────────────
const corrimiento = await insertarClientes(nuevos)

// Los hijos apuntan al id que quedó: el corrido para los nuevos, el que ya tenía
// para los que se reusan.
const idFinal = new Map()
for (const c of nuevos) idFinal.set(c.id, c.id + corrimiento)
for (const { nuevo, previo } of reusados) idFinal.set(nuevo.id, previo.id)
for (const lista of [payload.pagos, payload.participantes, payload.asistencias]) {
  for (const f of lista) f.cliente_id = idFinal.get(f.cliente_id)
}

await insertar('pagos', payload.pagos.map((p) => ({ usuario_id: usuarioId, ...p })))
await insertar('clases', payload.clases.map((c) => ({ usuario_id: usuarioId, ...c })))
await insertar('participantes', payload.participantes)
await insertar('asistencias', payload.asistencias)

// ── Las fichas que se reusaron ──────────────────────────────────────────────
// Solo se completa lo que faltaba; nada de lo ya cargado se pisa. El plan se
// recalcula desde las clases en que quedó anotada, que ahora son más.
for (const { nuevo, previo } of reusados) {
  const inscripciones = await traer('participantes', `cliente_id=eq.${previo.id}&select=clases(dia)`)
  const dias = inscripciones.map((f) => f.clases?.dia).filter((d) => d !== null && d !== undefined)

  const cambios = { plan: nombrePlan(dias) }
  if (!previo.telefono && nuevo.telefono) cambios.telefono = nuevo.telefono
  if (nuevo.cliente_desde < previo.cliente_desde) cambios.cliente_desde = nuevo.cliente_desde
  await parchear('clientes', `id=eq.${previo.id}`, cambios)

  const detalles = Object.entries(cambios).map(([k, v]) => `${k}: ${v}`).join(', ')
  console.log(`  ~ ${previo.nombre} ya estaba: se reusó la ficha (${detalles})`)
  if (payload.pagos.some((p) => p.cliente_id === previo.id)) {
    console.log(`    ojo: traía un cobro propio en esta hoja, quedó como un pago aparte del que ya tenía`)
  }
}

console.log(`
  Listo. Recargá la app.
`)
