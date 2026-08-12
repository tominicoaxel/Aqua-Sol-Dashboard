import * as XLSX from 'xlsx'
import { claveNombre, normalizar } from './nombres.js'

// ─── Importación de planillas ───────────────────────────────────────────────
// La premisa de todo este módulo: NO sabemos cómo es la planilla. La que ella usa
// hoy tiene las columnas que tiene, con los nombres que le puso, en el orden que le
// quedó, y con fechas escritas de tres maneras distintas porque las cargó en años
// distintos. Nada de eso es un error de ella: es cómo se ve un Excel real.
//
// Por eso el módulo no valida contra un formato fijo. Lee los encabezados reales,
// propone un mapeo, deja corregirlo, y de lo que no puede interpretar informa la
// fila y el motivo en vez de fallar entero.
//
// Está partido en piezas genéricas a propósito (leerArchivo / sugerirMapeo /
// interpretarFilas trabajan contra una lista de campos que se pasa por parámetro),
// porque después vienen pagos y horarios por el mismo camino. Lo único específico
// de clientes es CAMPOS_CLIENTE y aplicarClientes.

/** Error con las dos cosas que hacen falta para salir del paso: qué pasó y qué
 *  hacer. Un "Error: undefined" acá es la clienta volviendo al Excel. */
export class ErrorImportacion extends Error {
  constructor(titulo, comoArreglar) {
    super(titulo)
    this.titulo = titulo
    this.comoArreglar = comoArreglar
  }
}

export const CAMPOS_CLIENTE = [
  {
    id: 'nombre',
    etiqueta: 'Nombre',
    tipo: 'texto',
    obligatorio: true,
    ayuda: 'Sin esto no se puede importar la fila',
    alias: ['nombre', 'nombre y apellido', 'apellido y nombre', 'nombre completo', 'cliente', 'clienta', 'socio', 'socia', 'alumno', 'alumna', 'persona', 'apellido'],
  },
  {
    id: 'fechaVencimiento',
    etiqueta: 'Vencimiento',
    tipo: 'fecha',
    ayuda: 'De acá sale el color de al día / por vencer / vencido',
    alias: ['vencimiento', 'vence', 'vto', 'vto.', 'fecha de vencimiento', 'fecha vencimiento', 'vencimiento cuota', 'proximo pago', 'proximo vencimiento', 'caduca'],
  },
  {
    id: 'fechaPago',
    etiqueta: 'Último pago',
    tipo: 'fecha',
    alias: ['ultimo pago', 'fecha de pago', 'fecha pago', 'pago', 'pagado', 'fecha ultimo pago', 'ultimo abono'],
  },
  {
    id: 'telefono',
    etiqueta: 'Teléfono',
    tipo: 'texto',
    alias: ['telefono', 'tel', 'tel.', 'celular', 'cel', 'cel.', 'contacto', 'whatsapp', 'wpp', 'movil'],
  },
  {
    id: 'plan',
    etiqueta: 'Plan',
    tipo: 'texto',
    alias: ['plan', 'actividad', 'servicio', 'modalidad', 'clase', 'disciplina', 'tipo'],
  },
  {
    id: 'cuota',
    etiqueta: 'Cuota',
    tipo: 'numero',
    alias: ['cuota', 'importe', 'monto', 'precio', 'valor', 'abono', 'mensualidad', 'arancel'],
  },
  {
    id: 'fechaAlta',
    etiqueta: 'Cliente desde',
    tipo: 'fecha',
    alias: ['alta', 'fecha de alta', 'cliente desde', 'desde', 'ingreso', 'inicio', 'antiguedad'],
  },
  {
    id: 'responsable',
    etiqueta: 'Responsable',
    tipo: 'texto',
    alias: ['responsable', 'a cargo', 'tutor', 'madre', 'padre', 'apoderado', 'mama', 'papa'],
  },
]

// ─── Fechas ─────────────────────────────────────────────────────────────────

const aMedianoche = (a, m, d) => {
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null
  const fecha = new Date(a, m - 1, d)
  // Rebota el 31 de febrero y compañía: si el día se corrió, la fecha no existía.
  if (fecha.getFullYear() !== a || fecha.getMonth() !== m - 1 || fecha.getDate() !== d) return null
  fecha.setHours(0, 0, 0, 0)
  return fecha
}

/** Excel guarda las fechas como cantidad de días desde el 30/12/1899. Cuando la
 *  planilla se exporta a CSV eso a veces sale como "45732" pelado. */
function desdeSerialExcel(n) {
  if (!Number.isFinite(n) || n < 1 || n > 2958465) return null
  const d = new Date(Math.round((n - 25569) * 86400000))
  return aMedianoche(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

const añoCompleto = (a) => (a >= 100 ? a : a <= 69 ? 2000 + a : 1900 + a)

/** Acepta todo lo que aparece en una planilla real: Date de Excel, serial numérico,
 *  ISO, y día/mes/año con barras, guiones o puntos.
 *
 *  Ante "03/04/2026" asume día/mes (criterio argentino). Si el primer número no
 *  puede ser un día pero el segundo sí, da vuelta el orden: una planilla con formato
 *  yanqui se interpreta bien igual. */
export function parsearFecha(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : aMedianoche(valor.getFullYear(), valor.getMonth() + 1, valor.getDate())
  if (typeof valor === 'number') return desdeSerialExcel(valor)

  const texto = String(valor).trim()
  if (!texto) return null

  let m = texto.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return aMedianoche(+m[1], +m[2], +m[3])

  m = texto.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (m) {
    let dia = +m[1]
    let mes = +m[2]
    const año = añoCompleto(+m[3])
    if (dia <= 12 && mes > 12) [dia, mes] = [mes, dia]
    return aMedianoche(año, mes, dia)
  }

  if (/^\d+(\.\d+)?$/.test(texto)) return desdeSerialExcel(Number(texto))

  const suelta = new Date(texto)
  if (!Number.isNaN(suelta.getTime())) {
    return aMedianoche(suelta.getFullYear(), suelta.getMonth() + 1, suelta.getDate())
  }
  return null
}

/** "$ 45.000,50" y "45000.5" tienen que dar lo mismo. El separador decimal es el
 *  ÚLTIMO punto o coma que aparece; todo lo anterior son separadores de miles. */
export function parsearNumero(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null

  const limpio = String(valor).replace(/[^\d.,-]/g, '')
  if (!limpio || !/\d/.test(limpio)) return null

  const ultimoPunto = Math.max(limpio.lastIndexOf('.'), limpio.lastIndexOf(','))
  const decimales = ultimoPunto >= 0 ? limpio.length - ultimoPunto - 1 : 0

  let normal
  if (ultimoPunto >= 0 && decimales > 0 && decimales <= 2) {
    normal = limpio.slice(0, ultimoPunto).replace(/[.,]/g, '') + '.' + limpio.slice(ultimoPunto + 1)
  } else {
    normal = limpio.replace(/[.,]/g, '')
  }

  const n = Number(normal)
  return Number.isFinite(n) ? n : null
}

// ─── Lectura del archivo ────────────────────────────────────────────────────

const vacia = (fila) => !fila || fila.every((c) => c === null || c === undefined || String(c).trim() === '')

/** Una planilla real arranca con un título, una fila en blanco y recién ahí los
 *  encabezados. Se toma como encabezado la primera fila con dos o más celdas
 *  llenas, y se informa cuál fue para que se pueda ver si acertó. */
function ubicarEncabezado(filas) {
  for (let i = 0; i < Math.min(filas.length, 15); i++) {
    const llenas = (filas[i] || []).filter((c) => String(c ?? '').trim() !== '').length
    if (llenas >= 2) return i
  }
  return filas.findIndex((f) => !vacia(f))
}

/** Decodifica un archivo de texto (CSV) adivinando bien la codificación.
 *
 *  Esto no es un detalle: un CSV en UTF-8 leído como Windows-1252 convierte
 *  "Tomás" en "TomÃ¡s", y entonces el cruce por nombre no lo reconoce y en vez de
 *  ACTUALIZAR al cliente que ya existe lo DUPLICA. Un importador que duplica a la
 *  mitad de la gente con acento en el nombre es peor que no tener importador.
 *
 *  UTF-8 primero (con `fatal`, que rebota si los bytes no son UTF-8 válido) y
 *  Windows-1252 de reserva, que es lo que exporta Excel en Windows por defecto. */
function decodificarTexto(bytes) {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3))
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

const ES_ZIP = (b) => b[0] === 0x50 && b[1] === 0x4b
const ES_XLS_VIEJO = (b) => b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0

export async function leerArchivo(archivo) {
  if (!archivo) throw new ErrorImportacion('No llegó ningún archivo.', 'Elegí un archivo .xlsx o .csv y probá de nuevo.')

  const nombre = archivo.name || ''
  const extension = nombre.includes('.') ? nombre.slice(nombre.lastIndexOf('.')).toLowerCase() : ''
  if (extension && !['.xlsx', '.xls', '.xlsm', '.csv', '.txt'].includes(extension)) {
    throw new ErrorImportacion(
      `"${nombre}" no es una planilla.`,
      'Tiene que ser un archivo .xlsx o .csv. Si lo tenés en Google Sheets: Archivo → Descargar → Microsoft Excel (.xlsx).',
    )
  }
  if (archivo.size === 0) {
    throw new ErrorImportacion(`"${nombre}" está vacío.`, 'El archivo pesa 0 bytes. Fijate de haberlo guardado antes de subirlo.')
  }

  const bytes = new Uint8Array(await archivo.arrayBuffer())
  const esBinario = ES_ZIP(bytes) || ES_XLS_VIEJO(bytes)

  // Un archivo que se llama .xlsx pero por dentro no es un ZIP está roto o mal
  // renombrado, y conviene decirlo antes de intentar leerlo como texto y sacar
  // basura.
  if (['.xlsx', '.xlsm', '.xls'].includes(extension) && !esBinario) {
    throw new ErrorImportacion(
      `"${nombre}" está dañado o no es realmente una planilla.`,
      'Tiene extensión de Excel pero por dentro no lo es. Abrilo en Excel y usá Archivo → Guardar como → .xlsx, o cambiale la extensión a .csv si en realidad es un archivo de texto.',
    )
  }

  let libro
  try {
    libro = esBinario
      ? XLSX.read(bytes, { cellDates: true, cellText: false })
      : XLSX.read(decodificarTexto(bytes), { type: 'string', cellDates: true, cellText: false })
  } catch {
    throw new ErrorImportacion(
      `No pudimos abrir "${nombre}".`,
      'Puede estar dañado, protegido con contraseña, o no ser realmente una planilla. Probá abrirlo en Excel y volver a guardarlo como .xlsx.',
    )
  }

  const nombreHoja = libro.SheetNames?.[0]
  if (!nombreHoja) {
    throw new ErrorImportacion(`"${nombre}" no tiene ninguna hoja.`, 'Abrilo, verificá que tenga datos y volvé a guardarlo.')
  }

  const todas = XLSX.utils.sheet_to_json(libro.Sheets[nombreHoja], {
    header: 1,
    raw: true,
    defval: '',
    blankrows: false,
  })

  if (!todas.length) {
    throw new ErrorImportacion(
      `La hoja "${nombreHoja}" está vacía.`,
      libro.SheetNames.length > 1
        ? `El archivo tiene otras hojas (${libro.SheetNames.slice(1).join(', ')}). Movés los datos a la primera hoja y lo volvés a subir.`
        : 'No hay ninguna fila con datos.',
    )
  }

  const indiceEncabezado = ubicarEncabezado(todas)
  const encabezados = (todas[indiceEncabezado] || []).map((c, i) => {
    const t = String(c ?? '').trim()
    return t || `Columna ${i + 1}`
  })
  const filas = todas.slice(indiceEncabezado + 1).filter((f) => !vacia(f))

  if (!filas.length) {
    throw new ErrorImportacion(
      `"${nombre}" tiene encabezados pero ninguna fila con datos.`,
      `Encontramos las columnas: ${encabezados.slice(0, 6).join(', ')}. Falta cargar las filas debajo.`,
    )
  }

  return { encabezados, filas, hoja: nombreHoja, filaEncabezado: indiceEncabezado + 1, hojas: libro.SheetNames }
}

// ─── Mapeo de columnas ──────────────────────────────────────────────────────

function puntaje(encabezado, campo) {
  const n = normalizar(encabezado)
  if (!n) return 0
  const etiqueta = normalizar(campo.etiqueta)
  const alias = [etiqueta, ...campo.alias.map(normalizar)]

  if (alias.includes(n)) return n === etiqueta ? 100 : 92
  for (const a of alias) {
    if (!a) continue
    if (n.startsWith(a + ' ') || n.endsWith(' ' + a)) return 78
  }
  for (const a of alias) {
    if (a.length >= 3 && (n.includes(a) || a.includes(n))) return 60
  }
  return 0
}

/** Propone una columna para cada campo, resolviendo los conflictos por puntaje: si
 *  dos campos quieren la misma columna, se la queda el que mejor coincide y el otro
 *  queda sin asignar, para que se note y se corrija a mano. */
export function sugerirMapeo(encabezados, campos) {
  const candidatos = []
  campos.forEach((campo) => {
    encabezados.forEach((enc, col) => {
      const p = puntaje(enc, campo)
      if (p >= 55) candidatos.push({ campo: campo.id, col, p })
    })
  })
  candidatos.sort((a, b) => b.p - a.p)

  const mapeo = Object.fromEntries(campos.map((c) => [c.id, null]))
  const usadas = new Set()
  for (const { campo, col } of candidatos) {
    if (mapeo[campo] === null && !usadas.has(col)) {
      mapeo[campo] = col
      usadas.add(col)
    }
  }
  return mapeo
}

// ─── Interpretación de las filas ────────────────────────────────────────────

const MOTIVOS = {
  sinNombre: 'La fila no tiene nombre',
  fechaIlegible: 'No se entendió la fecha',
  numeroIlegible: 'No se entendió el importe',
  sinFechas: 'No tiene ni vencimiento ni fecha de pago',
}

/** Convierte las filas crudas en registros usando el mapeo. Nunca tira todo abajo
 *  por una celda mala: lo que no se entiende se anota como incidencia con el número
 *  de fila tal como se ve en Excel, y el resto sigue. */
export function interpretarFilas(filas, mapeo, campos, filaEncabezado = 1) {
  const registros = []
  const incidencias = []
  const anotar = (fila, motivo, detalle) => incidencias.push({ fila, motivo, detalle })

  filas.forEach((fila, i) => {
    const nroFila = filaEncabezado + i + 1
    const registro = { _fila: nroFila }

    for (const campo of campos) {
      const col = mapeo[campo.id]
      if (col === null || col === undefined) continue
      const bruto = fila[col]
      if (bruto === null || bruto === undefined || String(bruto).trim() === '') continue

      if (campo.tipo === 'fecha') {
        const fecha = parsearFecha(bruto)
        if (fecha) registro[campo.id] = fecha
        else anotar(nroFila, MOTIVOS.fechaIlegible, `${campo.etiqueta}: "${String(bruto).slice(0, 24)}"`)
      } else if (campo.tipo === 'numero') {
        const n = parsearNumero(bruto)
        if (n !== null) registro[campo.id] = n
        else anotar(nroFila, MOTIVOS.numeroIlegible, `${campo.etiqueta}: "${String(bruto).slice(0, 24)}"`)
      } else {
        registro[campo.id] = String(bruto).trim()
      }
    }

    const obligatorioVacio = campos.find((c) => c.obligatorio && !registro[c.id])
    if (obligatorioVacio) {
      anotar(nroFila, MOTIVOS.sinNombre, null)
      return
    }
    registros.push(registro)
  })

  return { registros, incidencias }
}

// ─── Aplicación sobre los datos de la app ───────────────────────────────────


const aISO = (f) =>
  `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`

const sumarMes = (f) => {
  const d = new Date(f)
  const dia = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + 1)
  d.setDate(Math.min(dia, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
  return d
}

/** Aplica los registros sobre los clientes que ya están. Agrega y actualiza; NUNCA
 *  borra: alguien que está en la app y no en el archivo se queda como está. Esa
 *  regla es la que hace que importar de nuevo sea seguro y no dé miedo.
 *
 *  El cruce es por nombre normalizado, que es lo único que siempre está: "Sofía
 *  Ferreyra", "sofia ferreyra" y "SOFIA  FERREYRA" son la misma persona. */
export function aplicarClientes(clientesActuales, registros, hoy = new Date()) {
  const porNombre = new Map(clientesActuales.map((c) => [claveNombre(c.nombre), c]))
  const resultado = clientesActuales.map((c) => ({ ...c }))
  const indice = new Map(resultado.map((c, i) => [claveNombre(c.nombre), i]))
  let proximoId = resultado.reduce((max, c) => Math.max(max, c.id), 0) + 1

  const agregados = []
  const actualizados = []
  const sinFecha = []

  for (const r of registros) {
    // Si no vino vencimiento se deduce del último pago (+1 mes). Si no vino
    // ninguno de los dos, entra igual pero marcado para revisar: perder a una
    // persona en silencio es peor que importarla con una fecha a confirmar.
    let vencimiento = r.fechaVencimiento
    let revisar = false
    if (!vencimiento && r.fechaPago) vencimiento = sumarMes(r.fechaPago)
    if (!vencimiento) {
      vencimiento = new Date(hoy)
      revisar = true
    }
    const pago = r.fechaPago || null

    const clave = claveNombre(r.nombre)
    const existente = porNombre.get(clave)

    if (existente) {
      const i = indice.get(clave)
      const actual = resultado[i]
      resultado[i] = {
        ...actual,
        // Solo pisa lo que vino en el archivo; el resto del cliente queda intacto.
        ...(r.telefono ? { telefono: r.telefono } : {}),
        ...(r.plan ? { plan: r.plan } : {}),
        ...(r.cuota !== undefined ? { cuota: r.cuota } : {}),
        ...(r.responsable ? { responsable: r.responsable } : {}),
        ...(r.fechaAlta ? { fechaAlta: aISO(r.fechaAlta) } : {}),
        ...(pago ? { fechaPago: aISO(pago) } : {}),
        ...(r.fechaVencimiento || r.fechaPago ? { fechaVencimiento: aISO(vencimiento) } : {}),
      }
      actualizados.push({ nombre: actual.nombre, fila: r._fila })
      if (revisar) sinFecha.push({ nombre: actual.nombre, fila: r._fila })
    } else {
      const nuevo = {
        id: proximoId++,
        nombre: r.nombre,
        telefono: r.telefono || '',
        plan: r.plan || 'Sin plan',
        cuota: r.cuota ?? 0,
        ...(r.responsable ? { responsable: r.responsable } : {}),
        fechaAlta: aISO(r.fechaAlta || hoy),
        fechaPago: aISO(pago || vencimiento),
        fechaVencimiento: aISO(vencimiento),
        historialPagos: [],
      }
      resultado.push(nuevo)
      indice.set(clave, resultado.length - 1)
      porNombre.set(clave, nuevo)
      agregados.push({ nombre: nuevo.nombre, fila: r._fila })
      if (revisar) sinFecha.push({ nombre: nuevo.nombre, fila: r._fila })
    }
  }

  return { clientes: resultado, agregados, actualizados, sinFecha }
}

// ─── Plantilla de ejemplo ───────────────────────────────────────────────────

/** Para cuando quiera armar el archivo desde cero en vez de adaptar el suyo. Lleva
 *  dos filas cargadas como muestra: un ejemplo se copia, un encabezado pelado hay
 *  que adivinarlo. */
export function descargarPlantillaClientes() {
  const hoy = new Date()
  const en30 = new Date(hoy)
  en30.setDate(en30.getDate() + 30)

  const filas = [
    ['Nombre', 'Teléfono', 'Plan', 'Cuota', 'Último pago', 'Vencimiento', 'Cliente desde', 'Responsable'],
    ['Ana Gómez', '11 5555-1234', 'Aquagym 3x', 42000, aISO(hoy), aISO(en30), '2025-03-01', ''],
    ['Tomás Ruiz', '11 5555-9876', 'Natación Niños 3x', 38000, aISO(hoy), aISO(en30), '2026-02-15', 'Laura Ruiz (mamá)'],
  ]

  const hoja = XLSX.utils.aoa_to_sheet(filas)
  hoja['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 20 }, { wch: 10 }, { wch: 13 }, { wch: 13 }, { wch: 14 }, { wch: 22 }]
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, 'Clientes')
  XLSX.writeFile(libro, 'plantilla-clientes-pileta.xlsx')
}
