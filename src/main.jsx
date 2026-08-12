import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Puerta from './components/Puerta.jsx'
import { ProveedorSesion } from './lib/sesion.jsx'
import { ProveedorDatos } from './lib/store.jsx'
import './index.css'

// El orden importa: sesión → puerta → datos. ProveedorDatos queda adentro de la
// Puerta para que no se monte (ni pida nada) hasta que haya sesión resuelta.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ProveedorSesion>
      <Puerta>
        <ProveedorDatos>
          <App />
        </ProveedorDatos>
      </Puerta>
    </ProveedorSesion>
  </React.StrictMode>,
)
