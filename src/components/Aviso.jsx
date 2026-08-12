import { useDatos } from '../lib/store.jsx'

// Confirmación de que la acción efectivamente pasó, y su contracara: el aviso de
// que NO pasó. Un cambio que se aplica en silencio deja la duda de si el click hizo
// algo, y con datos de plata esa duda hace que la persona vuelva a apretar.
//
// Va en z-50, arriba de todo: la hoja de detalle está en z-40 y la navegación de
// celular en z-30. La escala es 30 / 40 / 50 y no números arbitrarios, así nunca
// hay que adivinar qué tapa a qué.

function Zocalo({ children }) {
  return (
    <div className="anim-subir fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-8">
      {children}
    </div>
  )
}

const Cruz = (p) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
)

/** El error de red gana sobre el aviso de éxito y NO se va solo: pide una decisión.
 *  Uno que desaparece a los 4 segundos deja a la persona sin saber si el pago que
 *  acaba de cargar quedó guardado o no. */
function ErrorDeRed({ error, descartar }) {
  return (
    <Zocalo>
      <div
        role="alert"
        className="w-full max-w-md rounded-2xl bg-profundidad p-4 shadow-agua-lg"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-error" aria-hidden="true">
            <svg viewBox="0 0 16 16" className="size-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M8 4v4.5M8 11h.01" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white">No se guardó: {error.texto}</p>
            {error.ayuda && <p className="mt-1 text-xs leading-relaxed text-white/70">{error.ayuda}</p>}
            <p className="mt-1 text-xs leading-relaxed text-white/70">
              El cambio se deshizo en la pantalla para que no veas algo que no quedó guardado.
            </p>
          </div>
          <button
            type="button"
            onClick={descartar}
            aria-label="Cerrar aviso"
            className="-mt-1 -mr-1 grid size-11 shrink-0 place-items-center rounded-xl text-white/60 transition duration-200 ease-suave hover:text-white"
          >
            <Cruz className="size-3.5" />
          </button>
        </div>
        {error.reintentar && (
          <button
            type="button"
            onClick={error.reintentar}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/12 px-4 text-sm font-medium text-white transition duration-200 ease-suave active:scale-[0.98] hover:bg-white/20"
          >
            <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13.5 8a5.5 5.5 0 11-1.7-3.9M13.5 2v3.2h-3.2" />
            </svg>
            Reintentar
          </button>
        )}
      </div>
    </Zocalo>
  )
}

export default function Aviso() {
  const { aviso, cerrarAviso, errorRed, descartarErrorRed } = useDatos()

  if (errorRed) return <ErrorDeRed error={errorRed} descartar={descartarErrorRed} />
  if (!aviso) return null

  return (
    <Zocalo>
      <div
        role="status"
        aria-live="polite"
        className="flex max-w-md items-center gap-3 rounded-2xl bg-profundidad py-3 pr-2 pl-4 shadow-agua-lg"
      >
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-exito" aria-hidden="true">
          <svg viewBox="0 0 16 16" className="size-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.5 8.5l3 3 6-6.5" />
          </svg>
        </span>
        <p className="text-sm text-white">{aviso.texto}</p>
        <button
          type="button"
          onClick={cerrarAviso}
          aria-label="Cerrar aviso"
          className="grid size-11 shrink-0 place-items-center rounded-xl text-white/60 transition duration-200 ease-suave hover:text-white"
        >
          <Cruz className="size-3.5" />
        </button>
      </div>
    </Zocalo>
  )
}
