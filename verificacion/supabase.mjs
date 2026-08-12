// ─── Verificación de la base: RLS y el esquema ──────────────────────────────
// Corre contra el proyecto REAL de Supabase. No hay stack local (no hay Docker en
// este entorno), así que la única forma honesta de verificar RLS es pedirle datos
// al servidor sin sesión y comprobar que no da ninguno.
//
// Sin credenciales en `.env.local` el script SALTEA y lo dice fuerte, en vez de
// fallar: `npm run verificar` tiene que seguir andando en una máquina recién
// clonada. Lo que no hace nunca es pasar en silencio fingiendo que verificó.

import { createClient } from '@supabase/supabase-js'
import { credencialesSupabase, hayCredenciales, haySesionDePrueba } from './entorno.mjs'

let fallas = 0
const ok = (cond, texto) => {
  console.log(`  ${cond ? 'ok  ' : 'FALLA'}  ${texto}`)
  if (!cond) fallas++
}

const TABLAS = ['clientes', 'clases', 'participantes', 'pagos', 'asistencias']

// Rango alto y prefijo propio para no pisarle nada a los datos reales.
const marca = Date.now().toString().slice(-6)
const ID_CLIENTE_A = 990000 + Number(marca.slice(-3))
const ID_CLIENTE_B = ID_CLIENTE_A + 1
const ID_CLASE = `verif-${marca}`
const FECHA_ASISTENCIA = '2026-01-07'

if (!hayCredenciales()) {
  console.log('\n── Supabase ─────────────────────────────────────────────────')
  console.log('  SALTEADO  falta VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env.local')
  console.log('            (copiá .env.example y cargá las claves del proyecto)')
  process.exit(0)
}

const { url, anon, email, password } = credencialesSupabase()
const nuevoCliente = () =>
  createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })

// ─── 1. Sin sesión no se lee ni una fila ────────────────────────────────────

console.log('\n── 1. RLS: sin sesión no se lee nada ────────────────────────')
{
  const sinSesion = nuevoCliente()
  for (const tabla of TABLAS) {
    const { data, error } = await sinSesion.from(tabla).select('*').limit(5)
    // Cero filas, NO un error de permisos: se dejaron los grants de `anon` puestos
    // justamente para que el rechazo sea silencioso y no parezca app rota.
    ok(!error, `${tabla}: la consulta anónima no da error de permisos${error ? ` (${error.message})` : ''}`)
    ok(Array.isArray(data) && data.length === 0, `${tabla}: devuelve cero filas sin sesión`)
  }

  const { error: errorAlta } = await sinSesion
    .from('clientes')
    .insert({ id: 999999, nombre: 'Intruso', nombre_normalizado: 'intruso' })
  ok(Boolean(errorAlta), 'clientes: insertar sin sesión es rechazado')
}

// ─── 2. Con sesión: el esquema aguanta lo que la app le va a pedir ──────────

if (!haySesionDePrueba()) {
  console.log('\n── 2. Esquema con sesión ────────────────────────────────────')
  console.log('  SALTEADO  falta SUPABASE_EMAIL_PRUEBA / SUPABASE_PASSWORD_PRUEBA')
  console.log('            (son las credenciales de la usuaria creada a mano en el panel)')
  process.exit(fallas > 0 ? 1 : 0)
}

const db = nuevoCliente()
const { data: sesion, error: errorLogin } = await db.auth.signInWithPassword({ email, password })
ok(!errorLogin && Boolean(sesion?.user), `login con email y contraseña${errorLogin ? ` (${errorLogin.message})` : ''}`)

if (errorLogin) {
  console.log(`\n${fallas} chequeo(s) fallaron.`)
  process.exit(1)
}

const usuarioId = sesion.user.id

const limpiar = async () => {
  await db.from('asistencias').delete().eq('clase_id', ID_CLASE)
  await db.from('participantes').delete().eq('clase_id', ID_CLASE)
  await db.from('clases').delete().eq('id', ID_CLASE)
  await db.from('pagos').delete().in('cliente_id', [ID_CLIENTE_A, ID_CLIENTE_B])
  await db.from('clientes').delete().in('id', [ID_CLIENTE_A, ID_CLIENTE_B])
}

try {
  await limpiar()

  console.log('\n── 2. Lo que se guarda vuelve igual ─────────────────────────')
  {
    const cliente = {
      id: ID_CLIENTE_A,
      usuario_id: usuarioId,
      nombre: 'Verificación Ñandú',
      nombre_normalizado: 'verificacion nandu',
      telefono: '11 5555-0000',
      plan: 'Aquagym 3x',
      cuota: 42000,
      fecha_ultimo_pago: '2026-07-31',
      fecha_vencimiento: '2026-08-31',
      cliente_desde: '2025-03-01',
      adulto_responsable: null,
      revisar: false,
    }
    const { error } = await db.from('clientes').insert(cliente)
    ok(!error, `alta de cliente${error ? ` (${error.message})` : ''}`)

    const { data } = await db.from('clientes').select('*').eq('id', ID_CLIENTE_A).single()
    ok(data?.nombre === 'Verificación Ñandú', 'el nombre vuelve con sus acentos intactos')
    // La razón de que las fechas sean `date` y no `timestamptz`: salen como
    // 'AAAA-MM-DD' pelado. Con zona horaria, en UTC-3 volvería el día anterior.
    ok(data?.fecha_vencimiento === '2026-08-31', `el vencimiento vuelve como '2026-08-31' (vino '${data?.fecha_vencimiento}')`)
    ok(data?.cliente_desde === '2025-03-01', 'la fecha de alta no se corre un día')
    ok(Number(data?.cuota) === 42000, 'la cuota vuelve con su valor')
    ok(data?.usuario_id === usuarioId, 'la fila queda a nombre de la usuaria de la sesión')
  }

  console.log('\n── 3. El importador actualiza, no duplica ───────────────────')
  {
    // Mismo nombre normalizado, otro id: el índice único tiene que frenarlo.
    const { error } = await db.from('clientes').insert({
      id: ID_CLIENTE_B,
      usuario_id: usuarioId,
      nombre: 'VERIFICACIÓN  ÑANDÚ',
      nombre_normalizado: 'verificacion nandu',
    })
    ok(Boolean(error), 'dos clientes con el mismo nombre normalizado son rechazados')

    // Y el camino que usa el importador: un upsert por (usuario_id, nombre_normalizado).
    const { error: errorUpsert } = await db
      .from('clientes')
      .upsert(
        {
          id: ID_CLIENTE_A,
          usuario_id: usuarioId,
          nombre: 'Verificación Ñandú',
          nombre_normalizado: 'verificacion nandu',
          cuota: 55000,
          fecha_vencimiento: '2026-09-30',
        },
        { onConflict: 'usuario_id,nombre_normalizado' },
      )
    ok(!errorUpsert, `upsert por nombre normalizado${errorUpsert ? ` (${errorUpsert.message})` : ''}`)

    const { data, count } = await db
      .from('clientes')
      .select('*', { count: 'exact' })
      .eq('nombre_normalizado', 'verificacion nandu')
    ok(count === 1, `sigue habiendo una sola fila para ese nombre (hay ${count})`)
    ok(Number(data?.[0]?.cuota) === 55000, 'el upsert actualizó la cuota en vez de insertar otra')
    ok(data?.[0]?.telefono === '11 5555-0000', 'lo que el upsert no mandó quedó como estaba')
  }

  console.log('\n── 4. Pagos: solo el dato del método elegido ────────────────')
  {
    const { error: sinCuenta } = await db.from('pagos').insert({
      usuario_id: usuarioId, cliente_id: ID_CLIENTE_A, fecha: '2026-08-01',
      importe: 42000, metodo: 'transferencia',
    })
    ok(Boolean(sinCuenta), 'transferencia sin cuenta es rechazada')

    const { error: efectivoConCuenta } = await db.from('pagos').insert({
      usuario_id: usuarioId, cliente_id: ID_CLIENTE_A, fecha: '2026-08-01',
      importe: 42000, metodo: 'efectivo', cuenta: 'mp-moni',
    })
    ok(Boolean(efectivoConCuenta), 'efectivo con cuenta de transferencia es rechazado')

    const { error: cuentaInventada } = await db.from('pagos').insert({
      usuario_id: usuarioId, cliente_id: ID_CLIENTE_A, fecha: '2026-08-01',
      importe: 42000, metodo: 'transferencia', cuenta: 'banco-fantasma',
    })
    ok(Boolean(cuentaInventada), 'una cuenta que no es una de las seis es rechazada')

    const { error: bueno } = await db.from('pagos').insert([
      { usuario_id: usuarioId, cliente_id: ID_CLIENTE_A, fecha: '2026-08-01', importe: 42000, metodo: 'transferencia', cuenta: 'bbva-ser' },
      { usuario_id: usuarioId, cliente_id: ID_CLIENTE_A, fecha: '2026-07-01', importe: 40000, metodo: 'efectivo', recibo: '0043' },
    ])
    ok(!bueno, `los dos pagos válidos entran${bueno ? ` (${bueno.message})` : ''}`)
  }

  console.log('\n── 5. Cascadas: la asimetría del historial ──────────────────')
  {
    await db.from('clases').insert({
      id: ID_CLASE, usuario_id: usuarioId, actividad: 'Verificación',
      profe: 'Nadie', dia: 3, hora: '09:00', duracion: 40, cupo: 4,
    })
    await db.from('participantes').insert({ clase_id: ID_CLASE, cliente_id: ID_CLIENTE_A })
    await db.from('asistencias').insert({ clase_id: ID_CLASE, fecha: FECHA_ASISTENCIA, cliente_id: ID_CLIENTE_A })

    // Marcar dos veces a la misma persona el mismo día: la clave compuesta frena.
    const { error: repetida } = await db
      .from('asistencias')
      .insert({ clase_id: ID_CLASE, fecha: FECHA_ASISTENCIA, cliente_id: ID_CLIENTE_A })
    ok(Boolean(repetida), 'la misma persona no se puede marcar dos veces en la misma fecha')

    // Sacarlo del grupo NO borra que vino: es un hecho pasado, no una preferencia.
    await db.from('participantes').delete().eq('clase_id', ID_CLASE).eq('cliente_id', ID_CLIENTE_A)
    const { count: asistenciasVivas } = await db
      .from('asistencias').select('*', { count: 'exact', head: true }).eq('clase_id', ID_CLASE)
    ok(asistenciasVivas === 1, `sacar a alguien del grupo NO borra sus asistencias pasadas (quedan ${asistenciasVivas})`)

    // Eliminar la clase sí se lleva todo: no quedan asistencias huérfanas.
    await db.from('participantes').insert({ clase_id: ID_CLASE, cliente_id: ID_CLIENTE_A })
    await db.from('clases').delete().eq('id', ID_CLASE)
    const { count: tras } = await db
      .from('asistencias').select('*', { count: 'exact', head: true }).eq('clase_id', ID_CLASE)
    const { count: participantesTras } = await db
      .from('participantes').select('*', { count: 'exact', head: true }).eq('clase_id', ID_CLASE)
    ok(tras === 0, 'eliminar la clase se lleva sus asistencias')
    ok(participantesTras === 0, 'eliminar la clase se lleva sus participantes')
  }
} finally {
  await limpiar()
  await db.auth.signOut()
}

console.log(fallas === 0 ? '\nTodo en verde.' : `\n${fallas} chequeo(s) fallaron.`)
process.exit(fallas > 0 ? 1 : 0)
