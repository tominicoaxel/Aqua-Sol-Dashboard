// Botón base. Existe sobre todo para fijar el tamaño mínimo táctil en un solo
// lugar: 44px de alto, que es lo que necesita un dedo para no errarle.
//
// La variante "peligro" usa el rojo OSCURO de la paleta y no el vivo: el vivo con
// texto blanco encima da 3.7:1, por debajo del mínimo legible. El oscuro da 7.2:1.
//
// El `active:scale` no es adorno: sin respuesta al toque, en un celular no se sabe
// si el dedo llegó a apretar o resbaló.

const VARIANTES = {
  primario: 'bg-agua text-white hover:bg-agua-hondo',
  secundario: 'border border-borde bg-white text-tinta-2 hover:border-cloro/60 hover:text-tinta',
  peligro: 'bg-error-tinta text-white hover:brightness-110',
  fantasma: 'text-tinta-3 hover:bg-agua/6 hover:text-tinta',
}

export default function Boton({
  variante = 'secundario',
  className = '',
  type = 'button',
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition duration-200 ease-suave active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 ${VARIANTES[variante]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
