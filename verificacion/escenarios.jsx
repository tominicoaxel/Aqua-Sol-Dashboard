import { renderToStaticMarkup } from 'react-dom/server'
import App from '../src/App.jsx'
import ClienteFicha from '../src/components/ClienteFicha.jsx'
import ClaseDetalle from '../src/components/ClaseDetalle.jsx'
import ImportadorClientes from '../src/components/ImportadorClientes.jsx'
import Login from '../src/components/Login.jsx'
import DocentesPanel from '../src/components/DocentesPanel.jsx'
import ListaEsperaPanel from '../src/components/ListaEsperaPanel.jsx'
import { ProveedorSesion, mensajeDeError } from '../src/lib/sesion.jsx'
import { datosDeEjemplo } from './semilla/index.js'
import {
  ProveedorDatos,
  conPagoRegistrado,
  conPagoEditado,
  conFechasEditadas,
  conParticipanteAgregado,
  conParticipanteSacado,
  conClaseCreada,
  conClaseEditada,
  conClaseEliminada,
  conClientesReemplazados,
  conClienteEliminado,
  conAsistenciaMarcada,
  conDocenteCreado,
  conDocenteEditado,
  conDocenteEliminado,
  conDocenteEnClase,
  conDocenteDelDiaMarcado,
  conPersonaEnEsperaCreada,
  conPersonaEnEsperaEditada,
  conPersonaEnEsperaEliminada,
  vencimientoPara,
  isoDeHoy,
} from '../src/lib/store.jsx'
import { cobradoDelMes, descripcionPago, CUENTAS } from '../src/lib/pagos.js'
import { aISO, ocurrenciaMasReciente } from '../src/lib/fechas.js'
import { derivarClientes, derivarHorarios, horariosDeCliente } from '../src/lib/datos.js'
import { grupoEdadEspera } from '../src/lib/edades.js'

const nada = () => {}

// La app entera vive detrás de la sesión, así que hasta para renderizarla en una
// verificación hace falta el proveedor. Los efectos no corren en SSR: nada sale a
// la red desde acá.
const conProveedor = (nodo, datos = datosDeEjemplo()) =>
  renderToStaticMarkup(
    <ProveedorSesion>
      <ProveedorDatos datosIniciales={datos}>{nodo}</ProveedorDatos>
    </ProveedorSesion>,
  )

export function render() {
  const salida = {
    app: conProveedor(<App />).length,
    importador: conProveedor(<ImportadorClientes abierto onCerrar={nada} onVerClientes={nada} />).length,
    login: renderToStaticMarkup(
      <ProveedorSesion>
        <Login />
      </ProveedorSesion>,
    ).length,
    fichas: 0,
    clases: 0,
    docentes: conProveedor(<DocentesPanel onAbrirClase={nada} />).length,
    espera: conProveedor(<ListaEsperaPanel onAbrirClase={nada} />).length,
  }
  const { clientes, horarios } = derivar(datosDeEjemplo())
  for (const c of clientes) {
    salida.fichas += conProveedor(
      <ClienteFicha clienteId={c.id} onCerrar={nada} onAbrirClase={nada} />,
    ).length
  }
  for (const h of horarios) {
    salida.clases += conProveedor(
      <ClaseDetalle claseId={h.id} onCerrar={nada} onAbrirCliente={nada} />,
    ).length
  }
  return salida
}

/** El HTML crudo del login, para poder chequear lo que TIENE que estar y —sobre
 *  todo— lo que no: no hay pantalla de registro. */
export function renderLogin() {
  return renderToStaticMarkup(
    <ProveedorSesion>
      <Login />
    </ProveedorSesion>,
  )
}

export function renderDocentes() {
  return conProveedor(<DocentesPanel onAbrirClase={nada} />)
}

export function derivar(crudos) {
  const clientes = derivarClientes(crudos.clientes)
  const porId = new Map(clientes.map((c) => [c.id, c]))
  const docentesPorId = new Map((crudos.docentes ?? []).map((d) => [d.id, d]))
  return { clientes, horarios: derivarHorarios(crudos.horarios, porId, docentesPorId), porId }
}

export {
  mensajeDeError,
  datosDeEjemplo,
  conPagoRegistrado,
  conPagoEditado,
  conFechasEditadas,
  conParticipanteAgregado,
  conParticipanteSacado,
  conClaseCreada,
  conClaseEditada,
  conClaseEliminada,
  conClientesReemplazados,
  conClienteEliminado,
  conAsistenciaMarcada,
  conDocenteCreado,
  conDocenteEditado,
  conDocenteEliminado,
  conDocenteEnClase,
  conDocenteDelDiaMarcado,
  conPersonaEnEsperaCreada,
  conPersonaEnEsperaEditada,
  conPersonaEnEsperaEliminada,
  horariosDeCliente,
  vencimientoPara,
  isoDeHoy,
  cobradoDelMes,
  descripcionPago,
  CUENTAS,
  aISO,
  ocurrenciaMasReciente,
  grupoEdadEspera,
}
