import { useEffect, useRef } from 'react'

/** Panel de detalle. En celular entra desde abajo como hoja (el gesto que ya
 *  conoce cualquiera que use el teléfono con una mano); en desktop entra desde la
 *  derecha como cajón, sin tapar la lista que quedó atrás. */
export default function Hoja({ abierta, onCerrar, titulo, encabezado, children }) {
  const panel = useRef(null)

  useEffect(() => {
    if (!abierta) return
    const alPresionar = (e) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alPresionar)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    return () => {
      document.removeEventListener('keydown', alPresionar)
      document.body.style.overflow = overflowPrevio
    }
  }, [abierta, onCerrar])

  if (!abierta) return null

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-stretch sm:justify-end">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="anim-aparecer absolute inset-0 cursor-default bg-profundidad/45 backdrop-blur-[2px]"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className="anim-subir sm:anim-entrar relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-espuma shadow-agua-lg outline-none sm:h-full sm:max-h-none sm:w-[28rem] sm:rounded-t-none sm:rounded-l-3xl"
      >
        <div className="relative shrink-0 bg-agua px-5 pt-4 pb-5 text-white sm:px-6">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/30 sm:hidden" />
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="absolute top-4 right-4 grid size-8 place-items-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white sm:top-5"
          >
            <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
          {encabezado}
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  )
}
