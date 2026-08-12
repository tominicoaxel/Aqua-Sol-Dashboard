// Genera capturas HTML estáticas de cada pantalla, autocontenidas: el CSS va
// embebido y las fuentes se piden a Google. Cada archivo se abre solo en el
// navegador y se ve igual que la app.
//
// Para qué: poder mostrar el diseño a otra herramienta (o a otra persona) sin tener
// que levantar el proyecto. OJO: son una FOTO. Nada de lo que se cambie acá vuelve
// solo a la app — hay que trasladarlo a los componentes de src/components/.

import { createServer } from 'vite'
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'

const PANTALLAS = [
  { archivo: 'inicio', titulo: 'Inicio — resumen general', props: { vistaInicial: 'inicio' } },
  { archivo: 'clientes', titulo: 'Panel de clientes', props: { vistaInicial: 'clientes' } },
  { archivo: 'horarios', titulo: 'Panel de horarios', props: { vistaInicial: 'horarios' } },
  {
    archivo: 'ficha-cliente',
    titulo: 'Ficha de cliente',
    props: { vistaInicial: 'clientes', clienteInicial: 3 },
  },
  {
    archivo: 'detalle-clase',
    titulo: 'Detalle de una clase',
    props: { vistaInicial: 'horarios', claseInicial: 'mar-0900' },
  },
]

const css = (() => {
  const assets = readdirSync('dist/assets').filter((f) => f.endsWith('.css'))
  if (!assets.length) throw new Error('No hay CSS en dist/. Corré `npm run build` primero.')
  return readFileSync(`dist/assets/${assets[0]}`, 'utf8')
})()

const pagina = (titulo, cuerpo) => `<!doctype html>
<html lang="es-AR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0B4F6C" />
    <title>${titulo} — Pileta</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@500;600;700&display=swap"
      rel="stylesheet"
    />
    <style>
${css}
    </style>
  </head>
  <body>
${cuerpo}
  </body>
</html>
`

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })

try {
  mkdirSync('snapshot', { recursive: true })
  const { renderPantalla } = await vite.ssrLoadModule('/snapshot/render.jsx')

  for (const { archivo, titulo, props } of PANTALLAS) {
    const html = pagina(titulo, renderPantalla(props))
    writeFileSync(`snapshot/${archivo}.html`, html, 'utf8')
    console.log(`  ${archivo}.html`.padEnd(28) + `${(html.length / 1024).toFixed(0)} kB — ${titulo}`)
  }
  console.log('\nListo. Abrí cualquiera con doble clic.')
} catch (e) {
  console.error('FALLÓ:', e.message)
  process.exitCode = 1
} finally {
  await vite.close()
}
