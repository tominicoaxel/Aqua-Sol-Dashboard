// ─── Lectura de .env.local para los scripts de verificación ─────────────────
// Vite ya lee `.env.local` solo, pero los scripts de verificación corren en Node
// pelado. Es un parser mínimo a propósito: no vale sumar una dependencia para
// leer siete líneas de KEY=valor.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')

function leerArchivo(nombre) {
  let texto
  try {
    texto = readFileSync(join(raiz, nombre), 'utf8')
  } catch {
    return {}
  }
  const vars = {}
  for (const linea of texto.split(/\r?\n/)) {
    const limpia = linea.trim()
    if (!limpia || limpia.startsWith('#')) continue
    const corte = limpia.indexOf('=')
    if (corte < 1) continue
    const clave = limpia.slice(0, corte).trim()
    let valor = limpia.slice(corte + 1).trim()
    // Comillas opcionales alrededor del valor
    if (valor.length > 1 && ((valor[0] === '"' && valor.at(-1) === '"') || (valor[0] === "'" && valor.at(-1) === "'"))) {
      valor = valor.slice(1, -1)
    }
    vars[clave] = valor
  }
  return vars
}

// El entorno real gana sobre el archivo: así se puede pisar una variable sin
// editar nada (útil en CI y para probar contra otro proyecto).
const delArchivo = { ...leerArchivo('.env.local'), ...leerArchivo('.env') }

export const entorno = { ...delArchivo, ...process.env }

export const credencialesSupabase = () => ({
  url: entorno.VITE_SUPABASE_URL || '',
  anon: entorno.VITE_SUPABASE_ANON_KEY || '',
  email: entorno.SUPABASE_EMAIL_PRUEBA || '',
  password: entorno.SUPABASE_PASSWORD_PRUEBA || '',
})

export const hayCredenciales = () => {
  const c = credencialesSupabase()
  return Boolean(c.url && c.anon)
}

export const haySesionDePrueba = () => {
  const c = credencialesSupabase()
  return Boolean(c.url && c.anon && c.email && c.password)
}
