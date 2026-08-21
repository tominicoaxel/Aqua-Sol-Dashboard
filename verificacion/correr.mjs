import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
let fallas = 0
const ok = (cond, texto) => {
  console.log(`  ${cond ? 'ok  ' : 'FALLA'}  ${texto}`)
  if (!cond) fallas++
}

try {
  const m = await vite.ssrLoadModule('/verificacion/escenarios.jsx')

  console.log('\n── 1. Render de todas las pantallas ─────────────────────────')
  const r = m.render()
  ok(r.app > 5000, `App entera renderiza (${r.app} bytes)`)
  ok(r.importador > 1000, `el importador renderiza (${r.importador} bytes)`)
  ok(r.login > 1000, `la pantalla de login renderiza (${r.login} bytes)`)
  ok(r.fichas > 0, `las 20 fichas de cliente renderizan (${r.fichas} bytes)`)
  ok(r.clases > 0, `los 23 detalles de clase renderizan (${r.clases} bytes)`)
  ok(r.docentes > 1000, `el panel de docentes renderiza (${r.docentes} bytes)`)
  ok(r.espera > 1000, `la lista de espera renderiza (${r.espera} bytes)`)

  // Integridad: ningún participante apunta a un cliente que no existe, ninguna
  // clase repite a la misma persona, y el cupo ocupado coincide con la lista real.
  const integridad = (crudos, etiqueta) => {
    const { clientes, horarios } = m.derivar(crudos)
    const ids = new Set(clientes.map((c) => c.id))
    let huerfanos = 0
    let docentesHuerfanos = 0
    let esperasHuerfanas = 0
    let duplicados = 0
    let descuadres = 0
    for (const h of horarios) {
      for (const p of h.participantes) if (!ids.has(p)) huerfanos++
      if (new Set(h.participantes).size !== h.participantes.length) duplicados++
      if (h.ocupados !== h.grupo.length) descuadres++
      for (const id of h.docenteIds ?? []) {
        if (!(crudos.docentes ?? []).some((d) => d.id === id)) docentesHuerfanos++
      }
    }
    for (const p of crudos.listaEspera ?? []) {
      if (p.claseId && !crudos.horarios.some((h) => h.id === p.claseId)) esperasHuerfanas++
    }
    ok(huerfanos === 0, `${etiqueta}: sin participantes que apunten a un cliente inexistente`)
    ok(duplicados === 0, `${etiqueta}: nadie repetido dentro de una misma clase`)
    ok(descuadres === 0, `${etiqueta}: el cupo ocupado coincide con la lista de gente`)
    ok(docentesHuerfanos === 0, `${etiqueta}: todas las clases apuntan a un docente existente`)
    ok(esperasHuerfanas === 0, `${etiqueta}: la espera no apunta a clases inexistentes`)
    return { clientes, horarios }
  }

  console.log('\n── 2. Estado de partida ─────────────────────────────────────')
  let datos = m.datosDeEjemplo()
  integridad(datos, 'ejemplo')

  console.log('\n── 3. Agregar a una clase se ve en la ficha del cliente ─────')
  {
    const { horarios } = m.derivar(datos)
    const clase = horarios.find((h) => !h.lleno)
    const { clientes } = m.derivar(datos)
    const forastero = clientes.find((c) => !clase.participantes.includes(c.id))
    const antes = clase.ocupados

    datos = m.conParticipanteAgregado(datos, clase.id, forastero.id)
    const d = integridad(datos, 'tras agregar')
    const claseDespues = d.horarios.find((h) => h.id === clase.id)
    ok(claseDespues.ocupados === antes + 1, `el cupo pasó de ${antes} a ${claseDespues.ocupados}`)
    const susClases = m.horariosDeCliente(d.horarios, forastero.id)
    ok(
      susClases.some((h) => h.id === clase.id),
      `la clase aparece en la ficha de ${forastero.nombre} (el otro lado del cruce)`,
    )
    // Agregar dos veces no lo duplica
    const repetido = m.conParticipanteAgregado(datos, clase.id, forastero.id)
    const cl2 = m.derivar(repetido).horarios.find((h) => h.id === clase.id)
    ok(cl2.ocupados === claseDespues.ocupados, 'agregar dos veces a la misma persona no la duplica')
  }

  console.log('\n── 4. Sacar de una clase desaparece de los dos lados ────────')
  {
    const { horarios } = m.derivar(datos)
    const clase = horarios.find((h) => h.ocupados > 0)
    const quien = clase.grupo[0]
    const antes = clase.ocupados

    datos = m.conParticipanteSacado(datos, clase.id, quien.id)
    const d = integridad(datos, 'tras sacar')
    const claseDespues = d.horarios.find((h) => h.id === clase.id)
    ok(claseDespues.ocupados === antes - 1, `el cupo pasó de ${antes} a ${claseDespues.ocupados}`)
    ok(!claseDespues.participantes.includes(quien.id), `${quien.nombre} ya no está en la lista`)
    ok(
      !m.horariosDeCliente(d.horarios, quien.id).some((h) => h.id === clase.id),
      'la clase tampoco aparece ya en su ficha',
    )
    ok(
      d.clientes.some((c) => c.id === quien.id),
      'sigue siendo cliente: sacarlo de una clase no lo borra del sistema',
    )
  }

  console.log('\n── 5. Se puede pasar del cupo, con aviso ────────────────────')
  {
    let sobre = datos
    const clase = m.derivar(sobre).horarios.find((h) => h.lleno)
    const fuera = m.derivar(sobre).clientes.find((c) => !clase.participantes.includes(c.id))
    sobre = m.conParticipanteAgregado(sobre, clase.id, fuera.id)
    const d = m.derivar(sobre).horarios.find((h) => h.id === clase.id)
    ok(d.ocupados === clase.cupo + 1, `clase llena ${clase.cupo}/${clase.cupo} admite uno más (${d.ocupados}/${d.cupo})`)
    ok(d.lleno === true, 'y sigue marcada como completa')
  }

  console.log('\n── 6. Registrar un pago ─────────────────────────────────────')
  {
    const vencido = m.derivar(datos).clientes.find((c) => c.estado === 'vencido')
    const historialAntes = vencido.historial.length
    const hoy = m.isoDeHoy()
    const vence = m.vencimientoPara(hoy)

    datos = m.conPagoRegistrado(datos, vencido.id, {
      fecha: hoy,
      vencimiento: vence,
      monto: vencido.cuota,
      medio: 'Transferencia',
    })
    const d = integridad(datos, 'tras el pago')
    const despues = d.clientes.find((c) => c.id === vencido.id)
    ok(despues.estado === 'al-dia', `${vencido.nombre}: vencido -> ${despues.estado} (el color se recalcula solo)`)
    ok(despues.fechaPago === hoy, `la fecha de pago quedó en hoy (${hoy})`)
    ok(despues.fechaVencimiento === vence, `el vencimiento quedó un mes después (${vence})`)
    ok(despues.historial.length === historialAntes + 1, 'el pago quedó asentado en el historial')
    ok(despues.historial[0].monto === vencido.cuota, 'con el importe correcto y arriba de todo')
  }

  console.log('\n── 7. Corregir fechas a mano ────────────────────────────────')
  {
    const alDia = m.derivar(datos).clientes.find((c) => c.estado === 'al-dia')
    const historialAntes = alDia.historialPagos.length
    datos = m.conFechasEditadas(datos, alDia.id, {
      fechaPago: '2026-01-10',
      fechaVencimiento: '2026-02-10',
    })
    const d = integridad(datos, 'tras corregir fechas')
    const despues = d.clientes.find((c) => c.id === alDia.id)
    ok(despues.estado === 'vencido', `${alDia.nombre}: al-dia -> ${despues.estado} con una fecha vieja`)
    ok(
      despues.historialPagos.length === historialAntes,
      'corregir fechas NO inventa un pago en el historial',
    )
  }

  console.log('\n── 8. Ida y vuelta por localStorage ─────────────────────────')
  {
    const texto = JSON.stringify({
      clientes: datos.clientes,
      horarios: datos.horarios,
      docentes: datos.docentes,
      listaEspera: datos.listaEspera,
      asistencias: datos.asistencias,
    })
    const vuelta = JSON.parse(texto)
    const d = integridad({ ...vuelta, editado: true }, 'tras guardar y releer')
    const original = m.derivar(datos)
    ok(d.clientes.length === original.clientes.length, 'vuelven los mismos clientes')
    ok(
      d.horarios.every((h, i) => h.ocupados === original.horarios[i].ocupados),
      'vuelven los mismos cupos en todas las clases',
    )
    ok(texto.length < 500000, `lo guardado entra holgado en localStorage (${(texto.length / 1024).toFixed(1)} kB de ~5 MB)`)
  }


  console.log('')
  console.log('── 9. Gestión de clases ─────────────────────────────────────')
  {
    const antes = m.derivar(datos).horarios.length
    datos = m.conClaseCreada(datos, {
      actividad: 'Aquagym Senior', dia: 3, hora: '15:00',
      docenteIds: [datos.docentes[0].id], cupo: 5, duracion: 45,
    })
    let d = integridad(datos, 'tras crear la clase')
    ok(d.horarios.length === antes + 1, `la grilla pasó de ${antes} a ${d.horarios.length} clases`)
    const nueva = d.horarios.find((h) => h.actividad === 'Aquagym Senior')
    ok(Boolean(nueva) && nueva.ocupados === 0, 'la clase nueva arranca vacía')
    ok(d.horarios.filter((h) => h.dia === 3).some((h) => h.id === nueva.id), 'aparece en la grilla del día que le tocó')

    const conGente = m.derivar(datos).horarios.find((h) => h.ocupados >= 3)
    datos = m.conClaseEditada(datos, conGente.id, { cupo: 1, actividad: 'Nombre cambiado' })
    d = integridad(datos, 'tras editar la clase')
    const editada = d.horarios.find((h) => h.id === conGente.id)
    ok(editada.actividad === 'Nombre cambiado', 'el nombre se actualizó')
    ok(editada.cupo === 1, 'el cupo bajó a 1')
    ok(editada.ocupados === conGente.ocupados, `no echó a nadie: siguen los ${editada.ocupados} anotados`)
    ok(editada.ocupados > editada.cupo, 'la clase queda por encima del cupo, avisando y sin bloquear')

    const clientesAntes = d.clientes.length
    const eranParticipantes = editada.participantes
    datos = m.conClaseEliminada(datos, conGente.id)
    d = integridad(datos, 'tras eliminar la clase')
    ok(!d.horarios.some((h) => h.id === conGente.id), 'la clase ya no está en la grilla')
    ok(d.clientes.length === clientesAntes, 'los clientes que iban siguen existiendo')
    ok(
      eranParticipantes.every((id) => !m.horariosDeCliente(d.horarios, id).some((h) => h.id === conGente.id)),
      'y la clase tampoco aparece ya en ninguna de sus fichas',
    )
  }

  console.log('')
  console.log('── 10. Método de pago con su detalle ────────────────────────')
  {
    const cliente = m.derivar(datos).clientes[0]
    const cuando = m.isoDeHoy()

    const conTransferencia = m.conPagoRegistrado(datos, cliente.id, {
      fecha: cuando, vencimiento: m.vencimientoPara(cuando), monto: 50000,
      metodo: 'transferencia', cuenta: 'bbva-ser',
    })
    let pago = m.derivar(conTransferencia).clientes.find((c) => c.id === cliente.id).historial[0]
    ok(pago.metodo === 'transferencia' && pago.cuenta === 'bbva-ser', 'la transferencia guarda a qué cuenta entró')
    ok(m.descripcionPago(pago) === 'Transferencia — BBVA Ser', `se lee: "${m.descripcionPago(pago)}"`)
    ok(pago.recibo === undefined, 'y no le queda colgado ningún número de recibo')

    // A propósito se manda TAMBIÉN una cuenta, como si alguien hubiera elegido
    // transferencia, después cambiado a efectivo y confirmado.
    const conEfectivo = m.conPagoRegistrado(datos, cliente.id, {
      fecha: cuando, vencimiento: m.vencimientoPara(cuando), monto: 50000,
      metodo: 'efectivo', recibo: '0043', cuenta: 'bbva-ser',
    })
    pago = m.derivar(conEfectivo).clientes.find((c) => c.id === cliente.id).historial[0]
    ok(pago.metodo === 'efectivo' && pago.recibo === '0043', 'el efectivo guarda el número de recibo')
    ok(m.descripcionPago(pago) === 'Efectivo — Recibo 0043', `se lee: "${m.descripcionPago(pago)}"`)
    ok(pago.cuenta === undefined, 'y descarta la cuenta del otro método: no queda ningún campo colgado')

    datos = conEfectivo
    integridad(datos, 'tras los pagos')
  }

  console.log('')
  console.log('── 11. Cobrado del mes por destino ──────────────────────────')
  {
    const r = m.cobradoDelMes(m.derivar(datos).clientes)
    const sumaTitulares = Object.values(r.porTitular).reduce((a, b) => a + b, 0)
    ok(r.total === sumaTitulares + r.efectivo + r.otros, `el total (${r.total}) es la suma exacta de los destinos`)
    ok(Object.values(r.porCuenta).reduce((a, b) => a + b, 0) === sumaTitulares, 'el detalle por cuenta cuadra con el total por titular')
    ok(r.total > 0, `hay algo que mostrar: ${r.cantidad} pagos este mes`)
    console.log(`     Moni ${r.porTitular.Moni.toLocaleString('es-AR')} · Sergio ${r.porTitular.Sergio.toLocaleString('es-AR')} · Efectivo ${r.efectivo.toLocaleString('es-AR')}`)
    ok(m.CUENTAS.length === 6, 'están las seis cuentas: MP/NX/BBVA por cada titular')
  }

  console.log('')
  console.log('── 12. La importación entra al store ────────────────────────')
  {
    const antes = m.derivar(datos).clientes.length
    const importados = [
      ...datos.clientes.map((c) => ({ ...c })),
      { id: 9001, nombre: 'Persona Importada', telefono: '', plan: 'Sin plan', cuota: 0,
        fechaAlta: m.isoDeHoy(), fechaPago: m.isoDeHoy(), fechaVencimiento: m.isoDeHoy(), historialPagos: [] },
    ]
    datos = m.conClientesReemplazados(datos, importados)
    const d = integridad(datos, 'tras importar')
    ok(d.clientes.length === antes + 1, `la lista pasó de ${antes} a ${d.clientes.length}`)
    ok(d.clientes.some((c) => c.nombre === 'Persona Importada'), 'el cliente importado está en la lista')
    ok(d.horarios.every((h) => h.ocupados === h.grupo.length), 'importar clientes no rompió ninguna clase existente')
  }


  console.log('')
  console.log('── 13. Asistencia a clase ───────────────────────────────────')
  {
    const clase = m.derivar(datos).horarios.find((h) => h.ocupados >= 2)
    const [uno, dos] = clase.grupo
    const estaSemana = m.aISO(m.ocurrenciaMasReciente(clase.dia, 0))
    const semanaPasada = m.aISO(m.ocurrenciaMasReciente(clase.dia, 1))

    const leer = (d, fecha) => d.asistencias?.[clase.id]?.[fecha] ?? []

    datos = m.conAsistenciaMarcada(datos, clase.id, estaSemana, uno.id, true)
    ok(leer(datos, estaSemana).includes(uno.id), `${uno.nombre} queda marcado como presente el ${estaSemana}`)
    ok(!leer(datos, estaSemana).includes(dos.id), `${dos.nombre}, que no se marcó, no figura: el que no está, no vino`)

    // Marcar dos veces no duplica
    datos = m.conAsistenciaMarcada(datos, clase.id, estaSemana, uno.id, true)
    ok(leer(datos, estaSemana).filter((id) => id === uno.id).length === 1, 'marcar dos veces al mismo no lo duplica')

    // La asistencia cuelga de la FECHA: otra semana es otra lista
    datos = m.conAsistenciaMarcada(datos, clase.id, semanaPasada, dos.id, true)
    ok(
      leer(datos, semanaPasada).includes(dos.id) && !leer(datos, semanaPasada).includes(uno.id),
      'la semana anterior lleva su propia lista, independiente de la de esta semana',
    )
    ok(leer(datos, estaSemana).includes(uno.id), 'y marcar una semana no pisa la otra')

    // Desmarcar
    datos = m.conAsistenciaMarcada(datos, clase.id, estaSemana, uno.id, false)
    ok(!leer(datos, estaSemana).includes(uno.id), 'desmarcar lo saca de la lista del día')

    integridad(datos, 'tras marcar asistencia')

    // Sacar del grupo NO borra lo que ya vino: es un hecho pasado
    datos = m.conAsistenciaMarcada(datos, clase.id, semanaPasada, uno.id, true)
    datos = m.conParticipanteSacado(datos, clase.id, uno.id)
    ok(
      leer(datos, semanaPasada).includes(uno.id),
      'sacar a alguien del grupo no borra las clases a las que ya había venido',
    )

    // Eliminar la clase sí se lleva su asistencia
    const sinClase = m.conClaseEliminada(datos, clase.id)
    ok(sinClase.asistencias[clase.id] === undefined, 'eliminar la clase se lleva su asistencia: no queda huérfana')

    // Ida y vuelta por localStorage
    const vuelta = JSON.parse(JSON.stringify({ asistencias: datos.asistencias }))
    ok(
      JSON.stringify(vuelta.asistencias) === JSON.stringify(datos.asistencias),
      'la asistencia sobrevive el guardado y la relectura',
    )
  }

  console.log('\n── 14. La puerta: login y mensajes de error ─────────────────')
  {
    const html = m.renderLogin()

    ok(/type="password"/.test(html), 'el login pide contraseña')
    // Case-insensitive: React 19 emite `autoComplete` tal cual, y el parser de HTML
    // normaliza los nombres de atributo a minúsculas al leerlos. En el navegador
    // llega como `autocomplete`.
    ok(/autocomplete="username"/i.test(html), 'el campo de email se autocompleta desde el llavero')
    ok(/autocomplete="current-password"/i.test(html), 'la contraseña se autocompleta desde el llavero')
    ok(/inputmode="email"/i.test(html), 'el celular abre el teclado con arroba para el email')
    ok(/Me olvidé la contraseña/.test(html), 'hay salida para quien no se acuerda la contraseña')

    // Lo que NO tiene que estar: el registro público está deshabilitado en
    // Supabase, así que un botón de "crear cuenta" solo llevaría a un rechazo.
    ok(
      !/crear cuenta|registrarme|registrate|sign ?up/i.test(html),
      'NO hay pantalla ni link de registro',
    )

    // Los datos de la sesión no pueden filtrarse al HTML de la puerta.
    ok(!/supabase\.co/i.test(html), 'la URL del proyecto no aparece en el login')

    // Traducción de errores: ninguno puede llegar en inglés ni con jerga.
    const credenciales = m.mensajeDeError({ message: 'Invalid login credentials' })
    ok(
      credenciales.texto === 'El email o la contraseña no coinciden.',
      `"Invalid login credentials" se traduce ("${credenciales.texto}")`,
    )
    ok(Boolean(credenciales.ayuda), 'y además dice qué hacer')

    const red = m.mensajeDeError({ message: 'TypeError: Failed to fetch' })
    ok(red.texto === 'No se pudo llegar al servidor.', 'un error de red se lee como error de red')
    ok(/señal/i.test(red.ayuda), 'y manda a revisar la señal, que es lo que falla al borde de la pileta')

    const cerrado = m.mensajeDeError({ message: 'Signups not allowed for this instance' })
    ok(cerrado.texto === 'El registro está cerrado.', 'el registro deshabilitado se explica en castellano')

    // Un error que no conocemos no puede escupir jerga sola ni quedar mudo.
    const raro = m.mensajeDeError({ message: 'PGRST301 jwt expired' })
    ok(!/^PGRST/.test(raro.texto), 'un error desconocido no se muestra crudo como título')
    ok(/PGRST301/.test(raro.ayuda), 'pero el detalle técnico no se pierde: queda en la ayuda')

    ok(m.mensajeDeError(null) === null, 'sin error no se inventa ningún mensaje')
  }

  console.log('\n── 15. Corregir un pago existente ──────────────────────────')
  {
    const cliente = m.derivar(datos).clientes.find((c) => c.historial.length > 1)
    const pago = cliente.historial[0]
    const referencia = pago.fecha
    const antes = m.cobradoDelMes(m.derivar(datos).clientes, referencia)
    const montoNuevo = pago.monto + 750
    const corregidos = m.conPagoEditado(
      datos,
      cliente.id,
      pago.id,
      {
        fecha: m.aISO(pago.fecha),
        monto: montoNuevo,
        metodo: 'efectivo',
        recibo: '9999',
        vencimiento: cliente.fechaVencimiento,
      },
      true,
    )
    const despues = m.derivar(corregidos).clientes.find((c) => c.id === cliente.id)
    const editado = despues.historial.find((p) => p.id === pago.id)
    const resumen = m.cobradoDelMes(m.derivar(corregidos).clientes, referencia)
    ok(despues.historial.length === cliente.historial.length, 'editar no duplica ni borra pagos')
    ok(editado.monto === montoNuevo, 'el importe corregido queda en el mismo asiento')
    ok(editado.metodo === 'efectivo' && editado.recibo === '9999', 'se puede corregir método y recibo')
    ok(editado.cuenta === undefined, 'al pasar a efectivo no queda una cuenta colgada')
    ok(resumen.total === antes.total + 750, 'el resumen mensual refleja el importe corregido')
  }

  console.log('\n── 16. Docentes y asignación de clases ──────────────────────')
  {
    const html = m.renderDocentes()
    ok(/Titulares \d+/.test(html) && /Suplentes \d+/.test(html), 'la pantalla permite filtrar titulares y suplentes')
    ok(/Gestionar clases/.test(html), 'cada docente ofrece gestionar sus clases a cargo')

    const docente = {
      id: 'doc-verificacion', nombre: 'Ana Suplente', telefono: '11 5555-5555',
      email: 'ana@example.com', rol: 'suplente',
    }
    let ensayo = m.conDocenteCreado(datos, docente)
    ok(ensayo.docentes.some((d) => d.id === docente.id), 'se puede dar de alta una docente suplente')

    const clase = ensayo.horarios[0]
    const yaEstaba = clase.docenteIds[0]
    const leer = (e) => m.derivar(e).horarios.find((h) => h.id === clase.id)

    ensayo = m.conDocenteEnClase(ensayo, clase.id, docente.id, true)
    let horario = leer(ensayo)
    ok(horario.docenteIds.includes(docente.id), 'la clase queda vinculada a la docente elegida')

    // Lo que antes no se podía: sumar a alguien sin desplazar a quien ya estaba.
    ok(horario.docenteIds.includes(yaEstaba), 'sumar a una docente NO saca a la que ya estaba')
    ok(horario.docentes.length === 2, 'la clase queda a cargo de las dos')
    ok(
      horario.profe.includes(docente.nombre) && horario.profe.includes(clase.profe.split(',')[0]),
      'el nombre a cargo nombra a todas',
    )

    ensayo = m.conDocenteEnClase(ensayo, clase.id, docente.id, false)
    horario = leer(ensayo)
    ok(!horario.docenteIds.includes(docente.id), 'también se puede sacar sin eliminar el horario')
    ok(horario.docenteIds.includes(yaEstaba), 'sacar a una no toca al resto del equipo')

    // Repetir la misma asignación no la duplica: la clave primaria de la base es
    // (clase, docente) y la mutación pura tiene que respetar lo mismo.
    ensayo = m.conDocenteEnClase(ensayo, clase.id, docente.id, true)
    ensayo = m.conDocenteEnClase(ensayo, clase.id, docente.id, true)
    horario = leer(ensayo)
    ok(
      horario.docenteIds.filter((id) => id === docente.id).length === 1,
      'asignar dos veces a la misma docente no la duplica',
    )

    ensayo = m.conDocenteEditado(ensayo, docente.id, { ...docente, nombre: 'Ana Gómez' })
    horario = leer(ensayo)
    ok(horario.profe.includes('Ana Gómez'), 'renombrar a la docente se refleja en sus clases')

    ensayo = m.conDocenteEliminado(ensayo, docente.id)
    horario = leer(ensayo)
    ok(!horario.docenteIds.includes(docente.id), 'al eliminarla, sale de todas sus clases')
    ok(horario.docenteIds.includes(yaEstaba), 'y las que compartía siguen a cargo de quien queda')

    const sola = m.conDocenteEnClase(
      m.conDocenteEnClase(ensayo, clase.id, yaEstaba, false),
      clase.id, docente.id, false,
    )
    ok(
      /sin docente/i.test(leer(sola).profe),
      'una clase sin nadie a cargo lo dice explícitamente',
    )
  }

  console.log('')
  console.log('-- 16b. Quien dio la clase cada fecha -----------------------')
  {
    const suplente = {
      id: 'doc-suplencia', nombre: 'Rita Suplente', telefono: '11 5555-7777',
      email: 'rita@example.com', rol: 'suplente',
    }
    let ensayo = m.conDocenteCreado(datos, suplente)
    const clase = ensayo.horarios[0]
    const titular = clase.docenteIds[0]
    const FECHA = '2026-08-11'
    const OTRA = '2026-08-18'
    const dictado = (e, fecha = FECHA) => e.dictados?.[clase.id]?.[fecha]

    ok(dictado(ensayo) === undefined, 'una fecha sin tocar no guarda nada: la dio quien esta a cargo')

    // El caso que motivo todo: falta la titular y la cubre otra.
    ensayo = m.conDocenteDelDiaMarcado(ensayo, clase.id, FECHA, suplente.id, true)
    ok(dictado(ensayo).includes(suplente.id), 'se puede registrar que la dio una suplente')
    ok(dictado(ensayo).includes(titular), 'y queda asentada tambien la titular, que no se pierde')

    ensayo = m.conDocenteDelDiaMarcado(ensayo, clase.id, FECHA, titular, false)
    ok(!dictado(ensayo).includes(titular), 'si la titular falto, se la saca de esa fecha')
    ok(dictado(ensayo).includes(suplente.id), 'y queda registrado que la dio solo la suplente')

    ok(clase.docenteIds.includes(titular), 'la suplencia NO cambia quien esta a cargo del horario')
    ok(dictado(ensayo, OTRA) === undefined, 'y no toca ninguna otra fecha')

    ensayo = m.conDocenteDelDiaMarcado(ensayo, clase.id, FECHA, suplente.id, true)
    ok(dictado(ensayo).length === 1, 'registrar dos veces a la misma no la duplica')

    ensayo = m.conDocenteDelDiaMarcado(ensayo, clase.id, FECHA, suplente.id, false)
    ok(dictado(ensayo) === undefined, 'quedarse sin nadie vuelve la fecha a sin registro')

    // Borrar a la docente se lleva lo dictado, igual que la cascada de la base.
    let conRegistro = m.conDocenteDelDiaMarcado(
      m.conDocenteCreado(datos, suplente), clase.id, FECHA, suplente.id, true,
    )
    conRegistro = m.conDocenteEliminado(conRegistro, suplente.id)
    ok(
      !(conRegistro.dictados?.[clase.id]?.[FECHA] ?? []).includes(suplente.id),
      'eliminar a una docente la saca tambien de las clases que ya habia dado',
    )

    // Y borrar la clase se lleva su registro, igual que se lleva la asistencia.
    const sinClase = m.conClaseEliminada(
      m.conDocenteDelDiaMarcado(m.conDocenteCreado(datos, suplente), clase.id, FECHA, suplente.id, true),
      clase.id,
    )
    ok(sinClase.dictados[clase.id] === undefined, 'eliminar la clase se lleva su registro de dictado')
  }

  console.log('\n── 17. Gestión de la lista de espera ────────────────────────')
  {
    ok(m.grupoEdadEspera(6)?.id === '6-8' && m.grupoEdadEspera(8)?.id === '6-8', 'las edades de 6 a 8 quedan en el primer grupo')
    ok(m.grupoEdadEspera(9)?.id === '9-12' && m.grupoEdadEspera(12)?.id === '9-12', 'las edades de 9 a 12 quedan en el segundo grupo')
    ok(m.grupoEdadEspera(13)?.id === '13-18' && m.grupoEdadEspera(18)?.id === '13-18', 'las edades de 13 a 18 quedan en el tercer grupo')
    ok(m.grupoEdadEspera(19)?.id === 'adultos' && m.grupoEdadEspera(65)?.id === 'adultos', 'las edades de 19 a 65 quedan en Adultos')
    ok(m.grupoEdadEspera(66)?.id === 'mayores-65', 'las personas mayores de 65 quedan en su propio grupo')
    ok(m.grupoEdadEspera(5) === null, 'las edades menores de 6 no se asignan por error')

    const clase = datos.horarios[0]
    const persona = {
      id: 'espera-verificacion', nombre: 'Persona en espera', telefono: '11 4444-4444',
      edad: 11, claseId: clase.id, fechaSolicitud: '2026-08-12', estado: 'esperando', notas: '',
    }
    let ensayo = m.conPersonaEnEsperaCreada(datos, persona)
    ok(ensayo.listaEspera.some((p) => p.id === persona.id && p.claseId === clase.id && p.edad === 11), 'el pedido guarda la edad, la clase y el horario elegidos')

    ensayo = m.conPersonaEnEsperaEditada(ensayo, persona.id, { ...persona, estado: 'contactado', notas: 'Confirmar el viernes.' })
    const editada = ensayo.listaEspera.find((p) => p.id === persona.id)
    ok(editada.estado === 'contactado' && /viernes/.test(editada.notas), 'se pueden actualizar estado y notas')

    const sinClase = m.conClaseEliminada(ensayo, clase.id)
    ok(sinClase.listaEspera.find((p) => p.id === persona.id).claseId === null, 'si se elimina la clase, la persona no se pierde')

    ensayo = m.conPersonaEnEsperaEliminada(ensayo, persona.id)
    ok(!ensayo.listaEspera.some((p) => p.id === persona.id), 'se puede quitar a alguien de la lista')
  }

  console.log('\n── 18. Baja de un cliente ───────────────────────────────────')
  {
    const antes = m.derivar(datos)
    // Alguien anotado en más de una clase: es justo el caso que puede dejar
    // participantes apuntando a un cliente que ya no existe si la baja se hace a
    // medias, y lo que sostiene el cruce entre las dos pantallas.
    const quienSeVa = antes.clientes.find(
      (c) => m.horariosDeCliente(antes.horarios, c.id).length >= 2,
    )
    const susClases = m.horariosDeCliente(antes.horarios, quienSeVa.id)
    const clase = susClases[0]
    const acompaña = clase.participantes.find((id) => id !== quienSeVa.id)
    const FECHA_BAJA = '2026-08-10'

    // Los dos vinieron el mismo día: sacar al que se va no puede llevarse la marca
    // del que se queda.
    let ensayo = m.conAsistenciaMarcada(datos, clase.id, FECHA_BAJA, quienSeVa.id, true)
    ensayo = m.conAsistenciaMarcada(ensayo, clase.id, FECHA_BAJA, acompaña, true)
    ensayo = m.conClienteEliminado(ensayo, quienSeVa.id)

    const d = integridad(ensayo, 'tras dar de baja al cliente')
    const presentes = ensayo.asistencias[clase.id]?.[FECHA_BAJA] ?? []

    ok(!d.clientes.some((c) => c.id === quienSeVa.id), `${quienSeVa.nombre} ya no está en el padrón`)
    ok(
      d.clientes.length === antes.clientes.length - 1,
      `el padrón pasó de ${antes.clientes.length} a ${d.clientes.length} personas`,
    )
    ok(
      d.horarios.every((h) => !h.participantes.includes(quienSeVa.id)),
      `sale de las ${susClases.length} clases en las que estaba anotado`,
    )
    ok(
      susClases.every((h) => d.horarios.find((x) => x.id === h.id).ocupados === h.ocupados - 1),
      'y el cupo ocupado de cada una de esas clases baja en uno',
    )
    ok(!presentes.includes(quienSeVa.id), 'las asistencias que tenía marcadas se van con él')
    ok(presentes.includes(acompaña), 'pero la del que se queda no se toca')
    ok(
      (ensayo.listaEspera ?? []).length === (datos.listaEspera ?? []).length,
      'la lista de espera queda intacta: quien pidió un lugar nunca fue cliente',
    )
    ok(
      JSON.stringify(m.conClienteEliminado(ensayo, quienSeVa.id)) === JSON.stringify(ensayo),
      'darlo de baja de nuevo no cambia nada',
    )
  }

  console.log(`\n${fallas === 0 ? 'TODO OK' : `${fallas} FALLA(S)`}\n`)
  process.exitCode = fallas === 0 ? 0 : 1
} catch (e) {
  console.error('EXPLOTÓ:', e.message)
  console.error(e.stack.split('\n').slice(0, 8).join('\n'))
  process.exitCode = 1
} finally {
  await vite.close()
}
