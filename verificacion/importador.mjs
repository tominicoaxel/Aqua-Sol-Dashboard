// Prueba del importador contra tres planillas hechas a propósito para romperlo.
// Los archivos quedan en ejemplos/ para poder arrastrarlos a la app y ver el wizard
// funcionando con datos de verdad.

import * as XLSX from 'xlsx'
import * as fs from 'node:fs'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'

// En Node/ESM, SheetJS no engancha `fs` solo. En el navegador no hace falta:
// writeFile dispara la descarga.
XLSX.set_fs(fs)
import {
  leerArchivo,
  sugerirMapeo,
  interpretarFilas,
  aplicarClientes,
  parsearFecha,
  parsearNumero,
  CAMPOS_CLIENTE,
  ErrorImportacion,
} from '../src/lib/importer.js'
import { clientes as clientesDemo } from './semilla/mockClientes.js'

let fallas = 0
const ok = (cond, texto) => {
  console.log(`  ${cond ? 'ok  ' : 'FALLA'}  ${texto}`)
  if (!cond) fallas++
}

mkdirSync('ejemplos', { recursive: true })

const guardarXLSX = (filas, ruta, hoja = 'Hoja1') => {
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas), hoja)
  XLSX.writeFile(libro, ruta)
}

// ── Archivo A: bien formado, columnas con nuestros nombres ──────────────────
guardarXLSX(
  [
    ['Nombre', 'Teléfono', 'Plan', 'Cuota', 'Último pago', 'Vencimiento', 'Cliente desde'],
    ['Marina Delgado', '11 4455-6677', 'Aquagym 3x', 42000, '2026-07-20', '2026-08-20', '2025-06-01'],
    ['Pablo Estévez', '11 3322-1100', 'Natación Adultos 3x', 48000, '2026-08-01', '2026-09-01', '2024-11-15'],
    ['Irene Costa', '11 7788-9900', 'Hidroterapia 2x', 56000, '2026-06-28', '2026-07-28', '2026-01-10'],
  ],
  'ejemplos/1-planilla-prolija.xlsx',
  'Clientes',
)

// ── Archivo B: columnas con otros nombres y un título arriba ────────────────
guardarXLSX(
  [
    ['PILETA LA CAÑADA — LISTADO DE SOCIOS 2026', '', '', '', ''],
    ['', '', '', '', ''],
    ['Socio', 'Cel', 'Actividad', 'Abono', 'Vto.'],
    ['Ramiro Ledesma', '1155443322', 'Aquagym', '$ 42.000', '30/09/2026'],
    ['Carla Benítez', '1166778899', 'Natación', '$ 48.000', '05/08/2026'],
    ['Sofía Ferreyra', '1199887766', 'Aquagym 3x', '$ 45.000', '12/10/2026'],
  ],
  'ejemplos/2-columnas-distintas.xlsx',
  'Socios',
)

// ── Archivo C: CSV con filas rotas y fechas de todos los formatos ───────────
writeFileSync(
  'ejemplos/3-filas-rotas.csv',
  [
    'Cliente,Telefono,Plan,Importe,Vto',
    'Nadia Ocampo,11 2233-4455,Aquagym 3x,42000,15/03/2027', // día/mes/año
    'Bruno Sanz,11 6677-8899,Natación Adultos,48000,2027-03-15', // ISO
    'Elena Ruiz,11 1122-3344,Hidroterapia,56000,46461', // serial de Excel
    ',11 0000-0000,Aquagym,42000,20/04/2027', // sin nombre -> se saltea
    '   ,11 0000-0001,Aquagym,42000,21/04/2027', // nombre en blanco -> se saltea
    'Gonzalo Paz,11 5544-3322,Natación Niños,"$ 38.000",no me acuerdo', // fecha ilegible
    'Rita Blanco,11 9988-7766,Aquagym,cuarenta mil,30.06.2027', // importe ilegible + fecha con puntos
    'Tomás Aguirre,11 4482-0071,Natación Adultos 3x,52000,28/02/2027', // ya existe -> actualiza
    'Julián Ferrer,11 3131-2121,Aquagym,42000,', // sin ninguna fecha -> entra marcado
  ].join('\n'),
  'utf8',
)

const comoArchivo = (ruta) => {
  const buf = readFileSync(ruta)
  return {
    name: ruta.split('/').pop(),
    size: buf.length,
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  }
}

const etiquetaCampo = (id) => CAMPOS_CLIENTE.find((c) => c.id === id)?.etiqueta ?? id

async function correr(ruta) {
  const leido = await leerArchivo(comoArchivo(ruta))
  const mapeo = sugerirMapeo(leido.encabezados, CAMPOS_CLIENTE)
  const { registros, incidencias } = interpretarFilas(leido.filas, mapeo, CAMPOS_CLIENTE, leido.filaEncabezado)
  const aplicado = aplicarClientes(clientesDemo, registros)
  return { leido, mapeo, registros, incidencias, aplicado }
}

console.log('\n══ Fechas y números sueltos ══════════════════════════════════')
{
  const casos = [
    ['15/03/2026', '2026-03-15'],
    ['2026-03-15', '2026-03-15'],
    ['15-03-2026', '2026-03-15'],
    ['15.03.2026', '2026-03-15'],
    ['15/3/26', '2026-03-15'],
    [46096, '2026-03-15'],
    ['46096', '2026-03-15'],
    [new Date(2026, 2, 15), '2026-03-15'],
    ['03/15/2026', '2026-03-15'], // formato yanqui: se da vuelta solo
    ['no me acuerdo', null],
    ['31/02/2026', null], // no existe
    ['', null],
  ]
  for (const [entrada, esperado] of casos) {
    const r = parsearFecha(entrada)
    const got = r ? `${r.getFullYear()}-${String(r.getMonth() + 1).padStart(2, '0')}-${String(r.getDate()).padStart(2, '0')}` : null
    ok(got === esperado, `${JSON.stringify(entrada)} -> ${got ?? 'no reconocida'}`)
  }
  for (const [entrada, esperado] of [['$ 45.000', 45000], ['45000', 45000], ['45.000,50', 45000.5], ['1.234.567', 1234567], ['cuarenta mil', null]]) {
    ok(parsearNumero(entrada) === esperado, `número ${JSON.stringify(entrada)} -> ${parsearNumero(entrada)}`)
  }
}

console.log('\n══ Archivo 1 — planilla prolija ══════════════════════════════')
{
  const { leido, mapeo, registros, incidencias, aplicado } = await correr('ejemplos/1-planilla-prolija.xlsx')
  console.log(`  encabezados: ${leido.encabezados.join(' · ')}`)
  ok(registros.length === 3, `interpretó las 3 filas`)
  ok(incidencias.length === 0, 'sin incidencias')
  ok(mapeo.nombre === 0 && mapeo.fechaVencimiento === 5, 'mapeó Nombre y Vencimiento solo')
  ok(aplicado.agregados.length === 3, `agregó 3 clientes: ${aplicado.agregados.map((a) => a.nombre).join(', ')}`)
  ok(aplicado.actualizados.length === 0, 'no actualizó a nadie')
  ok(aplicado.clientes.length === clientesDemo.length + 3, `la lista pasó de ${clientesDemo.length} a ${aplicado.clientes.length}`)
}

console.log('\n══ Archivo 2 — columnas con otros nombres y título arriba ════')
{
  const { leido, mapeo, registros, aplicado } = await correr('ejemplos/2-columnas-distintas.xlsx')
  ok(leido.filaEncabezado === 3, `saltó el título y tomó los encabezados de la fila ${leido.filaEncabezado}`)
  console.log(`  encabezados: ${leido.encabezados.join(' · ')}`)
  const legible = Object.entries(mapeo).filter(([, c]) => c !== null).map(([k, c]) => `${etiquetaCampo(k)}=${leido.encabezados[c]}`)
  console.log(`  mapeo automático: ${legible.join(' · ')}`)
  ok(mapeo.nombre === 0, '"Socio" -> Nombre')
  ok(mapeo.telefono === 1, '"Cel" -> Teléfono')
  ok(mapeo.plan === 2, '"Actividad" -> Plan')
  ok(mapeo.cuota === 3, '"Abono" -> Cuota')
  ok(mapeo.fechaVencimiento === 4, '"Vto." -> Vencimiento')
  ok(registros.length === 3, 'interpretó las 3 filas')
  ok(registros[0].cuota === 42000, `"$ 42.000" -> ${registros[0].cuota}`)
  ok(aplicado.agregados.length === 2 && aplicado.actualizados.length === 1, 'agregó 2 y actualizó 1 (Sofía Ferreyra ya existía)')
  const sofia = aplicado.clientes.find((c) => c.nombre === 'Sofía Ferreyra')
  ok(sofia.cuota === 45000, `a Sofía le actualizó la cuota a ${sofia.cuota} sin duplicarla`)
  ok(aplicado.clientes.filter((c) => c.nombre.toLowerCase().includes('ferreyra')).length === 1, 'sigue habiendo una sola Sofía Ferreyra')
}

console.log('\n══ Archivo 3 — CSV con filas rotas y fechas mezcladas ════════')
{
  const { registros, incidencias, aplicado } = await correr('ejemplos/3-filas-rotas.csv')
  ok(registros.length === 7, `entraron 7 de 9 filas (${registros.map((r) => r.nombre).join(', ')})`)
  const sinNombre = incidencias.filter((i) => i.motivo.includes('nombre'))
  ok(sinNombre.length === 2, `salteó las 2 filas sin nombre (filas ${sinNombre.map((i) => i.fila).join(' y ')})`)
  const fechasMalas = incidencias.filter((i) => i.motivo.includes('fecha'))
  ok(fechasMalas.length === 1, `reportó la fecha ilegible: ${fechasMalas[0]?.detalle}`)
  const numerosMalos = incidencias.filter((i) => i.motivo.includes('importe'))
  ok(numerosMalos.length === 1, `reportó el importe ilegible: ${numerosMalos[0]?.detalle}`)

  const fmt = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
  ok(fmt(registros.find((r) => r.nombre === 'Nadia Ocampo').fechaVencimiento) === '2027-03-15', 'día/mes/año interpretado')
  ok(fmt(registros.find((r) => r.nombre === 'Bruno Sanz').fechaVencimiento) === '2027-03-15', 'ISO interpretado')
  ok(fmt(registros.find((r) => r.nombre === 'Elena Ruiz').fechaVencimiento) === '2027-03-15', 'serial de Excel interpretado')
  ok(fmt(registros.find((r) => r.nombre === 'Rita Blanco').fechaVencimiento) === '2027-06-30', 'fecha con puntos interpretada')

  // Dos quedan sin fecha usable: Julián no la trajo y la de Gonzalo era ilegible.
  // Los dos entran igual, marcados, en vez de perderse en silencio.
  const marcados = aplicado.sinFecha.map((s) => s.nombre).sort()
  ok(
    marcados.length === 2 && marcados[0] === 'Gonzalo Paz' && marcados[1] === 'Julián Ferrer',
    `entraron marcados para revisar: ${marcados.join(', ')}`,
  )
  ok(
    aplicado.clientes.some((c) => c.nombre === 'Gonzalo Paz'),
    'el de la fecha ilegible no se perdió: está en la lista, con la fecha a confirmar',
  )
  ok(aplicado.actualizados.some((a) => a.nombre === 'Tomás Aguirre'), 'Tomás Aguirre se actualizó en vez de duplicarse')
  const tomas = aplicado.clientes.filter((c) => c.nombre === 'Tomás Aguirre')
  ok(tomas.length === 1 && tomas[0].cuota === 52000, `un solo Tomás, con la cuota nueva (${tomas[0].cuota})`)
  ok(aplicado.clientes.length === clientesDemo.length + 6, `la lista pasó de ${clientesDemo.length} a ${aplicado.clientes.length}`)
}

console.log('\n══ Archivos que no son planillas ═════════════════════════════')
{
  const intentar = async (archivo) => {
    try {
      await leerArchivo(archivo)
      return null
    } catch (e) {
      return e
    }
  }
  const foto = await intentar({ name: 'pileta.jpg', size: 1024, arrayBuffer: async () => new ArrayBuffer(8) })
  ok(foto instanceof ErrorImportacion && foto.titulo.includes('no es una planilla'), `foto: "${foto?.titulo}"`)
  ok(Boolean(foto?.comoArreglar), `   y dice cómo arreglarlo: "${foto?.comoArreglar?.slice(0, 60)}…"`)

  const vacio = await intentar({ name: 'vacio.xlsx', size: 0, arrayBuffer: async () => new ArrayBuffer(0) })
  ok(vacio instanceof ErrorImportacion && vacio.titulo.includes('vacío'), `archivo de 0 bytes: "${vacio?.titulo}"`)

  const roto = await intentar({ name: 'roto.xlsx', size: 40, arrayBuffer: async () => new TextEncoder().encode('esto no es un xlsx ni en pedo aaaa').buffer })
  ok(roto instanceof ErrorImportacion, `xlsx corrupto: "${roto?.titulo}"`)

  const soloTitulos = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(soloTitulos, XLSX.utils.aoa_to_sheet([['Nombre', 'Vto']]), 'H')
  const buf = XLSX.write(soloTitulos, { type: 'buffer', bookType: 'xlsx' })
  const sinFilas = await intentar({ name: 'solo-encabezados.xlsx', size: buf.length, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) })
  ok(sinFilas instanceof ErrorImportacion && sinFilas.titulo.includes('ninguna fila'), `solo encabezados: "${sinFilas?.titulo}"`)
}

console.log(`\n${fallas === 0 ? 'TODO OK' : `${fallas} FALLA(S)`}\n`)
process.exitCode = fallas === 0 ? 0 : 1
