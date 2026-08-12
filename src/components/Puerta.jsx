import PantallaAgua from './PantallaAgua.jsx'
import Login from './Login.jsx'
import { useSesion } from '../lib/sesion.jsx'
import { useEsperaLarga } from '../lib/espera.js'

// ── Quién pasa ─────────────────────────────────────────────────────────────
// Tres estados y en este orden:
//   1. faltan las claves  → no es culpa de nadie que esté usando la app, es que
//                           falta configurarla. Se dice qué falta y dónde va.
//   2. resolviendo sesión → el agua sola. NO el login: la sesión guardada casi
//                           siempre existe, y mostrar "iniciá sesión" para
//                           reemplazarlo 200ms después es un parpadeo que hace
//                           dudar de si la app se acordó de vos.
//   3. sin sesión         → el login.
// Recién con sesión resuelta se montan los datos, y por eso ProveedorDatos cuelga
// de acá adentro: pedir filas antes de tener token devuelve cero por RLS, que se
// vería igual que una base vacía.

function SinClaves() {
  return (
    <div>
      <h2 className="font-titulo text-xl font-semibold text-tinta">Falta conectar la base</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-tinta-2">
        La app no encuentra las claves del proyecto de Supabase.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-tinta-3">
        Creá un archivo <span className="dato text-tinta-2">.env.local</span> en la raíz del
        proyecto con estas dos líneas y volvé a levantar el servidor:
      </p>
      <pre className="dato mt-3 overflow-x-auto rounded-xl bg-agua/6 px-3.5 py-3 text-xs leading-relaxed text-tinta-2">
        VITE_SUPABASE_URL={'\n'}VITE_SUPABASE_ANON_KEY=
      </pre>
      <p className="mt-3 text-xs leading-relaxed text-tinta-3">
        El paso a paso está en <span className="dato">supabase/LEEME.md</span>.
      </p>
    </div>
  )
}

function Abriendo() {
  return (
    <div className="flex items-center gap-3" role="status" aria-live="polite">
      <span
        className="size-5 shrink-0 animate-spin rounded-full border-2 border-borde border-t-cloro-tinta"
        aria-hidden="true"
      />
      <p className="text-sm text-tinta-2">Abriendo tu panel…</p>
    </div>
  )
}

export default function Puerta({ children }) {
  const { sesion, cargando, recuperando, faltanClaves } = useSesion()
  const espera = useEsperaLarga(cargando)

  if (faltanClaves) {
    return (
      <PantallaAgua>
        <SinClaves />
      </PantallaAgua>
    )
  }

  // Con buena señal esto dura menos que un parpadeo y no llega a mostrar nada.
  if (cargando) return <PantallaAgua>{espera ? <Abriendo /> : null}</PantallaAgua>

  // `recuperando` gana sobre la sesión: el link del mail deja una sesión válida,
  // pero lo único que corresponde hacer con ella es elegir la contraseña nueva.
  if (!sesion || recuperando) return <Login />

  return children
}
