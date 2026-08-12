import { Suspense, lazy, useState } from 'react'
import ResumenGeneral from './components/ResumenGeneral.jsx'
import ClientesPanel from './components/ClientesPanel.jsx'
import ClienteFicha from './components/ClienteFicha.jsx'
import HorariosPanel from './components/HorariosPanel.jsx'
import ClaseDetalle from './components/ClaseDetalle.jsx'
import LineasDeCarril from './components/LineasDeCarril.jsx'
import Aviso from './components/Aviso.jsx'
import { BloqueCuenta, SalirCompacto } from './components/Cuenta.jsx'
import { Cargando, ErrorDeCarga, PrimerArranque } from './components/Arranque.jsx'
// SheetJS pesa medio mega. Se carga recién cuando ella abre el importador, y no en
// el arranque: la pantalla de Inicio no tiene por qué esperar a una biblioteca de
// planillas que capaz no usa en toda la sesión.
const ImportadorClientes = lazy(() => import('./components/ImportadorClientes.jsx'))
import { useDatos } from './lib/store.jsx'

const IconoInicio = (p) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M3 8.6l7-5.4 7 5.4v7.6a1.4 1.4 0 01-1.4 1.4H4.4A1.4 1.4 0 013 16.2z" />
    <path d="M7.8 17.6v-6h4.4v6" />
  </svg>
)
const IconoClientes = (p) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="7.5" cy="6.5" r="2.8" />
    <path d="M2.5 16.5c0-2.8 2.2-4.6 5-4.6s5 1.8 5 4.6" />
    <path d="M13.5 4.2a2.8 2.8 0 010 5.2M15 11.8c1.7.5 2.8 1.9 2.8 4" />
  </svg>
)
const IconoHorarios = (p) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="2.6" y="4" width="14.8" height="13.4" rx="2.6" />
    <path d="M2.6 8.2h14.8M6.6 2.6v2.8M13.4 2.6v2.8" />
  </svg>
)

const VISTAS = [
  { id: 'inicio', etiqueta: 'Inicio', Icono: IconoInicio },
  { id: 'clientes', etiqueta: 'Clientes', Icono: IconoClientes },
  { id: 'horarios', etiqueta: 'Horarios', Icono: IconoHorarios },
]

function Marca({ className = '' }) {
  return (
    <div className={className}>
      <p className="font-titulo text-lg leading-none font-bold tracking-[0.22em] text-white">PILETA</p>
      <p className="mt-1 text-[11px] tracking-wide text-cloro">Panel de gestión</p>
    </div>
  )
}

// Las tres props son opcionales y solo existen para poder generar capturas HTML
// estáticas de cada pantalla (ver snapshot/generar.mjs). En uso normal no se pasan
// y la app arranca como siempre: en Inicio, sin nada abierto.
export default function App({ vistaInicial = 'inicio', clienteInicial = null, claseInicial = null }) {
  const [vista, setVista] = useState(vistaInicial)
  const [filtroClientes, setFiltroClientes] = useState('todos')
  // Se guardan los IDs y no los objetos: después de editar, el objeto que había en
  // el estado quedaría viejo y la hoja abierta seguiría mostrando el dato anterior.
  // Con el ID, cada render vuelve a buscar la versión actual en el store.
  const [clienteAbierto, setClienteAbierto] = useState(clienteInicial)
  const [claseAbierta, setClaseAbierta] = useState(claseInicial)
  const [importando, setImportando] = useState(false)
  const { cargando, errorCarga, vacio } = useDatos()

  // Solo un panel de detalle a la vez: abrir uno cierra el otro. Eso es lo que
  // permite saltar de una clase a la ficha de un participante y de vuelta.
  const abrirCliente = (c) => {
    setClaseAbierta(null)
    setClienteAbierto(c.id)
  }
  const abrirClase = (h) => {
    setClienteAbierto(null)
    setClaseAbierta(h.id)
  }

  const irAClientes = (filtro = 'todos') => {
    setFiltroClientes(filtro)
    setVista('clientes')
  }

  return (
    <div className="min-h-dvh lg:flex">
      {/* Invisible hasta que se la enfoca con el teclado. Sin esto, moverse por la
          app con Tab obliga a pasar por toda la navegación en cada pantalla. */}
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-agua focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-white"
      >
        Saltar al contenido
      </a>

      {/* ── Navegación desktop ─────────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-agua lg:flex">
        <div className="px-6 pt-7">
          <Marca />
          {/* El motivo de carriles vive acá y en ningún otro lado */}
          <LineasDeCarril className="mt-5" />
        </div>

        <nav className="mt-7 flex-1 px-3" aria-label="Secciones">
          <ul className="space-y-1">
            {VISTAS.map(({ id, etiqueta, Icono }) => {
              const activo = vista === id
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => (id === 'clientes' ? irAClientes('todos') : setVista(id))}
                    aria-current={activo ? 'page' : undefined}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
                      activo ? 'bg-white/12 text-white' : 'text-white/65 hover:bg-white/6 hover:text-white'
                    }`}
                  >
                    <Icono className={`size-5 shrink-0 ${activo ? 'text-cloro' : ''}`} />
                    {etiqueta}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <BloqueCuenta />
      </aside>

      {/* ── Cabecera de marca en celular ───────────────────────────────── */}
      <header className="bg-agua px-5 pt-5 pb-4 lg:hidden">
        <div className="flex items-start justify-between gap-4">
          <Marca />
          <SalirCompacto />
        </div>
        <LineasDeCarril className="mt-4" />
      </header>

      {/* ── Contenido ──────────────────────────────────────────────────── */}
      <main
        id="contenido"
        className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-14"
      >
        {/* Antes de las vistas, los tres estados que trajo tener una base atrás:
            todavía no llegó · no pudo llegar · llegó vacía. */}
        {cargando ? (
          <Cargando />
        ) : errorCarga ? (
          <ErrorDeCarga />
        ) : vacio ? (
          <PrimerArranque onImportar={() => setImportando(true)} />
        ) : (
          <>
            {vista === 'inicio' && (
              <ResumenGeneral
                onIrAClientes={irAClientes}
                onIrAHorarios={() => setVista('horarios')}
                onAbrirClase={abrirClase}
              />
            )}
            {vista === 'clientes' && (
              <ClientesPanel
                filtro={filtroClientes}
                onFiltro={setFiltroClientes}
                onAbrirCliente={abrirCliente}
                onImportar={() => setImportando(true)}
              />
            )}
            {vista === 'horarios' && <HorariosPanel onAbrirClase={abrirClase} />}
          </>
        )}
      </main>

      {/* ── Navegación celular ─────────────────────────────────────────── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-white/95 backdrop-blur-sm lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Secciones"
      >
        <ul className="flex">
          {VISTAS.map(({ id, etiqueta, Icono }) => {
            const activo = vista === id
            return (
              <li key={id} className="flex-1">
                <button
                  type="button"
                  onClick={() => (id === 'clientes' ? irAClientes('todos') : setVista(id))}
                  aria-current={activo ? 'page' : undefined}
                  className={`relative flex min-h-11 w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${
                    activo ? 'text-agua' : 'text-tinta-4'
                  }`}
                >
                  {activo && (
                    <span className="absolute inset-x-0 top-0 mx-auto h-0.5 w-8 rounded-full bg-cloro" aria-hidden="true" />
                  )}
                  <Icono className="size-5" />
                  {etiqueta}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <ClienteFicha
        clienteId={clienteAbierto}
        onCerrar={() => setClienteAbierto(null)}
        onAbrirClase={abrirClase}
      />
      <ClaseDetalle
        claseId={claseAbierta}
        onCerrar={() => setClaseAbierta(null)}
        onAbrirCliente={abrirCliente}
      />
      {importando && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-40 grid place-items-center bg-profundidad/50" role="status" aria-live="polite">
              <div className="flex items-center gap-3 rounded-2xl bg-espuma px-5 py-4 shadow-xl">
                <span className="size-5 animate-spin rounded-full border-2 border-borde border-t-cloro-tinta" aria-hidden="true" />
                <p className="text-sm text-tinta-2">Abriendo el importador…</p>
              </div>
            </div>
          }
        >
          <ImportadorClientes
            abierto
            onCerrar={() => setImportando(false)}
            onVerClientes={() => {
              setImportando(false)
              irAClientes('todos')
            }}
          />
        </Suspense>
      )}
      <Aviso />
    </div>
  )
}
