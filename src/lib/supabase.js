import { createClient } from '@supabase/supabase-js'

// ─── El cliente de Supabase ─────────────────────────────────────────────────
// La `anon key` viaja al navegador y se ve en el bundle. Es así por diseño: lo que
// protege los datos es RLS, que corre del lado del servidor y no confía en nada de
// lo que mande el cliente. La `service_role` nunca pasa por acá.

const url = import.meta.env.VITE_SUPABASE_URL
const clave = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Sin claves no se puede ni construir el cliente. En vez de reventar con un error
 *  de librería a mitad de pantalla, la Puerta muestra qué falta y cómo arreglarlo. */
export const faltanClaves = !url || !clave

export const supabase = faltanClaves
  ? null
  : createClient(url, clave, {
      auth: {
        // Que no la eche cada vez que cierra el teléfono: la sesión queda en
        // localStorage y el token se renueva solo antes de vencer.
        persistSession: true,
        autoRefreshToken: true,
        // El link de "recuperar contraseña" vuelve con el token en la URL y lo
        // levanta esta opción.
        detectSessionInUrl: true,
        // Sin `flowType: 'pkce'` a propósito: PKCE guarda un verificador en el
        // navegador que pidió el mail, así que el link de recuperación solo
        // funcionaría en ESE dispositivo. Pidiéndolo del teléfono y abriéndolo de
        // la notebook, fallaría. El flujo implícito anda desde cualquier lado.
        storageKey: 'pileta.sesion',
      },
    })
