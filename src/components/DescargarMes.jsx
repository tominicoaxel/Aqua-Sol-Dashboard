import { useMemo, useState } from 'react'
import { datosDelMes, descargarMesExcel, mesesConDatos } from '../lib/exportar.js'
import { useEsperaLarga } from '../lib/espera.js'
import { formatoMonto } from '../lib/fechas.js'
import { useDatos } from '../lib/store.jsx'
import Boton from './Boton.jsx'
import Campo from './Campo.jsx'

// El cierre de mes: bajarse todo lo del mes en un .xlsx y guardarlo, mandárselo a
// la contadora o seguir la cuenta en Excel como venía haciendo.
//
// Antes de bajar nada se dice QUÉ va adentro —pagos, total, clases dadas—, y eso
// no es adorno: bajar un archivo, abrirlo y descubrir que estaba vacío porque era
// el mes equivocado es el camino largo para la misma respuesta.

const IconoDescarga = (p) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M8 2v8M8 10l-3-3M8 10l3-3M3 12.5v1A1.5 1.5 0 004.5 15h7a1.5 1.5 0 001.5-1.5v-1" />
  </svg>
)

export default function DescargarMes() {
  const { clientes, horarios, asistencias, dictados, docentes, listaEspera, avisar } = useDatos()
  const [elegido, setElegido] = useState(null)
  const [bajando, setBajando] = useState(false)
  const [error, setError] = useState(null)
  const tarda = useEsperaLarga(bajando)

  const meses = useMemo(
    () => mesesConDatos({ clientes, asistencias, dictados }),
    [clientes, asistencias, dictados],
  )

  // El mes en curso es siempre el primero de la lista y es el que se ofrece por
  // defecto. Si los datos llegaron después de la primera pintada, o si el mes que
  // había elegido desapareció, se cae al más nuevo en vez de quedarse en un valor
  // que ya no existe y dejar el `select` en blanco.
  const mes = meses.some((m) => m.id === elegido) ? elegido : meses[0]?.id

  const planilla = useMemo(
    () =>
      mes
        ? datosDelMes({ clientes, horarios, asistencias, dictados, docentes, listaEspera }, mes)
        : null,
    [clientes, horarios, asistencias, dictados, docentes, listaEspera, mes],
  )

  const descargar = async () => {
    setBajando(true)
    setError(null)
    try {
      const { archivo, etiqueta } = await descargarMesExcel(
        { clientes, horarios, asistencias, dictados, docentes, listaEspera },
        mes,
      )
      avisar(`Descargaste ${etiqueta.toLowerCase()} en ${archivo}.`)
    } catch (e) {
      // El único paso que puede fallar es traer SheetJS, y falla por la misma
      // razón por la que falla todo lo demás: se cortó la conexión.
      console.error(e)
      setError('No pudimos armar la planilla. Fijate la conexión y probá de nuevo.')
    } finally {
      setBajando(false)
    }
  }

  const totales = planilla?.totales
  const sinNada = totales && totales.pagos === 0 && totales.clasesDadas === 0

  return (
    <div className="rounded-2xl border border-borde bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-end gap-3">
        <Campo etiqueta="Mes" className="min-w-[11rem] flex-1">
          {(p) => (
            <select
              {...p}
              value={mes ?? ''}
              onChange={(e) => setElegido(e.target.value)}
              disabled={bajando}
            >
              {meses.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.etiqueta}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Boton variante="primario" onClick={descargar} disabled={bajando || !mes} aria-busy={bajando}>
          {tarda ? (
            <span
              className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
              aria-hidden="true"
            />
          ) : (
            <IconoDescarga className="size-4" />
          )}
          {bajando ? 'Armando la planilla…' : 'Descargar Excel'}
        </Boton>
      </div>

      {totales && (
        <p className="mt-3 text-sm text-tinta-2" aria-live="polite">
          {sinNada ? (
            <span className="text-tinta-3">
              Este mes todavía no tiene pagos ni clases marcadas. La planilla se baja igual, con el
              padrón y los horarios como están hoy.
            </span>
          ) : (
            <>
              <span className="dato font-medium">{totales.pagos}</span>{' '}
              {totales.pagos === 1 ? 'pago' : 'pagos'} por{' '}
              <span className="dato font-medium text-agua">{formatoMonto(totales.cobrado)}</span> ·{' '}
              <span className="dato font-medium">{totales.clasesDadas}</span>{' '}
              {totales.clasesDadas === 1 ? 'clase dada' : 'clases dadas'} ·{' '}
              <span className="dato font-medium">{totales.asistencias}</span>{' '}
              {totales.asistencias === 1 ? 'asistencia' : 'asistencias'}
            </>
          )}
        </p>
      )}

      <p className="mt-2 text-xs leading-relaxed text-tinta-3">
        Siete hojas: resumen, pagos, clientes, clases dadas, asistencias, docentes y lista de espera.
        Los pagos, las asistencias y las clases dadas son del mes elegido; el padrón, los horarios y
        las cuotas van como están hoy.
      </p>

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-error/10 px-3 py-2 text-xs text-error-tinta">
          {error}
        </p>
      )}
    </div>
  )
}
