import { renderToStaticMarkup } from 'react-dom/server'
import App from '../src/App.jsx'
import { ProveedorDatos } from '../src/lib/store.jsx'

export function renderPantalla(props) {
  return renderToStaticMarkup(
    <ProveedorDatos>
      <App {...props} />
    </ProveedorDatos>,
  )
}
