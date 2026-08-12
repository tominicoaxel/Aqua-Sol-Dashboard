import LineasDeCarril from './LineasDeCarril.jsx'

// ── La pantalla de la puerta ────────────────────────────────────────────────
// Es la única pantalla que se ve sin sesión, así que es la única vez que la marca
// tiene lugar para respirar. La composición sale de los nombres de la propia
// paleta: una tarjeta ESPUMA flotando sobre AGUA PROFUNDA.
//
// El degradé va de claro arriba a oscuro abajo porque es lo que hace el agua con
// la profundidad — no es un fondo degradado de adorno, es el tema del producto.
// Los tres tonos son los que ya están en `index.css`: agua-claro, agua, agua-hondo.
//
// En celular la tarjeta va PEGADA ABAJO: ahí llega el pulgar de una mano. En
// escritorio se centra, que es donde mira el ojo.

const AGUA_EN_PROFUNDIDAD = 'linear-gradient(180deg, #17698a 0%, #0b4f6c 42%, #083a50 100%)'

export default function PantallaAgua({ children }) {
  return (
    <div className="flex min-h-dvh flex-col" style={{ backgroundImage: AGUA_EN_PROFUNDIDAD }}>
      <header className="px-6 pt-12 pb-9 sm:px-8 sm:pt-16">
        <h1 className="font-titulo text-2xl leading-none font-bold tracking-[0.24em] text-white">PILETA</h1>
        <p className="mt-2 text-xs tracking-wide text-cloro">Panel de gestión</p>
        {/* El motivo de carriles, en el único lugar donde vive: la cabecera de marca */}
        <LineasDeCarril className="mt-6 max-w-[240px]" />
      </header>

      {/* Sin contenido no se dibuja la tarjeta: mientras se resuelve la sesión, un
          rectángulo blanco vacío se lee como algo que se rompió. Mejor el agua sola. */}
      {children && (
        <div className="mt-auto w-full sm:mx-auto sm:my-auto sm:max-w-[26rem] sm:px-6">
          <div
            className="rounded-t-[28px] bg-espuma px-6 pt-7 shadow-agua-lg sm:rounded-3xl sm:px-7"
            style={{ paddingBottom: 'calc(1.75rem + env(safe-area-inset-bottom))' }}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  )
}
