// ── Elemento de identidad ───────────────────────────────────────────────────
// El motivo de la marca: las sogas de carril de una pileta vistas desde arriba —
// rayas finas alternadas, cada carril con su propio largo de tramo y su desfase,
// como cuando las boyas no quedan alineadas entre carril y carril.
//
// Va en UN solo lugar: la cabecera de marca (la barra Agua Profunda que en desktop
// es el tope del sidebar y en celular el tope de la pantalla). No se repite en las
// cards ni en los títulos de sección: si estuviera en todos lados dejaría de ser un
// gesto y sería un fondo.
//
// Es CSS y no SVG a propósito: un `repeating-linear-gradient` mantiene el largo de
// los tramos exacto a cualquier ancho de pantalla, mientras que un SVG estirado los
// deformaría.

const CARRILES = [
  { tramo: 15, desfase: 0, opacidad: 0.85, alto: 3 },
  { tramo: 11, desfase: 7, opacidad: 0.55, alto: 2 },
  { tramo: 18, desfase: 3, opacidad: 0.7, alto: 3 },
  { tramo: 13, desfase: 11, opacidad: 0.4, alto: 2 },
]

const AGUA = '#2EC4B6'
const BOYA = 'rgba(245, 250, 250, 0.92)'

const DESVANECIDO = 'linear-gradient(90deg, #000 0%, #000 48%, rgba(0,0,0,0.25) 78%, transparent 100%)'

export default function LineasDeCarril({ className = '' }) {
  return (
    <div className={`flex flex-col gap-[5px] ${className}`} aria-hidden="true">
      {CARRILES.map((c, i) => (
        <div
          key={i}
          style={{
            height: c.alto,
            opacity: c.opacidad,
            backgroundImage: `repeating-linear-gradient(90deg, ${AGUA} 0 ${c.tramo}px, ${BOYA} ${c.tramo}px ${c.tramo * 2}px)`,
            backgroundPositionX: `${c.desfase}px`,
            maskImage: DESVANECIDO,
            WebkitMaskImage: DESVANECIDO,
          }}
        />
      ))}
    </div>
  )
}
