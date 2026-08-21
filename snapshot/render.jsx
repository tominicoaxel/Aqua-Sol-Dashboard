import { renderToStaticMarkup } from 'react-dom/server'
import App from '../src/App.jsx'
import { ProveedorSesion } from '../src/lib/sesion.jsx'
import { ProveedorDatos } from '../src/lib/store.jsx'
import { datosDeEjemplo } from '../verificacion/semilla/index.js'

// La app entera vive detrás de la sesión y ya no trae datos propios: arranca vacía
// y se puebla desde el importador. Para la foto hacen falta las dos cosas —el
// proveedor de sesión y un padrón—, que es la misma costura que usa la
// verificación para renderizar sin salir a la red. Los efectos no corren en SSR:
// de acá no sale ninguna consulta.
export function renderPantalla(props) {
  return renderToStaticMarkup(
    <ProveedorSesion>
      <ProveedorDatos datosIniciales={datosDeEjemplo()}>
        <App {...props} />
      </ProveedorDatos>
    </ProveedorSesion>,
  )
}
