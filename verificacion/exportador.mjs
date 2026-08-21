// Prueba de la planilla del mes. Dos preguntas, que son las dos que importan:
//
//   1. ¿Los números de la planilla son los del mes elegido, y solo los de ese mes?
//      Un pago de julio metido en la hoja de agosto es peor que no tener planilla:
//      la cuenta cierra mal y nadie se entera hasta que la mira la contadora.
//
//   2. ¿El archivo abre en Excel como Excel, y no como un cuaderno de texto? Los
//      importes tienen que ser NÚMEROS y las fechas, FECHAS. Si bajan como texto,
//      no se pueden sumar ni ordenar y la planilla no sirve para lo único que se
//      usa.
//
// Los datos son inventados a mano y no salen de la semilla: las fechas de la
// semilla se generan relativas a hoy, y acá hace falta saber exactamente qué mes
// es cada pago para poder afirmar algo sobre el corte.

import * as XLSX from 'xlsx'
import * as fs from 'node:fs'
import { datosDelMes, etiquetaDeMes, libroDelMes, mesesConDatos } from '../src/lib/exportar.js'
import { derivarClientes, derivarHorarios } from '../src/lib/datos.js'

// En Node/ESM, SheetJS no engancha `fs` solo. En el navegador no hace falta.
XLSX.set_fs(fs)

let fallas = 0
const ok = (cond, texto) => {
  console.log(`  ${cond ? 'ok  ' : 'FALLA'}  ${texto}`)
  if (!cond) fallas++
}

const MES = '2026-08'
const VACIO = '2026-05'
const TITULAR = '5eed0000-0000-4000-8000-000000000001'
const SUPLENTE = '5eed0000-0000-4000-8000-000000000002'

const crudos = {
  clientes: [
    {
      id: 1, nombre: 'Ana Gómez', telefono: '11 5555-1111', plan: 'Aquagym 3x', cuota: 42000,
      fechaAlta: '2025-03-01', fechaPago: '2026-08-05', fechaVencimiento: '2026-09-05',
      historialPagos: [
        { id: 'p1', fecha: '2026-08-05', monto: 42000, metodo: 'transferencia', cuenta: 'mp-moni' },
        { id: 'p2', fecha: '2026-07-04', monto: 40000, metodo: 'efectivo', recibo: '0043' },
      ],
    },
    {
      id: 2, nombre: 'Bruno Paz', telefono: '11 5555-2222', plan: 'Natación Adultos 3x', cuota: 48000,
      fechaAlta: '2026-02-15', fechaPago: '2026-08-02', fechaVencimiento: '2026-09-02',
      historialPagos: [
        { id: 'p3', fecha: '2026-08-02', monto: 48000, metodo: 'efectivo', recibo: '0044' },
      ],
    },
    {
      id: 3, nombre: 'Clara Ruiz', telefono: '11 5555-3333', plan: 'Hidroterapia 2x', cuota: 56000,
      fechaAlta: '2026-06-01', fechaPago: '2026-06-10', fechaVencimiento: '2026-07-10',
      responsable: 'Marta Ruiz (mamá)', historialPagos: [],
    },
  ],
  horarios: [
    {
      id: 'clase-1', dia: 1, hora: '08:00', duracion: 45, actividad: 'Aquagym', cupo: 5,
      participantes: [1, 2], docenteIds: [TITULAR],
    },
    {
      id: 'clase-2', dia: 3, hora: '10:00', duracion: 45, actividad: 'Hidroterapia', cupo: 4,
      participantes: [3], docenteIds: [TITULAR],
    },
  ],
  asistencias: {
    // Dos lunes de agosto y uno de julio: el de julio no puede aparecer.
    'clase-1': { '2026-08-03': [1, 2], '2026-08-10': [1], '2026-07-27': [1, 2] },
    // Una fecha abierta y dejada sin nadie: en la base son cero filas, y acá
    // tampoco tiene que contar como clase dada.
    'clase-2': { '2026-08-05': [] },
  },
  // El lunes 10 la cubrió la suplente. El 3 no tiene registro: la dio la titular.
  dictados: { 'clase-1': { '2026-08-10': [SUPLENTE] } },
  docentes: [
    { id: TITULAR, nombre: 'Paula Ríos', telefono: '11 4000-1001', email: 'paula@aquasol.com', rol: 'titular' },
    { id: SUPLENTE, nombre: 'Sol Medina', telefono: '11 4000-1003', email: 'sol@aquasol.com', rol: 'suplente' },
  ],
  listaEspera: [
    {
      id: 'e1', nombre: 'Nadia Torres', edad: 9, telefono: '11 7000-1001', claseId: 'clase-1',
      fechaSolicitud: '2026-08-12', estado: 'esperando', notas: 'Prefiere la mañana.',
    },
    {
      id: 'e2', nombre: 'Omar Suárez', edad: 40, telefono: '11 7000-1002', claseId: 'clase-2',
      fechaSolicitud: '2026-09-02', estado: 'contactado', notas: '',
    },
  ],
}

const clientes = derivarClientes(crudos.clientes)
const porId = new Map(clientes.map((c) => [c.id, c]))
const docentesPorId = new Map(crudos.docentes.map((d) => [d.id, d]))
const datos = {
  clientes,
  horarios: derivarHorarios(crudos.horarios, porId, docentesPorId),
  asistencias: crudos.asistencias,
  dictados: crudos.dictados,
  docentes: crudos.docentes,
  listaEspera: crudos.listaEspera,
}

/** Las filas de una hoja como objetos {columna: valor}, que es como se leen. */
const filasDe = (planilla, nombre) => {
  const hoja = planilla.hojas.find((h) => h.nombre === nombre)
  const [encabezado, ...filas] = hoja.filas
  return filas.map((f) => Object.fromEntries(encabezado.map((t, i) => [t, f[i]])))
}

console.log('\n── 1. Qué meses se ofrecen ──────────────────────────────────')
{
  const meses = mesesConDatos(datos)
  const ids = meses.map((m) => m.id)
  ok(ids.includes('2026-08'), 'aparece el mes que tiene pagos y asistencias')
  ok(ids.includes('2026-07'), 'y el mes anterior, que solo tiene un pago')
  ok(!ids.includes('2026-05'), 'un mes sin nada no se ofrece')
  ok(
    ids.join() === [...ids].sort().reverse().join(),
    'la lista viene del más nuevo al más viejo',
  )

  // El mes en curso siempre está, aunque todavía no tenga nada: es el que ella va
  // a querer bajar el último día del mes.
  const enCurso = mesesConDatos({ clientes: [], asistencias: {}, dictados: {} }, new Date(2027, 0, 15))
  ok(enCurso.length === 1 && enCurso[0].id === '2027-01', 'sin datos, se ofrece igual el mes en curso')
  ok(enCurso[0].etiqueta === 'Enero 2027', `y se lee "${enCurso[0].etiqueta}"`)
  ok(etiquetaDeMes(MES) === 'Agosto 2026', `"${MES}" se muestra como "${etiquetaDeMes(MES)}"`)
}

const planilla = datosDelMes(datos, MES)

console.log('\n── 2. Los pagos son los del mes, y ninguno más ──────────────')
{
  const pagos = filasDe(planilla, 'Pagos')
  ok(pagos.length === 2, `entraron los 2 pagos de agosto (entraron ${pagos.length})`)
  ok(
    !pagos.some((p) => p.Recibo === '0043'),
    'el pago de julio quedó afuera aunque sea del mismo cliente',
  )
  ok(planilla.totales.cobrado === 90000, `el total del mes es 90000 (dio ${planilla.totales.cobrado})`)
  ok(pagos[0].Cliente === 'Bruno Paz', 'la hoja va ordenada por fecha: primero el del 2 de agosto')

  const transferencia = pagos.find((p) => p.Cliente === 'Ana Gómez')
  ok(transferencia.Cuenta === 'MP Moni' && transferencia.Titular === 'Moni', 'la transferencia dice a qué cuenta entró y de quién es')
  ok(transferencia.Recibo === '', 'y no le queda colgado ningún número de recibo')
  const efectivo = pagos.find((p) => p.Cliente === 'Bruno Paz')
  ok(efectivo.Recibo === '0044' && efectivo.Cuenta === '', 'el efectivo lleva recibo y ninguna cuenta')

  // El desglose del resumen tiene que ser el mismo que muestra la pantalla de
  // Inicio: los dos salen de `cobradoDelMes`.
  const resumen = planilla.hojas[0].filas
  const fila = (concepto) => resumen.find((f) => f[0] === concepto)
  ok(fila('Total cobrado')[2] === 90000, 'el resumen repite el mismo total')
  ok(fila('Transferencias a Moni')[2] === 42000, 'y lo parte por titular')
  ok(fila('Efectivo')[2] === 48000, 'y separa el efectivo')
  ok(fila('Pagos registrados')[1] === 2, 'con la cantidad de pagos del mes')
}

console.log('\n── 3. Clases dadas y asistencias ────────────────────────────')
{
  const dadas = filasDe(planilla, 'Clases dadas')
  ok(dadas.length === 2, `dos clases dadas en agosto (dio ${dadas.length})`)
  ok(
    !dadas.some((d) => d.Fecha.getMonth() === 6),
    'el lunes de julio no se coló en la planilla de agosto',
  )
  ok(
    !dadas.some((d) => d.Actividad === 'Hidroterapia'),
    'una fecha abierta y dejada sin nadie no cuenta como clase dada',
  )

  const [tres, diez] = dadas
  ok(tres['La dieron'] === 'Paula Ríos', 'sin registro propio, la clase la dio quien está a cargo')
  ok(diez['La dieron'] === 'Sol Medina', 'y la fecha que cubrió la suplente queda a su nombre')
  ok(tres.Presentes === 2 && diez.Presentes === 1, 'los presentes de cada fecha son los suyos')
  ok(tres['Anotados hoy'] === 2 && tres.Cupo === 5, 'la fila lleva también el grupo y el cupo de hoy')

  const asistencias = filasDe(planilla, 'Asistencias')
  ok(asistencias.length === 3, `tres asistencias en el mes (dio ${asistencias.length})`)
  ok(
    asistencias.every((a) => a.Persona && a.Actividad),
    'cada asistencia dice quién vino y a qué clase',
  )
  ok(planilla.totales.asistencias === 3, 'y el total del resumen coincide')

  const docentes = filasDe(planilla, 'Docentes')
  const paula = docentes.find((d) => d.Nombre === 'Paula Ríos')
  const sol = docentes.find((d) => d.Nombre === 'Sol Medina')
  ok(paula['Clases a cargo'] === 2, 'la titular figura a cargo de sus dos horarios')
  ok(paula['Clases dadas en el mes'] === 1, 'pero dio una sola clase en el mes')
  ok(sol['Clases a cargo'] === 0 && sol['Clases dadas en el mes'] === 1, 'y la suplencia se le cuenta a la suplente')
}

console.log('\n── 4. Clientes y lista de espera ────────────────────────────')
{
  const filas = filasDe(planilla, 'Clientes')
  ok(filas.length === 3, 'está el padrón entero, hayan pagado o no')
  const ana = filas.find((c) => c.Nombre === 'Ana Gómez')
  const clara = filas.find((c) => c.Nombre === 'Clara Ruiz')
  ok(ana['Cobrado en el mes'] === 42000 && ana['Pagos en el mes'] === 1, 'cada ficha dice lo suyo del mes')
  ok(clara['Cobrado en el mes'] === 0, 'y el que no pagó queda en cero, no vacío')
  ok(clara.Estado === 'Vencido', 'el estado de la cuota viaja como lo muestra la app')
  ok(clara['Adulto responsable'] === 'Marta Ruiz (mamá)', 'el adulto responsable no se pierde')
  ok(ana.Clases === 'lunes 08:00 Aquagym', 'y las clases a las que va, escritas para leer')

  const espera = filasDe(planilla, 'Lista de espera')
  ok(espera.length === 1, 'el pedido de septiembre no aparece en la planilla de agosto')
  ok(espera[0].Grupo === 'De 9 a 12 años', 'el pedido viaja con su grupo de edad')
  ok(espera[0].Estado === 'Esperando' && espera[0]['Pidió en el mes'] === 'Sí', 'con su estado y marcado como del mes')
  ok(espera[0]['Clase que pidió'] === 'Aquagym · lunes 08:00', 'y con la clase que había pedido')
}

console.log('\n── 5. Un mes vacío se baja igual ────────────────────────────')
{
  const vacia = datosDelMes(datos, VACIO)
  ok(vacia.totales.pagos === 0 && vacia.totales.clasesDadas === 0, 'no inventa nada donde no hubo nada')
  ok(vacia.hojas.length === planilla.hojas.length, 'trae las mismas hojas')
  ok(
    vacia.hojas.every((h) => h.filas.length >= 1),
    'todas con su encabezado, para que se vea qué columnas hay',
  )
  ok(filasDe(vacia, 'Clientes').length === 3, 'y el padrón de hoy va igual: es lo que hay')
  ok(vacia.archivo === 'pileta-mayo-2026.xlsx', `el archivo se llama por su mes (${vacia.archivo})`)
}

console.log('\n── 6. El archivo abre como Excel, no como texto ─────────────')
{
  const { libro } = libroDelMes(XLSX, datos, MES)
  // Ida y vuelta completa por el formato .xlsx: lo que se chequea es lo que le
  // va a llegar, no el objeto que quedó en memoria.
  const vuelta = XLSX.read(XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }), { cellNF: true })

  ok(
    vuelta.SheetNames.join(' | ') === 'Resumen | Pagos | Clientes | Clases dadas | Asistencias | Docentes | Lista de espera',
    `las siete hojas, en orden (${vuelta.SheetNames.length})`,
  )

  const pagos = vuelta.Sheets['Pagos']
  ok(pagos.A1.v === 'Fecha' && pagos.D1.v === 'Importe', 'la primera fila es el encabezado')
  ok(pagos.D2.t === 'n', 'el importe es un número, no un texto: se puede sumar')
  ok(pagos.D2.z === '"$"#,##0', `y sale con formato de moneda (${pagos.D2.z})`)
  ok(pagos.A2.t === 'n' && Number.isInteger(pagos.A2.v), 'la fecha es una fecha de Excel, no un texto')
  ok(
    XLSX.SSF.format(pagos.A2.z, pagos.A2.v) === '02/08/2026',
    `y se muestra en formato argentino (${XLSX.SSF.format(pagos.A2.z, pagos.A2.v)})`,
  )
  ok(Boolean(pagos['!autofilter']), 'la hoja viene con el filtro puesto en el encabezado')

  const resumen = vuelta.Sheets['Resumen']
  ok(resumen.A1.v === 'Datos de Agosto 2026', `el resumen se presenta ("${resumen.A1.v}")`)
  ok(!resumen['!autofilter'], 'y el resumen no lleva filtro, que ahí no sirve para nada')
  ok(
    Object.values(resumen).some((c) => typeof c?.v === 'string' && /foto de hoy/.test(c.v)),
    'la planilla aclara qué es del mes y qué es de hoy',
  )
}

console.log(fallas === 0 ? '\nPlanilla en verde.' : `\n${fallas} chequeo(s) fallaron.`)
process.exit(fallas > 0 ? 1 : 0)
