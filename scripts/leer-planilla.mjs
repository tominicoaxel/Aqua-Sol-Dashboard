// ─── Lectura de la planilla real ────────────────────────────────────────────
// Traduce una hoja del Excel de la pileta al payload que espera Supabase.
//
// La planilla NO tiene forma de tabla: es una grilla de bloques, uno por horario,
// y dentro de cada bloque una columna por CADA FECHA del año en que hay clase, con
// una "p" donde la persona estuvo presente. Entre mes y mes hay una columna "pagos"
// que dice cómo cobró: un número es el recibo del efectivo, un texto es la cuenta a
// la que entró la transferencia. Por eso el importador de la app (`src/lib/importer.js`)
// no sirve acá: ese espera una fila por persona con encabezados fijos.
//
// El mapeo de columnas se LEE de la fila de encabezados, no se hardcodea: la misma
// hoja tiene los meses de marzo a diciembre y la hoja de martes/jueves tiene otras
// fechas. Lo único fijo es el año.
//
//   node scripts/leer-planilla.mjs <archivo.xlsx> <hoja> <mes> <salida.json>
//
// No escribe en la base: solo produce el JSON. Lo carga `cargar-planilla.mjs`.

// El build ESM de SheetJS no trae `fs` adentro, así que `XLSX.readFile` no
// funciona: el archivo se lee acá y se le pasa el buffer.
import XLSX from 'xlsx'
import { readFileSync, writeFileSync } from 'node:fs'
import { nombrePlan } from './plan.mjs'

const [archivo, hoja, mesTexto, salidaRuta] = process.argv.slice(2)
if (!archivo || !hoja || !mesTexto || !salidaRuta) {
  console.error('uso: node scripts/leer-planilla.mjs <archivo.xlsx> <hoja> <mes 1-12> <salida.json>')
  process.exit(1)
}
const MES = Number(mesTexto)
const ANIO = 2026

// La cuota depende del horario y la dio ella de palabra: la columna "Valor" de la
// planilla quedó con los precios de marzo. Las 16:45 solo existen en lunes y
// miércoles y las 09:30 solo en martes y jueves, así que una sola lista alcanza
// para las dos hojas.
const CUOTA_REDUCIDA = new Set(['09:30', '15:00', '16:45'])
const CUOTA = (hora) => (CUOTA_REDUCIDA.has(hora) ? 68000 : 70000)

const MESES = {
  ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6,
  JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12,
}
const PREFIJO_DIA = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']

const libro = XLSX.read(readFileSync(archivo), { type: 'buffer' })
if (!libro.Sheets[hoja]) {
  console.error(`La hoja "${hoja}" no existe. Hay: ${libro.SheetNames.join(', ')}`)
  process.exit(1)
}
const rows = XLSX.utils.sheet_to_json(libro.Sheets[hoja], {
  header: 1, raw: true, defval: null, blankrows: true,
})

const celda = (fila, col) => {
  const v = (rows[fila - 1] ?? [])[col]
  return v === null || v === undefined ? '' : String(v).trim()
}
const COL_A = 0
const COL_B = 1

// ── Qué mes es cada columna ─────────────────────────────────────────────────
// Los títulos de mes viven en las filas separadoras que hay arriba de cada bloque.
// Se unen todas porque la primera (la fila 1) trae un mes más que las demás.
const tituloDeMes = new Map()
for (const fila of rows) {
  if (!fila) continue
  fila.forEach((v, col) => {
    const mes = MESES[String(v ?? '').trim().toUpperCase()]
    if (mes) tituloDeMes.set(col, mes)
  })
}
const columnasConTitulo = [...tituloDeMes.keys()].sort((a, b) => a - b)
if (!columnasConTitulo.length) {
  console.error(`La hoja "${hoja}" no tiene títulos de mes. ¿Nombre de hoja correcto?`)
  process.exit(1)
}
// Las columnas anteriores al primer título son del mes previo: la planilla arranca
// en marzo pero solo rotula de abril en adelante.
const mesPrevio = tituloDeMes.get(columnasConTitulo[0]) - 1

function mesDeColumna(col) {
  let mes = mesPrevio
  for (const c of columnasConTitulo) {
    if (c > col) break
    mes = tituloDeMes.get(c)
  }
  return mes
}

// ── Bloques ─────────────────────────────────────────────────────────────────
// Cada bloque abre con una fila de encabezados que se reconoce por el "Teléfono"
// de la segunda columna. Las personas van desde ahí hasta la fila separadora del
// bloque siguiente.
const cabeceras = []
rows.forEach((fila, i) => {
  if (/^tel/i.test(String((fila ?? [])[COL_B] ?? '').trim())) cabeceras.push(i + 1)
})

/** "14:00hs." → "14:00", 16.45 → "16:45", 18 → "18:00", 8.3 → "08:30".
 *
 *  Los minutos de un solo dígito son DÉCIMAS, no unidades: la hoja de martes y
 *  jueves escribe las y media como "8.3" y "19.3". Leerlo como 8:03 metería nueve
 *  horarios inexistentes. */
function normalizarHora(bruto) {
  const t = String(bruto).trim().toLowerCase().replace(/hs\.?$/, '').trim()
  const m = t.match(/^(\d{1,2})(?:[:.](\d{1,2}))?$/)
  if (!m) return null
  const minutos = m[2] === undefined ? '00' : m[2].length === 1 ? `${m[2]}0` : m[2]
  return `${m[1].padStart(2, '0')}:${minutos}`
}

// ── Pagos ───────────────────────────────────────────────────────────────────
const CUENTAS = {
  'mp ser': 'mp-ser', mpser: 'mp-ser', 'mp sergio': 'mp-ser',
  'mp moni': 'mp-moni', mpmoni: 'mp-moni',
  'nx moni': 'nx-moni', nxmoni: 'nx-moni',
  'nx ser': 'nx-ser', nxser: 'nx-ser',
  'bbva moni': 'bbva-moni', bbvamoni: 'bbva-moni',
  'bbva ser': 'bbva-ser', bbvaser: 'bbva-ser',
}

/** La celda "pagos" del mes → un pago, o null si está vacía.
 *  Un número es el recibo de un cobro en efectivo: la numeración de la planilla es
 *  correlativa (julio va 1–97 y agosto 109–144). Un texto es la cuenta de destino. */
function leerPago(bruto) {
  if (bruto === null || bruto === undefined || String(bruto).trim() === '') return null
  const t = String(bruto).trim()
  if (/^\d+$/.test(t)) return { metodo: 'efectivo', recibo: t, cuenta: null }
  const cuenta = CUENTAS[t.toLowerCase().replace(/\s+/g, ' ')]
  if (cuenta) return { metodo: 'transferencia', cuenta, recibo: null }
  // Cobró, pero la celda no dice cómo ("pago", "efect", una nota suelta). Entra
  // igual y queda marcada: perder un cobro en silencio es peor que uno a confirmar.
  return { metodo: 'efectivo', recibo: null, cuenta: null, revisar: true, original: t }
}

const titulo = (n) =>
  n.trim().replace(/\s+/g, ' ').toLowerCase()
    .replace(/(^|[\s-])([a-záéíóúñü])/g, (_, s, c) => s + c.toUpperCase())

const iso = (mes, dia) => `${ANIO}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

// ── Recorrido ───────────────────────────────────────────────────────────────
const clientes = []
const clases = []
const participantes = []
const pagos = []
const asistencias = []
const avisos = []
const diasVistos = new Set()
let id = 0

cabeceras.forEach((cabecera, indice) => {
  const hora = normalizarHora(celda(cabecera, COL_A))
  if (!hora) {
    avisos.push(`Fila ${cabecera}: no se entendió el horario "${celda(cabecera, COL_A)}" — bloque salteado`)
    return
  }

  // Las columnas de fecha y la de "pagos" de ESTE bloque, leídas de su encabezado.
  const fechas = []
  let colPago = null
  const encabezado = rows[cabecera - 1] ?? []
  encabezado.forEach((bruto, col) => {
    if (col <= COL_B || bruto === null || bruto === undefined) return
    const mes = mesDeColumna(col)
    const texto = String(bruto).trim()
    if (/^pagos?$/i.test(texto)) {
      if (mes === MES) colPago = col
      return
    }
    // Alguna celda quedó como fecha de Excel en vez de número suelto.
    const dia = typeof bruto === 'number' && bruto > 1000
      ? XLSX.SSF.parse_date_code(bruto)?.d
      : Number(texto)
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) return
    fechas.push({ col, mes, dia, diaSemana: new Date(ANIO, mes - 1, dia).getDay() })
  })

  if (colPago === null) {
    avisos.push(`${hora}: no se encontró la columna "pagos" del mes ${MES} — nadie de este bloque queda con pago`)
  }

  // Los días de la semana que toca este bloque salen de las fechas del mes, no de
  // un parámetro: la hoja `lym` cae lunes y miércoles y la `myj` martes y jueves.
  const diasDelBloque = [...new Set(fechas.filter((f) => f.mes === MES).map((f) => f.diaSemana))].sort()
  const plan = nombrePlan(diasDelBloque)

  const delBloque = []
  const finBloque = indice + 1 < cabeceras.length ? cabeceras[indice + 1] - 2 : rows.length

  for (let n = cabecera + 1; n <= finBloque; n++) {
    const nombreBruto = celda(n, COL_A)
    const telBruto = celda(n, COL_B)
    if (!nombreBruto && !telBruto) continue // fila separadora dentro del bloque

    let revisar = false
    let nombre = nombreBruto ? titulo(nombreBruto) : ''
    if (!nombre) {
      nombre = `Sin nombre — ${telBruto}`
      revisar = true
      avisos.push(`${hora}: la fila ${n} no tiene nombre, solo el teléfono ${telBruto}`)
    }

    // "2994608760 macerlo 2995162630": el teléfono propio y el de un tercero en la
    // misma celda. El segundo va a `adulto_responsable`, que es su lugar.
    let telefono = telBruto
    let responsable = null
    const conTercero = telBruto.match(/^(\d[\d\s-]*?)\s+([a-záéíóúñA-ZÁÉÍÓÚÑ]+)\s+(\d[\d\s-]*)$/)
    if (conTercero) {
      telefono = conTercero[1].trim()
      responsable = `${titulo(conTercero[2])} — ${conTercero[3].trim()}`
      avisos.push(`${hora}: ${nombre} tenía dos teléfonos en una celda -> propio ${telefono}, responsable "${responsable}"`)
    }
    if (telefono && !/^\d{8,11}$/.test(telefono.replace(/[\s-]/g, ''))) {
      revisar = true
      avisos.push(`${hora}: ${nombre} tiene un teléfono que no cierra ("${telefono}")`)
    }

    // Presentes del mes pedido. Los meses anteriores solo sirven para saber desde
    // cuándo viene: cargarlos sería reescribir historia que ella ya cerró.
    const presentes = []
    let primeraVez = null
    for (const f of fechas) {
      const v = (rows[n - 1] ?? [])[f.col]
      if (v === null || v === undefined || !String(v).toLowerCase().includes('p')) continue
      const fechaISO = iso(f.mes, f.dia)
      if (!primeraVez || fechaISO < primeraVez) primeraVez = fechaISO
      if (f.mes === MES) presentes.push(f)
    }

    const pago = colPago === null ? null : leerPago((rows[n - 1] ?? [])[colPago])
    if (pago?.revisar) {
      revisar = true
      avisos.push(`${hora}: ${nombre} figura cobrado pero la celda dice "${pago.original}" — entra como efectivo sin recibo`)
    }

    id++
    clientes.push({
      id,
      nombre,
      telefono,
      plan,
      cuota: CUOTA(hora),
      responsable,
      hora,
      // Desde el primer presente que aparece en la planilla, de marzo en adelante.
      cliente_desde: primeraVez ?? iso(MES, 1),
      // Sin cobro del mes la cuota está vencida desde el 1º; con cobro, vence el 1º
      // del mes siguiente.
      fecha_ultimo_pago: pago ? iso(MES, 1) : null,
      fecha_vencimiento: pago ? iso(MES + 1, 1) : iso(MES, 1),
      revisar,
    })

    delBloque.push(id)
    if (pago) {
      pagos.push({
        cliente_id: id,
        fecha: iso(MES, 1),
        importe: CUOTA(hora),
        metodo: pago.metodo,
        cuenta: pago.cuenta,
        recibo: pago.recibo,
      })
    }
    for (const f of presentes) {
      diasVistos.add(f.diaSemana)
      asistencias.push({
        clase_id: `${PREFIJO_DIA[f.diaSemana]}-${hora.replace(':', '')}`,
        fecha: iso(f.mes, f.dia),
        cliente_id: id,
      })
    }
  }

  // Una clase por cada día de la semana que toca este bloque, con el grupo entero
  // anotado en las dos: el grupo es fijo, lo que varía es quién vino cada fecha.
  for (const dia of diasDelBloque) {
    clases.push({
      id: `${PREFIJO_DIA[dia]}-${hora.replace(':', '')}`,
      actividad: 'Natación',
      profe: '',
      dia,
      hora,
      duracion: 45,
      cupo: delBloque.length,
    })
    for (const cid of delBloque) participantes.push({ clase_id: `${PREFIJO_DIA[dia]}-${hora.replace(':', '')}`, cliente_id: cid })
  }
})

// Control de sanidad del mapeo de columnas: si una fecha cayera en un día que no
// es de esta hoja, las columnas están corridas y todo lo de arriba sería basura.
const idsDeClase = new Set(clases.map((c) => c.id))
const huerfanas = asistencias.filter((a) => !idsDeClase.has(a.clase_id))
if (huerfanas.length) {
  console.error('Asistencias sin clase — el mapeo de columnas está corrido:', huerfanas.slice(0, 5))
  process.exit(1)
}

writeFileSync(salidaRuta, JSON.stringify({ clientes, clases, participantes, pagos, asistencias, avisos }, null, 2))

const dias = [...diasVistos].sort().map((d) => PREFIJO_DIA[d]).join(' y ')
console.log(`\nHoja "${hoja}", mes ${MES}/${ANIO} — días: ${dias}`)
console.log(`  clientes      ${clientes.length}`)
console.log(`  clases        ${clases.length}`)
console.log(`  participantes ${participantes.length}`)
console.log(`  pagos         ${pagos.length}  (efectivo ${pagos.filter((p) => p.metodo === 'efectivo').length} / transferencia ${pagos.filter((p) => p.metodo === 'transferencia').length})`)
console.log(`  asistencias   ${asistencias.length}`)
console.log(`  sin cobro del mes: ${clientes.length - pagos.length}`)
console.log(`\navisos (${avisos.length}):`)
avisos.forEach((a) => console.log('  ·', a))
