import { ESTADOS } from '../lib/estados.js'

/** El estado siempre se lee dos veces: por color y por palabra.
 *  Los colores vivos del brief no llegan a 3:1 contra el fondo, así que el punto
 *  de color acompaña pero nunca informa solo — el texto es el que manda. */
export default function EstadoChip({ estado, chico = false }) {
  const e = ESTADOS[estado]
  if (!e) return null
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ${e.chip} ${
        chico ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${e.punto}`} aria-hidden="true" />
      {e.etiqueta}
    </span>
  )
}
