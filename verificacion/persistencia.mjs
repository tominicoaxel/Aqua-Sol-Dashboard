// ─── Verificación de la capa de persistencia ────────────────────────────────
// La pregunta que contesta este archivo: ¿el estado que quedó en la pantalla es el
// mismo que después devuelve la base?
//
// Con actualización optimista la pantalla cambia ANTES de que el servidor conteste,
// así que las dos cosas pueden divergir sin que nadie se entere hasta el próximo
// arranque. Acá se corre el ciclo entero con el código real —las mutaciones puras
// de `store.jsx` y las escrituras de `persistencia.js`— y se comparan las dos
// puntas.
//
// Corre contra el proyecto REAL: no hay stack local (no hay Docker en este
// entorno). Sin credenciales, saltea y lo dice.

import { createServer } from 'vite'
import { haySesionDePrueba, credencialesSupabase } from './entorno.mjs'

let fallas = 0
const ok = (cond, texto) => {
  console.log(`  ${cond ? 'ok  ' : 'FALLA'}  ${texto}`)
  if (!cond) fallas++
}

if (!haySesionDePrueba()) {
  console.log('\n── Persistencia ─────────────────────────────────────────────')
  console.log('  SALTEADO  faltan credenciales en .env.local (ver supabase/LEEME.md)')
  process.exit(0)
}

const marca = Date.now().toString().slice(-6)
const ID_A = 970000 + Number(marca.slice(-3))
const ID_B = ID_A + 1
const CLASE = `persist-${marca}`
const FECHA = '2026-03-04'
const DOCENTE = `97000000-0000-4000-8000-${marca.padStart(12, '0')}`
const ESPERA = `98000000-0000-4000-8000-${marca.padStart(12, '0')}`
const PAGO_A = `99000000-0000-4000-8000-${marca.padStart(12, '0')}`

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })

try {
  const { supabase } = await vite.ssrLoadModule('/src/lib/supabase.js')
  const { crearPersistencia } = await vite.ssrLoadModule('/src/lib/persistencia.js')
  const store = await vite.ssrLoadModule('/src/lib/store.jsx')

  const { email, password } = credencialesSupabase()
  const { data: sesion, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`no se pudo entrar: ${error.message}`)

  const db = crearPersistencia(sesion.user.id)

  const limpiar = async () => {
    await supabase.from('lista_espera').delete().eq('id', ESPERA)
    await supabase.from('asistencias').delete().eq('clase_id', CLASE)
    await supabase.from('participantes').delete().eq('clase_id', CLASE)
    await supabase.from('clases').delete().eq('id', CLASE)
    await supabase.from('pagos').delete().in('cliente_id', [ID_A, ID_B])
    await supabase.from('clientes').delete().in('id', [ID_A, ID_B])
    await supabase.from('docentes').delete().eq('id', DOCENTE)
  }
  await limpiar()

  // Solo lo del ensayo: la base puede tener datos reales al lado.
  const soloDelEnsayo = (crudos) => ({
    clientes: crudos.clientes.filter((c) => c.id === ID_A || c.id === ID_B),
    horarios: crudos.horarios.filter((h) => h.id === CLASE),
    asistencias: crudos.asistencias[CLASE] ? { [CLASE]: crudos.asistencias[CLASE] } : {},
    docentes: (crudos.docentes ?? []).filter((d) => d.id === DOCENTE),
    listaEspera: (crudos.listaEspera ?? []).filter((p) => p.id === ESPERA),
  })

  try {
    console.log('\n── 1. Sembrado: dos clientes y una clase ────────────────────')
    await db.guardarClientes([
      {
        id: ID_A, nombre: 'Ensayo Álvarez', telefono: '11 4444-1111', plan: 'Aquagym 3x',
        cuota: 48000, fechaAlta: '2025-06-01', fechaPago: '2026-02-10',
        fechaVencimiento: '2026-03-10', historialPagos: [],
      },
      {
        id: ID_B, nombre: 'Ensayo Iñíguez', telefono: '', plan: 'Natación Niños 3x',
        cuota: 39000, responsable: 'Marina Iñíguez (mamá)', fechaAlta: '2026-01-15',
        fechaPago: '2026-02-20', fechaVencimiento: '2026-03-20', historialPagos: [],
      },
    ])
    ok(true, 'los dos clientes entraron')

    // El estado local arranca como lo dejaría una carga: se compara contra él.
    let local = { clientes: [], horarios: [], asistencias: {}, docentes: [], listaEspera: [] }
    const docente = {
      id: DOCENTE, nombre: 'Nora Docente', telefono: '11 4444-3333',
      email: 'nora@example.com', rol: 'titular',
    }
    local = store.conDocenteCreado(local, docente)
    await db.crearDocente(docente)
    local = store.conClaseCreada(local, {
      actividad: 'Ensayo', dia: 4, hora: '07:30',
      docenteIds: [docente.id], cupo: 3, duracion: 40,
    })
    // `conClaseCreada` genera 'clase-1'; acá hace falta el id del ensayo.
    local.horarios[0].id = CLASE
    await db.crearClase(local.horarios[0])
    ok(true, 'la clase entró')

    const personaEnEspera = {
      id: ESPERA, nombre: 'Espera Núñez', telefono: '11 4444-2222', claseId: CLASE,
      edad: 12, fechaSolicitud: '2026-03-03', estado: 'esperando', notas: 'Solo por la mañana.',
    }
    local = store.conPersonaEnEsperaCreada(local, personaEnEspera)
    await db.crearEnEspera(personaEnEspera)

    console.log('\n── 2. El ciclo completo, con el código real de la app ───────')
    // Cada paso: la misma función pura que usa la pantalla + la misma escritura.
    local = store.conParticipanteAgregado(local, CLASE, ID_A)
    await db.agregarParticipante(CLASE, ID_A)
    local = store.conParticipanteAgregado(local, CLASE, ID_B)
    await db.agregarParticipante(CLASE, ID_B)

    local = store.conAsistenciaMarcada(local, CLASE, FECHA, ID_A, true)
    await db.marcarAsistencia(CLASE, FECHA, ID_A, true)

    const pago = {
      id: PAGO_A, fecha: '2026-03-01', monto: 48000, metodo: 'transferencia', cuenta: 'nx-moni',
      vencimiento: '2026-04-01',
    }
    local = store.conPagoIdentificado(local, ID_A, pago)
    await db.registrarPago(ID_A, pago)

    const efectivo = {
      fecha: '2026-03-02', monto: 39000, metodo: 'efectivo', recibo: '0091',
      vencimiento: '2026-04-02',
    }
    local = store.conPagoRegistrado(local, ID_B, efectivo)
    await db.registrarPago(ID_B, efectivo)

    // Para comparar hace falta que el local tenga los clientes, que se sembraron
    // por fuera de las mutaciones.
    const desdeBase0 = soloDelEnsayo(await db.cargarTodo())
    local.clientes = desdeBase0.clientes.map((c) => {
      const mio = local.clientes.find((l) => l.id === c.id)
      return mio ? { ...c, ...mio } : c
    })

    const clienteAntes = local.clientes.find((c) => c.id === ID_A)
    const pagoAntes = clienteAntes.historialPagos.find((p) => p.id === PAGO_A)
    const pagoCorregido = {
      fecha: '2026-03-01', monto: 49500, metodo: 'transferencia', cuenta: 'bbva-ser',
      vencimiento: '2026-04-01',
    }
    local = store.conPagoEditado(local, ID_A, PAGO_A, pagoCorregido, true)
    await db.editarPago(ID_A, PAGO_A, pagoCorregido, true, {
      pago: pagoAntes,
      fechaPago: clienteAntes.fechaPago,
      fechaVencimiento: clienteAntes.fechaVencimiento,
    })

    console.log('\n── 3. Lo que quedó en pantalla == lo que devuelve la base ───')
    const base = soloDelEnsayo(await db.cargarTodo())

    ok(base.clientes.length === 2, `vuelven los dos clientes (${base.clientes.length})`)

    const a = base.clientes.find((c) => c.id === ID_A)
    const b = base.clientes.find((c) => c.id === ID_B)
    ok(a.nombre === 'Ensayo Álvarez', 'los acentos vuelven intactos')
    ok(b.responsable === 'Marina Iñíguez (mamá)', 'el adulto responsable vuelve con su ñ')
    ok(a.fechaPago === '2026-03-01', `el pago movió la fecha (${a.fechaPago})`)
    ok(a.fechaVencimiento === '2026-04-01', `y el vencimiento (${a.fechaVencimiento})`)
    ok(a.cuota === 48000, 'la cuota vuelve como número, no como texto')

    ok(a.historialPagos.length === 1, 'el pago quedó asentado en el historial')
    ok(a.historialPagos[0].metodo === 'transferencia', 'con su método')
    ok(a.historialPagos[0].monto === 49500, 'la corrección del importe vuelve desde la base')
    ok(a.historialPagos[0].cuenta === 'bbva-ser', 'y actualiza la cuenta donde entró')
    ok(a.historialPagos[0].recibo === undefined, 'una transferencia NO trae número de recibo')
    ok(b.historialPagos[0].recibo === '0091', 'el efectivo sí trae el recibo')
    ok(b.historialPagos[0].cuenta === undefined, 'y el efectivo NO trae cuenta')

    ok(base.docentes[0]?.nombre === 'Nora Docente', 'la docente asignada vuelve con sus datos')
    ok(base.listaEspera[0]?.claseId === CLASE && base.listaEspera[0]?.edad === 12, 'la lista de espera conserva la edad y la clase solicitada')

    const clase = base.horarios[0]
    ok(clase.actividad === 'Ensayo' && clase.hora === '07:30', `la clase vuelve igual (${clase.hora})`)
    ok(clase.docenteIds.includes(DOCENTE), 'la clase conserva su docente a cargo')
    ok(clase.cupo === 3 && clase.duracion === 40, 'con su cupo y su duración')
    ok(clase.participantes.length === 2, `con los dos anotados (${clase.participantes.length})`)
    ok(base.asistencias[CLASE]?.[FECHA]?.length === 1, 'y con la asistencia de ese día')

    // La comparación fuerte: el estado local completo contra el de la base.
    //
    // Canoniza antes de comparar: los dos caminos arman el objeto con las claves en
    // distinto orden (`conClaseCreada` pone el id primero, `claseDesdeFila` sigue el
    // orden de las columnas) y `JSON.stringify` es sensible a eso. Lo que importa es
    // que los VALORES coincidan, no en qué orden se escribieron.
    const canonico = (v) => {
      if (Array.isArray(v)) return v.map(canonico)
      if (v && typeof v === 'object') {
        return Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonico(v[k])]),
        )
      }
      return v
    }
    const ordenar = (c) => ({ ...c, participantes: [...(c.participantes ?? [])].sort((x, y) => x - y) })
    const izq = JSON.stringify(canonico(local.horarios.map(ordenar)))
    const der = JSON.stringify(canonico(base.horarios.map(ordenar)))
    ok(izq === der, 'las clases que dejó la pantalla son idénticas a las que devuelve la base')
    if (izq !== der) {
      console.log(`        pantalla: ${izq}`)
      console.log(`        base:     ${der}`)
    }
    ok(
      JSON.stringify(canonico(local.asistencias)) === JSON.stringify(canonico(base.asistencias)),
      'y la asistencia también',
    )
    ok(
      JSON.stringify(canonico(local.docentes)) === JSON.stringify(canonico(base.docentes)),
      'los docentes de la pantalla y la base son idénticos',
    )
    ok(
      JSON.stringify(canonico(local.listaEspera)) === JSON.stringify(canonico(base.listaEspera)),
      'la lista de espera de la pantalla y la base es idéntica',
    )

    console.log('\n── 4. El importador actualiza, no duplica ───────────────────')
    {
      const { aplicarClientes } = await vite.ssrLoadModule('/src/lib/importer.js')
      const antes = base.clientes
      // Mismo nombre, distinta caja y espacios de más: es la misma persona.
      const resultado = aplicarClientes(antes, [
        { nombre: 'ENSAYO  ÁLVAREZ', cuota: 61000, fechaVencimiento: new Date(2026, 4, 1), _fila: 2 },
        { nombre: 'Ensayo Nuevo', cuota: 30000, fechaVencimiento: new Date(2026, 4, 5), _fila: 3 },
      ])
      ok(resultado.actualizados.length === 1, 'reconoce a la existente pese a mayúsculas y espacios')
      ok(resultado.agregados.length === 1, 'y da de alta a la que no estaba')

      await db.guardarClientes(resultado.clientes)
      const despues = (await db.cargarTodo()).clientes.filter((c) =>
        c.nombre.toLowerCase().startsWith('ensayo'),
      )
      ok(despues.length === 3, `quedaron 3 clientes, no 4 duplicados (${despues.length})`)
      const actualizada = despues.find((c) => c.id === ID_A)
      ok(actualizada.cuota === 61000, `la cuota se actualizó a 61000 (${actualizada.cuota})`)
      ok(actualizada.telefono === '11 4444-1111', 'y lo que el archivo no traía quedó como estaba')

      // Limpieza de la que se dio de alta en este bloque.
      await supabase.from('clientes').delete().eq('nombre_normalizado', 'ensayo nuevo')
    }

    console.log('\n── 5. Sacar del grupo conserva el historial; borrar la clase no ─')
    {
      await db.sacarParticipante(CLASE, ID_A)
      const tras = soloDelEnsayo(await db.cargarTodo())
      ok(tras.horarios[0].participantes.length === 1, 'quedó uno solo anotado')
      ok(
        tras.asistencias[CLASE]?.[FECHA]?.includes(ID_A),
        'pero la clase a la que YA vino sigue registrada',
      )

      await db.eliminarClase(CLASE)
      const final = soloDelEnsayo(await db.cargarTodo())
      ok(final.horarios.length === 0, 'la clase se fue')
      ok(Object.keys(final.asistencias).length === 0, 'y se llevó sus asistencias: no quedan huérfanas')
    }
    console.log('\n── 6. Baja de un cliente: se va con todo lo suyo ────────────')
    {
      const antes = soloDelEnsayo(await db.cargarTodo())
      const conHistorial = antes.clientes.find((c) => c.id === ID_A)
      ok(conHistorial.historialPagos.length > 0, `el que se va llega con ${conHistorial.historialPagos.length} pago(s) en su historial`)

      // La misma función pura de la pantalla y la misma escritura de la app.
      local = store.conClienteEliminado(local, ID_A)
      await db.eliminarCliente(ID_A)

      const tras = soloDelEnsayo(await db.cargarTodo())
      ok(!tras.clientes.some((c) => c.id === ID_A), 'la base ya no lo tiene')
      ok(!local.clientes.some((c) => c.id === ID_A), 'y la pantalla tampoco: las dos puntas dicen lo mismo')
      ok(tras.clientes.some((c) => c.id === ID_B), 'el otro cliente sigue donde estaba')

      const { count: pagosTras } = await supabase
        .from('pagos').select('*', { count: 'exact', head: true }).eq('cliente_id', ID_A)
      ok(pagosTras === 0, 'sus pagos se fueron con la ficha, por cascada')
    }

    console.log('\n── 7. Las tres planillas de ejemplos/, contra la base real ──')
    {
      // Este bloque escribe clientes de verdad. Si la base ya tiene padrón cargado
      // se saltea: un upsert por nombre podría pisarle una fila real a la dueña, y
      // ningún test vale eso.
      const { count: yaHay } = await supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })
        .lt('id', 900000)

      if (yaHay > 0) {
        console.log(`  SALTEADO  la base ya tiene ${yaHay} cliente(s) reales; no se tocan`)
      } else {
        const { readFileSync } = await import('node:fs')
        const imp = await vite.ssrLoadModule('/src/lib/importer.js')

        const comoArchivo = (ruta) => {
          const buf = readFileSync(ruta)
          return {
            name: ruta.split('/').pop(),
            size: buf.length,
            arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
          }
        }

        // Ancla con id alto: las altas nuevas arrancan arriba de 980000 y la
        // limpieza puede barrerlas por rango sin tocar nada más.
        const ANCLA = {
          id: 980000, nombre: 'Ancla Ensayo', nombre_normalizado: 'ancla ensayo',
          telefono: '', plan: 'Sin plan', cuota: 0, fechaAlta: '2026-01-01',
          fechaPago: '2026-01-01', fechaVencimiento: '2026-02-01', historialPagos: [],
        }
        await db.guardarClientes([ANCLA])

        const planillas = [
          'ejemplos/1-planilla-prolija.xlsx',
          'ejemplos/2-columnas-distintas.xlsx',
          'ejemplos/3-filas-rotas.csv',
        ]

        for (const ruta of planillas) {
          const leido = await imp.leerArchivo(comoArchivo(ruta))
          const mapeo = imp.sugerirMapeo(leido.encabezados, imp.CAMPOS_CLIENTE)
          const { registros } = imp.interpretarFilas(
            leido.filas, mapeo, imp.CAMPOS_CLIENTE, leido.filaEncabezado,
          )
          const actuales = (await db.cargarTodo()).clientes
          const primera = imp.aplicarClientes(actuales, registros)
          await db.guardarClientes(primera.clientes)
          const trasPrimera = (await db.cargarTodo()).clientes.length

          // La segunda pasada del MISMO archivo: es lo que hace en la vida real
          // cuando no se acuerda si ya importó. No puede duplicar a nadie.
          const segunda = imp.aplicarClientes(
            (await db.cargarTodo()).clientes, registros,
          )
          await db.guardarClientes(segunda.clientes)
          const trasSegunda = (await db.cargarTodo()).clientes.length

          const nombre = ruta.split('/').pop()
          ok(registros.length > 0, `${nombre}: se interpretaron ${registros.length} filas`)
          ok(
            trasSegunda === trasPrimera,
            `${nombre}: reimportar no duplicó a nadie (${trasPrimera} → ${trasSegunda})`,
          )
          ok(
            segunda.agregados.length === 0,
            `${nombre}: la segunda pasada no dio de alta a nadie nuevo`,
          )
        }

        const finales = (await db.cargarTodo()).clientes
        // Lo que importa no es el número exacto sino que no haya repetidos: las tres
        // planillas comparten gente a propósito, y cruzar por nombre normalizado es
        // lo que evita que la misma persona entre dos veces con distinta caja.
        const { claveNombre } = await vite.ssrLoadModule('/src/lib/nombres.js')
        const distintos = new Set(finales.map((c) => claveNombre(c.nombre)))
        ok(finales.length > 10, `quedaron ${finales.length} clientes de las tres planillas`)
        ok(
          distintos.size === finales.length,
          `no hay dos filas para la misma persona (${distintos.size} nombres para ${finales.length} filas)`,
        )
        ok(
          finales.every((c) => c.fechaVencimiento && c.fechaAlta),
          'ninguno quedó sin fecha de vencimiento ni de alta',
        )
        ok(
          finales.some((c) => c.historialPagos.length === 0),
          'los importados entran sin historial de pagos, que es lo correcto',
        )

        await supabase.from('clientes').delete().gte('id', 900000)
        const { count: quedan } = await supabase
          .from('clientes')
          .select('*', { count: 'exact', head: true })
        ok(quedan === 0, `la base quedó limpia después del ensayo (${quedan})`)
      }
    }
  } finally {
    await limpiar()
    await supabase.from('clientes').delete().gte('id', 900000)
    await supabase.auth.signOut()
  }
} catch (e) {
  console.error('EXPLOTÓ:', e.message)
  console.error(e.stack.split('\n').slice(0, 6).join('\n'))
  fallas++
} finally {
  await vite.close()
}

console.log(fallas === 0 ? '\nPersistencia en verde.' : `\n${fallas} chequeo(s) fallaron.`)
process.exit(fallas > 0 ? 1 : 0)
