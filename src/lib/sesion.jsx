import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, faltanClaves } from './supabase.js'

// ─── La sesión ──────────────────────────────────────────────────────────────
// Una sola usuaria: la dueña. No hay registro, ni roles, ni invitaciones — el
// usuario se crea a mano desde el panel de Supabase (ver supabase/LEEME.md).
//
// Este contexto vive por FUERA de ProveedorDatos: primero se resuelve quién sos y
// recién después se cargan los datos. Al revés, la app pediría filas antes de tener
// token y RLS le devolvería cero, que se vería igual que una base vacía.

const SesionContext = createContext(null)

// ─── Traducción de errores ──────────────────────────────────────────────────
// Supabase contesta en inglés y con jerga. Un "Invalid login credentials" en el
// medio de la pantalla no le dice nada a alguien que solo quiere entrar a ver quién
// le debe. Cada mensaje lleva las dos cosas que hacen falta para salir del paso:
// qué pasó y qué hacer.

const TRADUCCIONES = [
  {
    coincide: /invalid login credentials/i,
    texto: 'El email o la contraseña no coinciden.',
    ayuda: 'Fijate que no haya quedado activado el bloqueo de mayúsculas.',
  },
  {
    coincide: /email not confirmed/i,
    texto: 'Esa cuenta todavía no está confirmada.',
    ayuda: 'Hay que confirmarla desde el panel de Supabase, en Authentication → Users.',
  },
  {
    coincide: /signups? not allowed|signup is disabled/i,
    texto: 'El registro está cerrado.',
    ayuda: 'Las cuentas se crean a mano desde el panel de Supabase.',
  },
  {
    coincide: /too many requests|for security purposes|rate limit/i,
    texto: 'Demasiados intentos seguidos.',
    ayuda: 'Esperá un minuto y probá otra vez.',
  },
  {
    coincide: /failed to fetch|network|networkerror|load failed/i,
    texto: 'No se pudo llegar al servidor.',
    ayuda: 'Revisá la señal y probá de nuevo.',
  },
  {
    coincide: /should be at least|password.*(short|6|8)/i,
    texto: 'La contraseña es demasiado corta.',
    ayuda: 'Tiene que tener al menos 6 caracteres.',
  },
  {
    coincide: /same.*password|different from the old/i,
    texto: 'Esa es la contraseña que ya tenías.',
    ayuda: 'Elegí una distinta.',
  },
]

/** Devuelve { texto, ayuda } listo para mostrar. Nunca devuelve el error crudo:
 *  si no lo reconoce, dice que no lo reconoce en vez de escupir jerga. */
export function mensajeDeError(error) {
  if (!error) return null
  const crudo = String(error.message ?? error)
  const conocido = TRADUCCIONES.find((t) => t.coincide.test(crudo))
  if (conocido) return { texto: conocido.texto, ayuda: conocido.ayuda }
  return {
    texto: 'No se pudo completar la operación.',
    ayuda: `Probá de nuevo. Si sigue, el detalle es: ${crudo}`,
  }
}

export function ProveedorSesion({ children }) {
  const [sesion, setSesion] = useState(null)
  // Arranca en `true`: hasta no saber si hay sesión guardada no se muestra ni el
  // login ni la app. Mostrar el login mientras se resuelve haría que, cada vez que
  // abre el teléfono, viera un parpadeo de "iniciá sesión" antes de entrar sola.
  const [cargando, setCargando] = useState(!faltanClaves)
  // El link del mail de recuperación vuelve a la app con un token de un solo uso.
  // Mientras dure ese estado hay sesión, pero lo único que corresponde mostrar es
  // el formulario de contraseña nueva.
  const [recuperando, setRecuperando] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let vivo = true

    supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return
      setSesion(data?.session ?? null)
      setCargando(false)
    })

    const { data } = supabase.auth.onAuthStateChange((evento, nueva) => {
      if (!vivo) return
      setSesion(nueva ?? null)
      setCargando(false)
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true)
      if (evento === 'SIGNED_OUT') setRecuperando(false)
    })

    return () => {
      vivo = false
      data.subscription.unsubscribe()
    }
  }, [])

  const entrar = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    return error ? mensajeDeError(error) : null
  }, [])

  const salir = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const pedirRecuperacion = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      // Vuelve a la misma app: no hay más pantallas que ésta.
      redirectTo: window.location.origin,
    })
    return error ? mensajeDeError(error) : null
  }, [])

  const cambiarContrasena = useCallback(async (nueva) => {
    const { error } = await supabase.auth.updateUser({ password: nueva })
    if (error) return mensajeDeError(error)
    setRecuperando(false)
    return null
  }, [])

  const valor = useMemo(
    () => ({
      sesion,
      usuario: sesion?.user ?? null,
      email: sesion?.user?.email ?? '',
      cargando,
      recuperando,
      faltanClaves,
      entrar,
      salir,
      pedirRecuperacion,
      cambiarContrasena,
    }),
    [sesion, cargando, recuperando, entrar, salir, pedirRecuperacion, cambiarContrasena],
  )

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>
}

export function useSesion() {
  const valor = useContext(SesionContext)
  if (!valor) throw new Error('useSesion() necesita estar dentro de <ProveedorSesion>')
  return valor
}
