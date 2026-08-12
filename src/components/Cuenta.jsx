import { useSesion } from '../lib/sesion.jsx'

// ── Cerrar sesión ──────────────────────────────────────────────────────────
// Discreto pero encontrable: abajo de la navegación en escritorio, en la esquina de
// la cabecera en celular. No pide confirmación porque no borra nada — volver a
// entrar cuesta dos campos.

const IconoSalir = (p) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12.4 6V4.4A1.4 1.4 0 0011 3H4.9a1.4 1.4 0 00-1.4 1.4v11.2A1.4 1.4 0 004.9 17H11a1.4 1.4 0 001.4-1.4V14" />
    <path d="M8.4 10h8.2M14 7.2L16.8 10 14 12.8" />
  </svg>
)

/** Pie del sidebar en escritorio: quién está adentro y cómo salir. */
export function BloqueCuenta() {
  const { email, salir } = useSesion()

  return (
    <div className="border-t border-white/10 px-3 pt-3 pb-5">
      <p className="truncate px-3 text-[11px] text-white/45" title={email}>
        {email}
      </p>
      <button
        type="button"
        onClick={salir}
        className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-white/60 transition duration-200 ease-suave hover:bg-white/8 hover:text-white"
      >
        <IconoSalir className="size-5 shrink-0" />
        Cerrar sesión
      </button>
    </div>
  )
}

/** Celular: solo el ícono, en la esquina de la cabecera de marca. */
export function SalirCompacto() {
  const { salir } = useSesion()

  return (
    <button
      type="button"
      onClick={salir}
      aria-label="Cerrar sesión"
      className="-mr-2 grid size-11 shrink-0 place-items-center rounded-xl text-white/60 transition duration-200 ease-suave active:scale-95 hover:bg-white/8 hover:text-white"
    >
      <IconoSalir className="size-5" />
    </button>
  )
}
