import Boton from './Boton.jsx'
import { useDatos } from '../lib/store.jsx'
import { useEsperaLarga } from '../lib/espera.js'

// ─── Los tres estados de la app antes de tener datos ────────────────────────
// Cargando · falló la carga · la base está vacía. Ninguno de los tres existía
// cuando los datos venían de memoria; los tres son consecuencia de que ahora hay
// una red en el medio y ella la usa con mala señal al borde de la pileta.

/** Esqueleto de la pantalla, no un spinner centrado: mantiene la forma de lo que
 *  viene, así el contenido no salta cuando llega. Aparece recién a los 300ms —
 *  con buena señal la carga entra antes y no llega a verse nada. */
export function Cargando() {
  const larga = useEsperaLarga(true)
  if (!larga) return null

  return (
    <div role="status" aria-live="polite" className="anim-aparecer">
      <span className="sr-only">Cargando tus datos…</span>
      <div className="h-7 w-44 rounded-lg bg-borde-suave" />
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 rounded-2xl border border-borde bg-white/70" />
        ))}
      </div>
      <div className="mt-6 h-5 w-32 rounded-lg bg-borde-suave" />
      <div className="mt-3 space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-2xl border border-borde bg-white/70" />
        ))}
      </div>
    </div>
  )
}

/** No pudo leer. Lo importante es que se pueda salir del paso sin recargar la
 *  página: si el único camino es F5, la mitad de las veces se cierra la app. */
export function ErrorDeCarga() {
  const { errorCarga, reintentarCarga } = useDatos()

  return (
    <div role="alert" className="rounded-2xl border border-error/40 bg-white p-6 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-full bg-error/12 text-error-tinta">
        <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 5.5v5M10 13.6h.01" />
          <circle cx="10" cy="10" r="7.2" />
        </svg>
      </span>
      <h2 className="mt-3.5 font-titulo text-lg font-semibold text-tinta">
        No se pudieron cargar tus datos
      </h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-tinta-2">
        {errorCarga?.texto ?? 'Algo falló en el camino.'}
      </p>
      {errorCarga?.ayuda && (
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-tinta-3">{errorCarga.ayuda}</p>
      )}
      <Boton variante="primario" onClick={reintentarCarga} className="mt-5">
        <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13.5 8a5.5 5.5 0 11-1.7-3.9M13.5 2v3.2h-3.2" />
        </svg>
        Reintentar
      </Boton>
      <p className="mt-4 text-xs leading-relaxed text-tinta-4">
        Si esto sigue después de varios días sin usar la app, puede ser que la base esté
        en pausa. Se despierta desde el panel de Supabase.
      </p>
    </div>
  )
}

/** La primera vez la base está vacía. Una tabla en blanco con "no hay resultados"
 *  la dejaría mirando la nada; el estado vacío tiene una sola salida y empuja
 *  directo a ella. */
export function PrimerArranque({ onImportar }) {
  return (
    <div className="rounded-2xl border border-borde bg-white p-7 text-center sm:p-10">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-cloro/15 text-cloro-tinta">
        <svg viewBox="0 0 20 20" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.4 5.2A1.8 1.8 0 015.2 3.4h3.3l1.6 2h4.7a1.8 1.8 0 011.8 1.8v7.4a1.8 1.8 0 01-1.8 1.8H5.2a1.8 1.8 0 01-1.8-1.8z" />
          <path d="M10 8.4v4.4M8 10.6l2-2.2 2 2.2" />
        </svg>
      </span>

      <h2 className="mt-4 font-titulo text-xl font-semibold text-tinta sm:text-2xl">
        Traé tu planilla y empezá
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-tinta-2">
        Todavía no hay nadie cargado. Subí el Excel que ya venís usando y en cuatro pasos
        quedan todos acá: nombres, cuotas, últimos pagos y vencimientos.
      </p>

      <Boton variante="primario" onClick={onImportar} className="mt-6 min-h-12 px-6">
        Importar desde Excel
      </Boton>

      <p className="mx-auto mt-5 max-w-md text-xs leading-relaxed text-tinta-3">
        No hace falta que la planilla tenga un formato especial: la app lee los encabezados
        que ya tenga y te propone el emparejamiento. <span className="font-medium text-tinta-2">Agrega
        y actualiza, nunca borra</span>, así que podés volver a importarla las veces que quieras.
      </p>
    </div>
  )
}
