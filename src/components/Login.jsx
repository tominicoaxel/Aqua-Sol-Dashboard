import { useState } from 'react'
import PantallaAgua from './PantallaAgua.jsx'
import Boton from './Boton.jsx'
import Campo from './Campo.jsx'
import { useSesion } from '../lib/sesion.jsx'
import { useEsperaLarga } from '../lib/espera.js'

// ── Entrar ─────────────────────────────────────────────────────────────────
// Email y contraseña, nada más. No hay registro a propósito: la cuenta se crea a
// mano desde el panel de Supabase. Un link de "crear cuenta" que después rebota es
// peor que no tenerlo.

const OjoAbierto = (p) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M1.8 10s3-5.4 8.2-5.4S18.2 10 18.2 10s-3 5.4-8.2 5.4S1.8 10 1.8 10z" />
    <circle cx="10" cy="10" r="2.4" />
  </svg>
)
const OjoTachado = (p) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M7.9 4.9A8 8 0 0110 4.6c5.2 0 8.2 5.4 8.2 5.4a15 15 0 01-2.7 3.4M4.6 6.3A15 15 0 001.8 10s3 5.4 8.2 5.4c1 0 1.9-.2 2.7-.5" />
    <path d="M8.3 8.3a2.4 2.4 0 003.4 3.4M2.6 2.6l14.8 14.8" />
  </svg>
)

const Girando = (p) => (
  <span
    className="size-4 shrink-0 animate-spin rounded-full border-2 border-white/35 border-t-white"
    aria-hidden="true"
    {...p}
  />
)

/** El error va acá adentro, arriba del botón y debajo de los campos: es donde está
 *  mirando la persona cuando aprieta. Lleva siempre qué pasó y qué hacer. */
function Falla({ mensaje }) {
  if (!mensaje) return null
  return (
    <div role="alert" className="mt-4 rounded-xl border border-error/40 bg-error/8 px-3.5 py-3">
      <p className="text-sm font-medium text-error-tinta">{mensaje.texto}</p>
      {mensaje.ayuda && <p className="mt-1 text-xs leading-relaxed text-tinta-2">{mensaje.ayuda}</p>}
    </div>
  )
}

function Entrar({ onRecuperar }) {
  const { entrar } = useSesion()
  const [email, setEmail] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [ver, setVer] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [tocado, setTocado] = useState({})
  const espera = useEsperaLarga(enviando)

  const faltaEmail = tocado.email && !email.trim()
  const faltaContrasena = tocado.contrasena && !contrasena

  const enviar = async (e) => {
    e.preventDefault()
    if (enviando) return
    setTocado({ email: true, contrasena: true })
    if (!email.trim() || !contrasena) return
    setError(null)
    setEnviando(true)
    const falla = await entrar(email, contrasena)
    setEnviando(false)
    // Si salió bien no hay nada que hacer: el cambio de sesión reemplaza la
    // pantalla entera. Anunciar "listo" y después navegar sería un paso de más.
    if (falla) setError(falla)
  }

  return (
    <form onSubmit={enviar} noValidate>
      <h2 className="font-titulo text-xl font-semibold text-tinta">Entrá a tu panel</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-tinta-3">
        Tus clientes, las cuotas y los horarios, desde cualquier dispositivo.
      </p>

      <Campo etiqueta="Email" error={faltaEmail ? 'Escribí tu email.' : undefined} className="mt-6">
        {(props) => (
          <input
            {...props}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTocado((t) => ({ ...t, email: true }))}
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            placeholder="nombre@correo.com"
          />
        )}
      </Campo>

      <Campo
        etiqueta="Contraseña"
        error={faltaContrasena ? 'Escribí tu contraseña.' : undefined}
        className="mt-4"
      >
        {(props) => (
          <div className="relative">
            <input
              {...props}
              className={`${props.className} pr-12`}
              type={ver ? 'text' : 'password'}
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              onBlur={() => setTocado((t) => ({ ...t, contrasena: true }))}
              autoComplete="current-password"
              enterKeyHint="go"
            />
            {/* Ver lo que se tipeó no es un lujo acá: la mitad de las veces entra
                desde el celular con las manos mojadas, y una contraseña mal tipeada
                a ciegas es el motivo número uno por el que alguien abandona. */}
            <button
              type="button"
              onClick={() => setVer((v) => !v)}
              aria-pressed={ver}
              aria-label={ver ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
              className="absolute inset-y-0 right-0 mt-1 grid w-11 place-items-center rounded-r-xl text-tinta-4 transition duration-200 ease-suave hover:text-cloro-tinta"
            >
              {ver ? <OjoTachado className="size-5" /> : <OjoAbierto className="size-5" />}
            </button>
          </div>
        )}
      </Campo>

      <Falla mensaje={error} />

      <Boton variante="primario" type="submit" disabled={enviando} className="mt-5 min-h-12 w-full">
        {espera && <Girando />}
        {espera ? 'Entrando…' : 'Entrar'}
      </Boton>

      <button
        type="button"
        onClick={onRecuperar}
        className="mx-auto mt-4 block min-h-11 px-2 text-sm font-medium text-cloro-tinta transition duration-200 ease-suave hover:text-agua"
      >
        Me olvidé la contraseña
      </button>
    </form>
  )
}

// ── Recuperar ──────────────────────────────────────────────────────────────
// Manda el mail y NO dice si esa dirección existe o no: contestar "ese email no
// está registrado" le confirma a cualquiera cuál es la cuenta válida.

function Recuperar({ onVolver }) {
  const { pedirRecuperacion } = useSesion()
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [mandado, setMandado] = useState(false)
  const espera = useEsperaLarga(enviando)

  const enviar = async (e) => {
    e.preventDefault()
    if (enviando || !email.trim()) return
    setError(null)
    setEnviando(true)
    const falla = await pedirRecuperacion(email)
    setEnviando(false)
    if (falla) setError(falla)
    else setMandado(true)
  }

  if (mandado) {
    return (
      <div>
        <span className="grid size-11 place-items-center rounded-full bg-exito/15 text-exito-tinta">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="size-5">
            <path d="M4.5 10.5l3.4 3.4 7.6-7.8" />
          </svg>
        </span>
        <h2 className="mt-3.5 font-titulo text-xl font-semibold text-tinta">Revisá tu correo</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-tinta-2">
          Si <span className="dato">{email.trim()}</span> tiene una cuenta, le llega un link para
          poner una contraseña nueva. Puede tardar un par de minutos.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-tinta-3">
          Si no aparece, mirá en el correo no deseado.
        </p>
        <Boton variante="secundario" onClick={onVolver} className="mt-5 w-full">
          Volver
        </Boton>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} noValidate>
      <h2 className="font-titulo text-xl font-semibold text-tinta">Recuperar la contraseña</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-tinta-3">
        Poné tu email y te mandamos un link para elegir una nueva.
      </p>

      <Campo etiqueta="Email" className="mt-6">
        {(props) => (
          <input
            {...props}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            placeholder="nombre@correo.com"
          />
        )}
      </Campo>

      <Falla mensaje={error} />

      <Boton variante="primario" type="submit" disabled={enviando || !email.trim()} className="mt-5 min-h-12 w-full">
        {espera && <Girando />}
        {espera ? 'Mandando…' : 'Mandarme el link'}
      </Boton>
      <Boton variante="fantasma" onClick={onVolver} className="mt-2 w-full">
        Volver
      </Boton>
    </form>
  )
}

// ── Contraseña nueva ───────────────────────────────────────────────────────
// Se llega acá desde el link del mail. Supabase deja una sesión de un solo uso, así
// que técnicamente ya está adentro — pero lo único que corresponde mostrar es esto.

function NuevaContrasena() {
  const { cambiarContrasena } = useSesion()
  const [contrasena, setContrasena] = useState('')
  const [ver, setVer] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [tocado, setTocado] = useState(false)
  const espera = useEsperaLarga(enviando)

  const corta = tocado && contrasena.length > 0 && contrasena.length < 6

  const enviar = async (e) => {
    e.preventDefault()
    if (enviando || contrasena.length < 6) return
    setError(null)
    setEnviando(true)
    const falla = await cambiarContrasena(contrasena)
    setEnviando(false)
    if (falla) setError(falla)
  }

  return (
    <form onSubmit={enviar} noValidate>
      <h2 className="font-titulo text-xl font-semibold text-tinta">Elegí una contraseña nueva</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-tinta-3">
        Con esta vas a entrar de ahora en más.
      </p>

      <Campo
        etiqueta="Contraseña nueva"
        ayuda="Al menos 6 caracteres."
        error={corta ? 'Todavía es demasiado corta.' : undefined}
        className="mt-6"
      >
        {(props) => (
          <div className="relative">
            <input
              {...props}
              className={`${props.className} pr-12`}
              type={ver ? 'text' : 'password'}
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              onBlur={() => setTocado(true)}
              autoComplete="new-password"
              enterKeyHint="go"
            />
            <button
              type="button"
              onClick={() => setVer((v) => !v)}
              aria-pressed={ver}
              aria-label={ver ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
              className="absolute inset-y-0 right-0 mt-1 grid w-11 place-items-center rounded-r-xl text-tinta-4 transition duration-200 ease-suave hover:text-cloro-tinta"
            >
              {ver ? <OjoTachado className="size-5" /> : <OjoAbierto className="size-5" />}
            </button>
          </div>
        )}
      </Campo>

      <Falla mensaje={error} />

      <Boton
        variante="primario"
        type="submit"
        disabled={enviando || contrasena.length < 6}
        className="mt-5 min-h-12 w-full"
      >
        {espera && <Girando />}
        {espera ? 'Guardando…' : 'Guardar y entrar'}
      </Boton>
    </form>
  )
}

export default function Login() {
  const { recuperando } = useSesion()
  const [modo, setModo] = useState('entrar')

  return (
    <PantallaAgua>
      {recuperando ? (
        <NuevaContrasena />
      ) : modo === 'entrar' ? (
        <Entrar onRecuperar={() => setModo('recuperar')} />
      ) : (
        <Recuperar onVolver={() => setModo('entrar')} />
      )}
    </PantallaAgua>
  )
}
