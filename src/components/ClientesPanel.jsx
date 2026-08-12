import { useMemo, useState } from 'react'
import { ESTADOS, ORDEN_ESTADOS } from '../lib/estados.js'
import { conteoPorEstado, ordenarPorUrgencia } from '../lib/datos.js'
import { useDatos } from '../lib/store.jsx'
import { formatoFecha, textoVencimiento, textoAntiguedad } from '../lib/fechas.js'
import Boton from './Boton.jsx'
import EstadoChip from './EstadoChip.jsx'

/** Sin acentos y en minúscula: buscar "sofia" tiene que encontrar a "Sofía". */
const normalizar = (t) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const FILTROS = [
  { id: 'todos', etiqueta: 'Todos' },
  ...ORDEN_ESTADOS.map((id) => ({ id, etiqueta: ESTADOS[id].titulo })),
]

function VenceCelda({ cliente }) {
  const e = ESTADOS[cliente.estado]
  return (
    <>
      <span className="dato text-sm text-tinta">{formatoFecha(cliente.vence)}</span>
      <span className={`block text-xs ${cliente.estado === 'al-dia' ? 'text-tinta-3' : e.texto}`}>
        {textoVencimiento(cliente.diasParaVencer)}
      </span>
    </>
  )
}

export default function ClientesPanel({ filtro, onFiltro, onAbrirCliente, onImportar }) {
  const { clientes } = useDatos()
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState('urgencia')
  const conteo = useMemo(() => conteoPorEstado(clientes), [clientes])

  const lista = useMemo(() => {
    const q = normalizar(busqueda.trim())
    const filtrados = clientes.filter(
      (c) =>
        (filtro === 'todos' || c.estado === filtro) &&
        (q === '' || normalizar(c.nombre).includes(q) || normalizar(c.plan).includes(q)),
    )
    return orden === 'urgencia'
      ? ordenarPorUrgencia(filtrados)
      : [...filtrados].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [clientes, busqueda, filtro, orden])

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-tinta sm:text-3xl">Clientes</h1>
          <p className="mt-1 text-sm text-tinta-3">
            <span className="dato">{clientes.length}</span> personas activas. Tocá una para ver la ficha.
          </p>
        </div>
        <Boton variante="primario" onClick={onImportar}>
          <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 10.5V2M8 2L5 5M8 2l3 3M2.5 11v1.5A1.5 1.5 0 004 14h8a1.5 1.5 0 001.5-1.5V11" />
          </svg>
          Importar desde Excel
        </Boton>
      </header>

      {/* Buscador y filtros en una sola fila arriba de la lista */}
      <div className="space-y-3">
        <div className="relative">
          <svg viewBox="0 0 20 20" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-tinta-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="8.8" cy="8.8" r="5.3" />
            <path d="M12.8 12.8l4 4" />
          </svg>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o plan…"
            aria-label="Buscar cliente"
            className="w-full rounded-xl border border-borde bg-white py-2.5 pr-3 pl-10 text-sm text-tinta placeholder:text-tinta-4 focus:border-cloro focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {FILTROS.map((f) => {
            const activo = filtro === f.id
            const cantidad = f.id === 'todos' ? clientes.length : conteo[f.id]
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onFiltro(f.id)}
                aria-pressed={activo}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  activo
                    ? 'border-agua bg-agua text-white'
                    : 'border-borde bg-white text-tinta-2 hover:border-cloro/60 hover:text-tinta'
                }`}
              >
                {f.id !== 'todos' && (
                  <span
                    className={`size-1.5 rounded-full ${activo ? 'bg-white/80' : ESTADOS[f.id].punto}`}
                    aria-hidden="true"
                  />
                )}
                {f.etiqueta}
                <span className={`dato ${activo ? 'text-white/70' : 'text-tinta-4'}`}>{cantidad}</span>
              </button>
            )
          })}

          <div className="ml-auto flex items-center gap-1 text-xs text-tinta-3">
            <span className="hidden sm:inline">Ordenar:</span>
            {[
              { id: 'urgencia', etiqueta: 'Urgencia' },
              { id: 'nombre', etiqueta: 'Nombre' },
            ].map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setOrden(o.id)}
                aria-pressed={orden === o.id}
                className={`rounded-full px-2.5 py-1 font-medium transition ${
                  orden === o.id ? 'bg-cloro/15 text-cloro-tinta' : 'text-tinta-3 hover:text-tinta'
                }`}
              >
                {o.etiqueta}
              </button>
            ))}
          </div>
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-borde bg-white/60 p-10 text-center">
          <p className="font-titulo text-base font-semibold text-tinta">Sin resultados</p>
          <p className="mt-1 text-sm text-tinta-3">
            No hay clientes que coincidan con la búsqueda y el filtro elegidos.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: tabla. Las fechas y la antigüedad van en mono para que las
              columnas se lean de arriba abajo sin tener que leer cada fila. */}
          <div className="hidden overflow-hidden rounded-2xl border border-borde bg-white md:block">
            <table className="w-full text-left">
              <caption className="sr-only">
                Clientes con su estado de pago, fechas y antigüedad
              </caption>
              <thead>
                <tr className="border-b border-borde bg-espuma/70 text-xs tracking-wide text-tinta-3 uppercase">
                  <th scope="col" className="px-5 py-3 font-medium">Nombre</th>
                  <th scope="col" className="px-4 py-3 font-medium">Estado</th>
                  <th scope="col" className="px-4 py-3 font-medium">Último pago</th>
                  <th scope="col" className="px-4 py-3 font-medium">Vence</th>
                  <th scope="col" className="px-4 py-3 font-medium">Cliente hace</th>
                  <th scope="col" className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-borde-suave">
                {lista.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => onAbrirCliente(c)}
                    className="group cursor-pointer transition hover:bg-cloro/8"
                  >
                    <th scope="row" className="px-5 py-3 text-left font-normal">
                      <span className="block text-sm font-medium text-tinta">{c.nombre}</span>
                      <span className="block text-xs text-tinta-3">{c.plan}</span>
                    </th>
                    <td className="px-4 py-3">
                      <EstadoChip estado={c.estado} chico />
                    </td>
                    <td className="dato px-4 py-3 text-sm text-tinta-2">{formatoFecha(c.pago)}</td>
                    <td className="px-4 py-3">
                      <VenceCelda cliente={c} />
                    </td>
                    <td className="dato px-4 py-3 text-sm text-tinta-2">{textoAntiguedad(c.antiguedadDias)}</td>
                    <td className="px-4 py-3 text-right">
                      <svg viewBox="0 0 16 16" className="inline size-4 text-tinta-4 transition group-hover:translate-x-0.5 group-hover:text-cloro-tinta" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 3l5 5-5 5" />
                      </svg>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular: la misma información como lista de tarjetas */}
          <ul className="space-y-2 md:hidden">
            {lista.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onAbrirCliente(c)}
                  className="w-full rounded-2xl border border-borde bg-white p-4 text-left transition active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-tinta">{c.nombre}</p>
                      <p className="truncate text-xs text-tinta-3">{c.plan}</p>
                    </div>
                    <EstadoChip estado={c.estado} chico />
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-borde-suave pt-3">
                    <div>
                      <dt className="text-[11px] text-tinta-3">Último pago</dt>
                      <dd className="dato text-xs text-tinta-2">{formatoFecha(c.pago)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-tinta-3">Vence</dt>
                      <dd className="dato text-xs text-tinta-2">{formatoFecha(c.vence)}</dd>
                      <dd className={`text-[11px] ${c.estado === 'al-dia' ? 'text-tinta-3' : ESTADOS[c.estado].texto}`}>
                        {textoVencimiento(c.diasParaVencer)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-tinta-3">Cliente hace</dt>
                      <dd className="dato text-xs text-tinta-2">{textoAntiguedad(c.antiguedadDias)}</dd>
                    </div>
                  </dl>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-xs text-tinta-3">
        Mostrando <span className="dato">{lista.length}</span> de{' '}
        <span className="dato">{clientes.length}</span> clientes.
      </p>
    </div>
  )
}
