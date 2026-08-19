// ─── Sembrado de datos de ejemplo ───────────────────────────────────────────
// Carga en Supabase el mismo padrón ficticio que tenía el demo: 20 clientes con su
// historial de pagos, 23 clases con sus grupos, y asistencia marcada en las últimas
// semanas.
//
// Para qué existe: para poder MOSTRAR la app sin tener que importar una planilla
// antes. La app de verdad arranca vacía y se puebla desde el importador — esto no
// corre nunca solo, hay que pedirlo a mano.
//
//   npm run sembrar            # siembra, pero se niega si ya hay datos
//   npm run sembrar -- --limpiar   # borra todo y vuelve a sembrar
//
// Los datos salen de `verificacion/semilla/`, que es donde viven los mocks desde
// que dejaron de estar en `src/`.

import { createClient } from '@supabase/supabase-js'
import { credencialesSupabase, haySesionDePrueba } from '../verificacion/entorno.mjs'
import { datosDeEjemplo } from '../verificacion/semilla/index.js'
import { filaDesdeClase, filaDesdeCliente, filaDesdeDocente, filaDesdePago } from '../src/lib/mapeo.js'
import { aISO, ocurrenciaMasReciente } from '../src/lib/fechas.js'

const limpiar = process.argv.includes('--limpiar')

if (!haySesionDePrueba()) {
  console.error('\nFaltan credenciales en .env.local.')
  console.error('Hacen falta las cuatro: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,')
  console.error('SUPABASE_EMAIL_PRUEBA y SUPABASE_PASSWORD_PRUEBA. Ver supabase/LEEME.md.\n')
  process.exit(1)
}

const { url, anon, email, password } = credencialesSupabase()
const db = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })

const oExplota = (etiqueta) => ({ data, error }) => {
  if (error) throw new Error(`${etiqueta}: ${error.message}`)
  return data
}

console.log('\n── Sembrado de datos de ejemplo ─────────────────────────────')

const { data: sesion, error: errorLogin } = await db.auth.signInWithPassword({ email, password })
if (errorLogin) {
  console.error(`\nNo se pudo entrar: ${errorLogin.message}\n`)
  process.exit(1)
}
const usuarioId = sesion.user.id
console.log(`  Entrando como ${email}`)

// ── Ya hay algo? ────────────────────────────────────────────────────────────
const { count: yaHay } = await db.from('clientes').select('*', { count: 'exact', head: true })

if (yaHay > 0 && !limpiar) {
  console.error(`\n  La base ya tiene ${yaHay} cliente(s).`)
  console.error('  No se siembra encima para no duplicar ni pisar nada.')
  console.error('  Si querés reemplazar todo:  npm run sembrar -- --limpiar\n')
  process.exit(1)
}

if (limpiar) {
  console.log('  Borrando lo que había…')
  // En este orden por las claves foráneas. `clases` se lleva participantes y
  // asistencias por cascada, pero se borran igual por si quedó algo suelto.
  await db.from('asistencias').delete().gte('cliente_id', 0).then(oExplota('borrar asistencias'))
  await db.from('participantes').delete().gte('cliente_id', 0).then(oExplota('borrar participantes'))
  await db.from('pagos').delete().eq('usuario_id', usuarioId).then(oExplota('borrar pagos'))
  await db.from('clases').delete().eq('usuario_id', usuarioId).then(oExplota('borrar clases'))
  await db.from('docentes').delete().eq('usuario_id', usuarioId).then(oExplota('borrar docentes'))
  await db.from('clientes').delete().eq('usuario_id', usuarioId).then(oExplota('borrar clientes'))
}

const { clientes, horarios, docentes } = datosDeEjemplo()

// ── Clientes ────────────────────────────────────────────────────────────────
await db
  .from('clientes')
  .insert(clientes.map((c) => ({ usuario_id: usuarioId, ...filaDesdeCliente(c) })))
  .then(oExplota('clientes'))
console.log(`  ${clientes.length} clientes`)

// ── Pagos ───────────────────────────────────────────────────────────────────
// El historial de cada uno pasa a ser filas de `pagos`. De acá sale el desglose de
// cobros del mes que muestra Inicio.
const pagos = clientes.flatMap((c) =>
  c.historialPagos.map((p) => ({ usuario_id: usuarioId, ...filaDesdePago(c.id, p) })),
)
await db.from('pagos').insert(pagos).then(oExplota('pagos'))

const delMes = pagos.filter((p) => p.fecha.slice(0, 7) === aISO(new Date()).slice(0, 7))
const total = delMes.reduce((s, p) => s + p.importe, 0)
console.log(`  ${pagos.length} pagos (${delMes.length} de este mes, $${total.toLocaleString('es-AR')})`)

// ── Docentes ────────────────────────────────────────────────────────────────
// Van antes que las clases: `clase_docentes` apunta acá.
await db
  .from('docentes')
  .insert(docentes.map((d) => ({ usuario_id: usuarioId, ...filaDesdeDocente(d) })))
  .then(oExplota('docentes'))
console.log(`  ${docentes.length} docentes`)

// ── Clases ──────────────────────────────────────────────────────────────────
await db
  .from('clases')
  .insert(horarios.map((h) => ({ usuario_id: usuarioId, ...filaDesdeClase(h) })))
  .then(oExplota('clases'))

const participantes = horarios.flatMap((h) =>
  h.participantes.map((clienteId) => ({ clase_id: h.id, cliente_id: clienteId })),
)
await db.from('participantes').insert(participantes).then(oExplota('participantes'))

// Quién está a cargo también es una tabla de cruce: una clase puede tener varias.
const aCargo = horarios.flatMap((h) =>
  (h.docenteIds ?? []).map((docenteId) => ({ clase_id: h.id, docente_id: docenteId })),
)
await db.from('clase_docentes').insert(aCargo).then(oExplota('clase_docentes'))
console.log(`  ${aCargo.length} asignaciones de docente`)
console.log(`  ${horarios.length} clases con ${participantes.length} inscripciones`)

// ── Asistencia ──────────────────────────────────────────────────────────────
// Las últimas tres veces que cayó cada clase. Se saltea a una de cada cuatro
// personas para que la pantalla muestre las dos cosas: quién vino y quién faltó.
// Es determinístico a propósito — mismo sembrado, misma foto.
const asistencias = []
for (const h of horarios) {
  for (let semana = 0; semana < 3; semana++) {
    const fecha = aISO(ocurrenciaMasReciente(h.dia, semana))
    h.participantes.forEach((clienteId, i) => {
      if ((clienteId + i + semana) % 4 === 0) return // ese día faltó
      asistencias.push({ clase_id: h.id, fecha, cliente_id: clienteId })
    })
  }
}
await db.from('asistencias').insert(asistencias).then(oExplota('asistencias'))
console.log(`  ${asistencias.length} asistencias en las últimas 3 semanas`)

await db.auth.signOut()

console.log('\n  Listo. Recargá la app.')
console.log('  Para volver a empezar de cero:  npm run sembrar -- --limpiar\n')
