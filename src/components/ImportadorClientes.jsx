import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CAMPOS_CLIENTE,
  ErrorImportacion,
  aplicarClientes,
  descargarPlantillaClientes,
  interpretarFilas,
  leerArchivo,
  sugerirMapeo,
} from '../lib/importer.js'
import { formatoFecha, formatoMonto } from '../lib/fechas.js'
import { useDatos } from '../lib/store.jsx'
import Boton from './Boton.jsx'

const PASOS = [
  { id: 'subir', etiqueta: 'Subir' },
  { id: 'mapear', etiqueta: 'Columnas' },
  { id: 'previsualizar', etiqueta: 'Revisar' },
  { id: 'resultado', etiqueta: 'Listo' },
]

const FILAS_PREVIA = 8

function Paso({ actual }) {
  const indice = PASOS.findIndex((p) => p.id === actual)
  return (
    <div>
      <p className="dato text-[11px] tracking-widest text-cloro uppercase">
        Paso {indice + 1} de {PASOS.length} · {PASOS[indice].etiqueta}
      </p>
      <ol className="mt-2 flex gap-1.5" aria-label={`Paso ${indice + 1} de ${PASOS.length}`}>
        {PASOS.map((p, i) => (
          <li
            key={p.id}
            className={`h-1 flex-1 rounded-full transition-colors ${i <= indice ? 'bg-cloro' : 'bg-white/20'}`}
          />
        ))}
      </ol>
    </div>
  )
}

function Cargando({ texto }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16" role="status" aria-live="polite">
      <span className="size-8 animate-spin rounded-full border-2 border-borde border-t-cloro-tinta" aria-hidden="true" />
      <p className="text-sm text-tinta-3">{texto}</p>
    </div>
  )
}

/** El error no dice solo qué falló: dice qué hacer. Si acá aparece un mensaje que
 *  no se entiende, la clienta vuelve al Excel y no vuelve más. */
function Problema({ error, onReintentar }) {
  return (
    <div className="rounded-2xl border border-error/30 bg-error/6 p-5" role="alert">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-error/15 text-error-tinta">
          <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 2.4l6.2 12H1.8z" />
            <path d="M8 6.6v3.2M8 12.2h.01" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="font-titulo text-sm font-semibold text-tinta">{error.titulo || 'No pudimos leer el archivo'}</p>
          {error.comoArreglar && (
            <p className="mt-1.5 text-sm leading-relaxed text-tinta-2">{error.comoArreglar}</p>
          )}
        </div>
      </div>
      <Boton variante="secundario" onClick={onReintentar} className="mt-4">
        Probar con otro archivo
      </Boton>
    </div>
  )
}

function ZonaDeSubida({ onArchivo }) {
  const [encima, setEncima] = useState(false)
  const input = useRef(null)

  const soltar = (e) => {
    e.preventDefault()
    setEncima(false)
    const archivo = e.dataTransfer?.files?.[0]
    if (archivo) onArchivo(archivo)
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setEncima(true)
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={soltar}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${
          encima ? 'border-cloro bg-cloro/8' : 'border-borde bg-white'
        }`}
      >
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-agua/8 text-agua">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 15.5V4M12 4L8 8M12 4l4 4" />
            <path d="M4 15v3.4A1.6 1.6 0 005.6 20h12.8a1.6 1.6 0 001.6-1.6V15" />
          </svg>
        </span>
        <p className="mt-3 font-titulo text-base font-semibold text-tinta">
          Arrastrá tu planilla acá
        </p>
        <p className="mt-1 text-sm text-tinta-3">
          Archivos .xlsx o .csv. No importa cómo se llamen las columnas — en el paso
          siguiente las emparejamos.
        </p>

        <input
          ref={input}
          type="file"
          accept=".xlsx,.xls,.xlsm,.csv,.txt"
          className="sr-only"
          onChange={(e) => {
            const archivo = e.target.files?.[0]
            if (archivo) onArchivo(archivo)
            e.target.value = ''
          }}
        />
        <Boton variante="primario" onClick={() => input.current?.click()} className="mt-4">
          Elegir archivo
        </Boton>
      </div>

      <div className="mt-4 rounded-2xl border border-borde bg-white p-4">
        <p className="text-sm font-medium text-tinta">¿No tenés una planilla armada?</p>
        <p className="mt-1 text-xs leading-relaxed text-tinta-3">
          Bajate la plantilla con las columnas ya puestas y dos filas de ejemplo, completala
          y volvé a subirla.
        </p>
        <Boton variante="secundario" onClick={descargarPlantillaClientes} className="mt-3">
          <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v8M8 10l-3-3M8 10l3-3M3 12.5v1A1.5 1.5 0 004.5 15h7a1.5 1.5 0 001.5-1.5v-1" />
          </svg>
          Descargar plantilla .xlsx
        </Boton>
      </div>
    </div>
  )
}

function Mapeo({ leido, mapeo, setMapeo }) {
  const primeraFila = leido.filas[0] || []

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-borde bg-white p-4">
        <p className="text-sm text-tinta">
          Leímos <span className="dato font-semibold">{leido.filas.length}</span>{' '}
          {leido.filas.length === 1 ? 'fila' : 'filas'} de la hoja{' '}
          <span className="font-medium">{leido.hoja}</span>, con los encabezados de la fila{' '}
          <span className="dato">{leido.filaEncabezado}</span>.
        </p>
        <p className="mt-1 text-xs text-tinta-3">
          Emparejá cada dato de la app con la columna de tu planilla. Lo que dejes sin asignar,
          simplemente no se importa.
        </p>
      </div>

      <div className="space-y-2">
        {CAMPOS_CLIENTE.map((campo) => {
          const col = mapeo[campo.id]
          const muestra = col !== null && col !== undefined ? primeraFila[col] : null
          const faltaObligatorio = campo.obligatorio && (col === null || col === undefined)

          return (
            <div
              key={campo.id}
              className={`rounded-2xl border bg-white p-3 sm:flex sm:items-center sm:gap-4 ${
                faltaObligatorio ? 'border-error/40' : 'border-borde'
              }`}
            >
              <div className="sm:w-48 sm:shrink-0">
                <label htmlFor={`mapa-${campo.id}`} className="block text-sm font-medium text-tinta">
                  {campo.etiqueta}
                  {campo.obligatorio && (
                    <span className="ml-1 text-error-tinta" title="Obligatorio">
                      *
                    </span>
                  )}
                </label>
                {campo.ayuda && <p className="text-[11px] leading-snug text-tinta-3">{campo.ayuda}</p>}
              </div>

              <div className="mt-2 min-w-0 flex-1 sm:mt-0">
                <select
                  id={`mapa-${campo.id}`}
                  value={col ?? ''}
                  onChange={(e) =>
                    setMapeo((m) => ({ ...m, [campo.id]: e.target.value === '' ? null : Number(e.target.value) }))
                  }
                  className={`min-h-11 w-full rounded-xl border bg-white px-3 text-sm text-tinta focus:outline-none ${
                    faltaObligatorio ? 'border-error focus:border-error-tinta' : 'border-borde focus:border-cloro'
                  }`}
                >
                  <option value="">— sin asignar —</option>
                  {leido.encabezados.map((h, i) => (
                    <option key={i} value={i}>
                      {h}
                    </option>
                  ))}
                </select>
                {muestra !== null && muestra !== undefined && String(muestra).trim() !== '' && (
                  <p className="mt-1 truncate text-[11px] text-tinta-3">
                    Primer valor: <span className="dato text-tinta-2">{String(muestra).slice(0, 40)}</span>
                  </p>
                )}
                {faltaObligatorio && (
                  <p role="alert" className="mt-1 text-[11px] text-error-tinta">
                    Sin esta columna no se puede importar. Elegí cuál tiene los nombres.
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const mostrar = (campo, valor) => {
  if (valor === undefined || valor === null || valor === '') return <span className="text-tinta-4">—</span>
  if (campo.tipo === 'fecha') return <span className="dato">{formatoFecha(valor)}</span>
  if (campo.tipo === 'numero') return <span className="dato">{formatoMonto(valor)}</span>
  return String(valor)
}

function Previa({ leido, interpretacion, aplicacion, clientesCrudos }) {
  const campos = CAMPOS_CLIENTE.filter((c) => interpretacion.registros.some((r) => r[c.id] !== undefined))
  const existentes = useMemo(
    () => new Set(clientesCrudos.map((c) => c.nombre.toLowerCase().trim())),
    [clientesCrudos],
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          { n: aplicacion.agregados.length, t: 'se agregan', clase: 'text-exito-tinta' },
          { n: aplicacion.actualizados.length, t: 'se actualizan', clase: 'text-agua' },
          { n: interpretacion.incidencias.filter((i) => i.motivo.includes('nombre')).length, t: 'se saltean', clase: 'text-tinta-3' },
        ].map((x) => (
          <div key={x.t} className="rounded-2xl border border-borde bg-white p-3 text-center">
            <p className={`dato text-2xl font-bold ${x.clase}`}>{x.n}</p>
            <p className="text-[11px] text-tinta-3">{x.t}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-2 text-xs text-tinta-3">
          Así quedan las primeras {Math.min(FILAS_PREVIA, interpretacion.registros.length)} filas, con las
          fechas ya interpretadas. Si alguna se ve mal, volvé al paso anterior y cambiá la columna.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-borde bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-borde bg-espuma/70 text-[11px] tracking-wide text-tinta-3 uppercase">
                <th scope="col" className="px-3 py-2 font-medium">Fila</th>
                {campos.map((c) => (
                  <th key={c.id} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                    {c.etiqueta}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 font-medium">Qué pasa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde-suave">
              {interpretacion.registros.slice(0, FILAS_PREVIA).map((r) => {
                const esNuevo = !existentes.has(String(r.nombre).toLowerCase().trim())
                return (
                  <tr key={r._fila}>
                    <td className="dato px-3 py-2 text-xs text-tinta-4">{r._fila}</td>
                    {campos.map((c) => (
                      <td key={c.id} className="px-3 py-2 whitespace-nowrap text-tinta-2">
                        {mostrar(c, r[c.id])}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          esNuevo ? 'bg-exito/12 text-exito-tinta' : 'bg-agua/8 text-agua'
                        }`}
                      >
                        {esNuevo ? 'Nuevo' : 'Actualiza'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {interpretacion.registros.length > FILAS_PREVIA && (
          <p className="mt-2 text-xs text-tinta-3">
            …y <span className="dato">{interpretacion.registros.length - FILAS_PREVIA}</span> filas más.
          </p>
        )}
      </div>

      {interpretacion.incidencias.length > 0 && (
        <details className="rounded-2xl border border-alerta/30 bg-alerta/8 p-4" open>
          <summary className="cursor-pointer text-sm font-medium text-alerta-tinta">
            {interpretacion.incidencias.length}{' '}
            {interpretacion.incidencias.length === 1 ? 'fila con un problema' : 'filas con problemas'}
          </summary>
          <ul className="mt-3 space-y-1.5">
            {interpretacion.incidencias.slice(0, 12).map((inc, i) => (
              <li key={i} className="flex gap-2 text-xs text-tinta-2">
                <span className="dato shrink-0 text-tinta-3">Fila {inc.fila}</span>
                <span>
                  {inc.motivo}
                  {inc.detalle ? ` — ${inc.detalle}` : ''}
                </span>
              </li>
            ))}
            {interpretacion.incidencias.length > 12 && (
              <li className="text-xs text-tinta-3">…y {interpretacion.incidencias.length - 12} más.</li>
            )}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-tinta-3">
            Las filas sin nombre no se importan. Las que tienen una fecha o un importe que no se
            entendió sí entran, pero con ese dato vacío para que lo completes después.
          </p>
        </details>
      )}
    </div>
  )
}

function Resultado({ resumen, onCerrar, onVerClientes }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-exito/30 bg-exito/8 p-5 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-exito text-white">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <p className="mt-3 font-titulo text-lg font-bold text-tinta">Importación terminada</p>
        <p className="mt-1 text-sm text-tinta-2">
          <span className="dato font-semibold">{resumen.agregados.length}</span>{' '}
          {resumen.agregados.length === 1 ? 'cliente nuevo' : 'clientes nuevos'} y{' '}
          <span className="dato font-semibold">{resumen.actualizados.length}</span>{' '}
          {resumen.actualizados.length === 1 ? 'actualizado' : 'actualizados'}.
        </p>
      </div>

      {resumen.sinFecha.length > 0 && (
        <div className="rounded-2xl border border-alerta/30 bg-alerta/8 p-4">
          <p className="text-sm font-medium text-alerta-tinta">
            {resumen.sinFecha.length}{' '}
            {resumen.sinFecha.length === 1 ? 'quedó' : 'quedaron'} sin fecha de vencimiento
          </p>
          <p className="mt-1 text-xs leading-relaxed text-tinta-2">
            Les pusimos la fecha de hoy para que aparezcan como “por vencer” y no se te pasen.
            Entrá a cada ficha y corregí la fecha real:{' '}
            <span className="font-medium">{resumen.sinFecha.map((s) => s.nombre).join(', ')}</span>
          </p>
        </div>
      )}

      {resumen.saltadas > 0 && (
        <div className="rounded-2xl border border-borde bg-white p-4">
          <p className="text-sm text-tinta">
            <span className="dato font-semibold">{resumen.saltadas}</span>{' '}
            {resumen.saltadas === 1 ? 'fila no se importó' : 'filas no se importaron'} porque no
            tenían nombre.
          </p>
          <p className="mt-1 text-xs text-tinta-3">
            Suele ser una fila en blanco, un subtotal o una nota al pie de la planilla.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Boton variante="primario" onClick={onVerClientes}>
          Ver la lista de clientes
        </Boton>
        <Boton variante="secundario" onClick={onCerrar}>
          Cerrar
        </Boton>
      </div>
    </div>
  )
}

export default function ImportadorClientes({ abierto, onCerrar, onVerClientes }) {
  const { clientesCrudos, reemplazarClientes, avisar } = useDatos()
  const [paso, setPaso] = useState('subir')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [leido, setLeido] = useState(null)
  const [mapeo, setMapeo] = useState({})
  const [resumen, setResumen] = useState(null)

  useEffect(() => {
    if (!abierto) return
    const alPresionar = (e) => e.key === 'Escape' && onCerrar()
    document.addEventListener('keydown', alPresionar)
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alPresionar)
      document.body.style.overflow = previo
    }
  }, [abierto, onCerrar])

  const reiniciar = () => {
    setPaso('subir')
    setError(null)
    setLeido(null)
    setMapeo({})
    setResumen(null)
  }

  const recibirArchivo = async (archivo) => {
    setError(null)
    setCargando(true)
    try {
      const datos = await leerArchivo(archivo)
      setLeido({ ...datos, nombreArchivo: archivo.name })
      setMapeo(sugerirMapeo(datos.encabezados, CAMPOS_CLIENTE))
      setPaso('mapear')
    } catch (e) {
      setError(e instanceof ErrorImportacion ? e : { titulo: 'No pudimos leer el archivo.', comoArreglar: e.message })
    } finally {
      setCargando(false)
    }
  }

  const interpretacion = useMemo(
    () => (leido ? interpretarFilas(leido.filas, mapeo, CAMPOS_CLIENTE, leido.filaEncabezado) : null),
    [leido, mapeo],
  )

  // La vista previa y lo que finalmente se guarda salen del MISMO cálculo, así que
  // lo que ella confirma en pantalla es exactamente lo que queda guardado.
  const aplicacion = useMemo(
    () => (interpretacion ? aplicarClientes(clientesCrudos, interpretacion.registros) : null),
    [clientesCrudos, interpretacion],
  )

  if (!abierto) return null

  const puedeSeguir = mapeo.nombre !== null && mapeo.nombre !== undefined
  const hayRegistros = (interpretacion?.registros.length ?? 0) > 0

  const confirmar = () => {
    reemplazarClientes(aplicacion.clientes)
    setResumen({
      agregados: aplicacion.agregados,
      actualizados: aplicacion.actualizados,
      sinFecha: aplicacion.sinFecha,
      saltadas: interpretacion.incidencias.filter((i) => i.motivo.includes('nombre')).length,
    })
    setPaso('resultado')
    avisar(
      `Importaste ${aplicacion.agregados.length} clientes nuevos y actualizaste ${aplicacion.actualizados.length}.`,
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="anim-aparecer absolute inset-0 cursor-default bg-profundidad/50 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Importar clientes desde una planilla"
        className="anim-subir relative flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-espuma shadow-agua-lg sm:rounded-3xl"
      >
        <div className="relative shrink-0 bg-agua px-5 pt-4 pb-5 sm:px-6">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/30 sm:hidden" />
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="absolute top-4 right-4 grid size-11 place-items-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
          <div className="pr-12">
            <Paso actual={paso} />
            <h2 className="mt-2.5 font-titulo text-xl font-bold text-white">
              Importar clientes desde tu planilla
            </h2>
            {leido && paso !== 'resultado' && (
              <p className="mt-0.5 truncate text-sm text-white/70">{leido.nombreArchivo}</p>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          {cargando ? (
            <Cargando texto="Leyendo la planilla…" />
          ) : error ? (
            <Problema error={error} onReintentar={reiniciar} />
          ) : paso === 'subir' ? (
            <ZonaDeSubida onArchivo={recibirArchivo} />
          ) : paso === 'mapear' ? (
            <Mapeo leido={leido} mapeo={mapeo} setMapeo={setMapeo} />
          ) : paso === 'previsualizar' ? (
            <Previa
              leido={leido}
              interpretacion={interpretacion}
              aplicacion={aplicacion}
              clientesCrudos={clientesCrudos}
            />
          ) : (
            <Resultado resumen={resumen} onCerrar={onCerrar} onVerClientes={onVerClientes} />
          )}
        </div>

        {!cargando && !error && paso !== 'subir' && paso !== 'resultado' && (
          <div className="flex shrink-0 items-center gap-2 border-t border-borde bg-white px-5 py-3 sm:px-6">
            <Boton
              variante="secundario"
              onClick={() => setPaso(paso === 'previsualizar' ? 'mapear' : 'subir')}
            >
              Atrás
            </Boton>
            <div className="flex-1" />
            {paso === 'mapear' ? (
              <Boton variante="primario" onClick={() => setPaso('previsualizar')} disabled={!puedeSeguir}>
                Ver cómo queda
              </Boton>
            ) : (
              <Boton variante="primario" onClick={confirmar} disabled={!hayRegistros}>
                Importar {interpretacion.registros.length}{' '}
                {interpretacion.registros.length === 1 ? 'cliente' : 'clientes'}
              </Boton>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
