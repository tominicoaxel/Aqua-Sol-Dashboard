import { ESTADOS, ORDEN_ESTADOS } from '../lib/estados.js'
import { conteoPorEstado, horariosDelDia, resumenDelDia } from '../lib/datos.js'
import { useDatos } from '../lib/store.jsx'
import { hoy, diaDeHoy, nombreDia, formatoFechaLarga, formatoMonto } from '../lib/fechas.js'
import { CUENTAS, TITULARES, cobradoDelMes } from '../lib/pagos.js'
import BarraCupo from './BarraCupo.jsx'

const conAlfa = (hex, alfa) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`
}

const Flecha = ({ className = '' }) => (
  <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3l5 5-5 5" />
  </svg>
)

/** Tarjeta de estado. El número manda; abajo, el nivel de agua es la proporción
 *  sobre el total de clientes — no es adorno, es el mismo dato del epígrafe pero
 *  dibujado. Toda la tarjeta es un botón y lleva a Clientes ya filtrado por ese
 *  estado, que es exactamente lo que uno quiere hacer después de mirar el número. */
function TarjetaEstado({ estadoId, cantidad, total, onIr }) {
  const e = ESTADOS[estadoId]
  const pct = total > 0 ? Math.round((cantidad / total) * 100) : 0
  const agua = conAlfa(e.hex, 0.14)

  return (
    <button
      type="button"
      onClick={() => onIr(estadoId)}
      className="group relative flex h-40 w-full flex-col items-start justify-between overflow-hidden rounded-2xl border border-borde bg-white p-4 text-left transition duration-300 ease-suave hover:-translate-y-0.5 hover:border-cloro/50 hover:shadow-agua-lg"
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: `${pct}%` }} aria-hidden="true">
        <svg viewBox="0 0 120 10" preserveAspectRatio="none" className="absolute -top-[9px] left-0 h-[10px] w-full">
          <path d="M0 7 Q 15 1 30 7 T 60 7 T 90 7 T 120 7 V10 H0 Z" fill={agua} />
        </svg>
        <div className="h-full w-full" style={{ background: agua }} />
      </div>

      <div className="relative">
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${e.punto}`} aria-hidden="true" />
          <span className="font-titulo text-sm font-semibold text-tinta">{e.titulo}</span>
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-tinta-3">{e.descripcion}</p>
      </div>

      <div className="relative w-full">
        <div className="flex items-baseline gap-1.5">
          <span className={`dato text-5xl leading-none font-bold ${e.texto}`}>{cantidad}</span>
          <span className="dato text-sm text-tinta-3">/{total}</span>
        </div>
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-tinta-3">
          <span className="dato">{pct}%</span> de los clientes
          <Flecha className="ml-auto size-3.5 text-tinta-4 transition group-hover:translate-x-0.5 group-hover:text-cloro-tinta" />
        </p>
      </div>
    </button>
  )
}

function AccesoDirecto({ titulo, detalle, onClick, icono }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3.5 rounded-2xl border border-borde bg-white p-4 text-left transition duration-300 ease-suave hover:-translate-y-0.5 hover:border-cloro/50 hover:shadow-agua-lg"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-agua/8 text-agua transition duration-300 ease-suave group-hover:bg-cloro/15 group-hover:text-cloro-tinta">
        {icono}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-titulo text-sm font-semibold text-tinta">{titulo}</span>
        <span className="block text-xs text-tinta-3">{detalle}</span>
      </span>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-agua/6 text-tinta-3 transition duration-300 ease-suave group-hover:bg-cloro/15 group-hover:text-cloro-tinta">
        <Flecha className="size-3.5 transition duration-300 ease-suave group-hover:translate-x-px group-hover:-translate-y-px" />
      </span>
    </button>
  )
}

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

/** Lo cobrado en el mes, partido por destino. Es exactamente la cuenta que hoy
 *  hace a mano en el Excel a fin de mes: cuánto le entró a cada uno.
 *
 *  Las barras están en la misma escala (todas contra el total) para que se puedan
 *  comparar de un vistazo, y cada número va escrito además de dibujado. */
function CobrosDelMes() {
  const { clientes } = useDatos()
  const ahora = hoy()
  const cobrado = cobradoDelMes(clientes, ahora)

  const destinos = [
    ...TITULARES.map((t) => ({
      id: t,
      etiqueta: t,
      monto: cobrado.porTitular[t],
      detalle: CUENTAS.filter((c) => c.titular === t && cobrado.porCuenta[c.id] > 0),
      barra: 'bg-cloro',
    })),
    { id: 'efectivo', etiqueta: 'Efectivo', monto: cobrado.efectivo, detalle: [], barra: 'bg-agua' },
    ...(cobrado.otros > 0
      ? [{ id: 'otros', etiqueta: 'Sin detalle', monto: cobrado.otros, detalle: [], barra: 'bg-tinta-4' }]
      : []),
  ]

  return (
    <div className="rounded-2xl border border-borde bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs text-tinta-3">Cobrado en {MESES[ahora.getMonth()]}</p>
          <p className="dato mt-0.5 text-3xl leading-none font-bold text-agua">
            {formatoMonto(cobrado.total)}
          </p>
        </div>
        <p className="text-xs text-tinta-3">
          <span className="dato font-medium text-tinta-2">{cobrado.cantidad}</span>{' '}
          {cobrado.cantidad === 1 ? 'pago registrado' : 'pagos registrados'}
        </p>
      </div>

      {cobrado.total === 0 ? (
        <p className="mt-4 text-sm text-tinta-3">
          Todavía no hay pagos cargados este mes. Al registrar uno desde la ficha de un cliente,
          aparece acá desglosado por dónde entró.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {destinos.map((d) => {
            const pct = cobrado.total > 0 ? (d.monto / cobrado.total) * 100 : 0
            return (
              <li key={d.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-tinta">{d.etiqueta}</span>
                  <span className="dato text-sm font-medium text-tinta-2">{formatoMonto(d.monto)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-borde">
                  <div className={`h-full rounded-full ${d.barra}`} style={{ width: `${pct}%` }} />
                </div>
                {d.detalle.length > 0 && (
                  <p className="mt-1 text-[11px] text-tinta-3">
                    {d.detalle.map((c) => `${c.etiqueta} ${formatoMonto(cobrado.porCuenta[c.id])}`).join(' · ')}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function ResumenGeneral({ onIrAClientes, onIrAHorarios, onAbrirClase }) {
  const { clientes, horarios } = useDatos()
  const dia = diaDeHoy()
  const conteo = conteoPorEstado(clientes)
  const delDia = resumenDelDia(horarios, dia)
  const clasesHoy = horariosDelDia(horarios, dia)
  const pendientes = conteo.vencido + conteo['por-vencer']

  return (
    <div className="space-y-8">
      <header>
        <p className="dato text-xs tracking-wide text-tinta-3 uppercase">
          {nombreDia(dia)} · {formatoFechaLarga(hoy())}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-tinta sm:text-3xl">Resumen general</h1>
        <p className="mt-1.5 text-sm text-tinta-3">
          {pendientes === 0
            ? 'Ningún cliente con la cuota pendiente. Todo en orden.'
            : `${pendientes} ${pendientes === 1 ? 'cliente necesita' : 'clientes necesitan'} atención esta semana.`}
        </p>
      </header>

      <section aria-labelledby="t-pagos">
        <h2 id="t-pagos" className="mb-3 font-titulo text-lg font-semibold text-tinta">
          Estado de pagos
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {ORDEN_ESTADOS.map((id) => (
            <TarjetaEstado key={id} estadoId={id} cantidad={conteo[id]} total={clientes.length} onIr={onIrAClientes} />
          ))}
        </div>
      </section>

      <section aria-labelledby="t-cobros">
        <h2 id="t-cobros" className="mb-3 font-titulo text-lg font-semibold text-tinta">
          Cobros del mes
        </h2>
        <CobrosDelMes />
      </section>

      <section aria-labelledby="t-hoy">
        <h2 id="t-hoy" className="mb-3 font-titulo text-lg font-semibold text-tinta">
          Las clases de hoy
        </h2>
        <div className="overflow-hidden rounded-2xl border border-borde bg-white">
          {delDia.clases === 0 ? (
            <div className="p-8 text-center">
              <p className="font-titulo text-base font-semibold text-tinta">Hoy no hay clases</p>
              <p className="mt-1 text-sm text-tinta-3">El horario semanal va de lunes a sábado.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-x-8 gap-y-4 border-b border-borde-suave p-4 sm:p-5">
                <div>
                  <p className="text-xs text-tinta-3">Clases</p>
                  <p className="dato mt-0.5 text-3xl leading-none font-bold text-agua">{delDia.clases}</p>
                </div>
                <div className="min-w-[11rem] flex-1">
                  <p className="text-xs text-tinta-3">Lugares ocupados</p>
                  <p className="dato mt-0.5 text-3xl leading-none font-bold text-agua">
                    {delDia.ocupados}
                    <span className="text-lg font-medium text-tinta-3">/{delDia.cupo}</span>
                  </p>
                  <BarraCupo ocupados={delDia.ocupados} cupo={delDia.cupo} mostrarNumero={false} className="mt-2.5" />
                </div>
                {delDia.llenas > 0 && (
                  <p className="text-xs text-tinta-3">
                    <span className="dato font-medium text-tinta-2">{delDia.llenas}</span>{' '}
                    {delDia.llenas === 1 ? 'clase completa' : 'clases completas'}
                  </p>
                )}
              </div>
              <ul className="divide-y divide-borde-suave">
                {clasesHoy.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => onAbrirClase(h)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-cloro/8 sm:px-5"
                    >
                      <span className="dato w-12 shrink-0 text-sm font-medium text-agua">{h.hora}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-tinta">{h.actividad}</span>
                        <span className="block truncate text-xs text-tinta-3">{h.profe}</span>
                      </span>
                      <BarraCupo ocupados={h.ocupados} cupo={h.cupo} className="w-24 shrink-0 sm:w-32" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="t-accesos">
        <h2 id="t-accesos" className="mb-3 font-titulo text-lg font-semibold text-tinta">
          Ir a
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <AccesoDirecto
            titulo="Clientes"
            detalle={`${clientes.length} personas · buscar, filtrar y ver la ficha`}
            onClick={() => onIrAClientes('todos')}
            icono={
              <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="7.5" cy="6.5" r="2.8" />
                <path d="M2.5 16.5c0-2.8 2.2-4.6 5-4.6s5 1.8 5 4.6" />
                <path d="M13.5 4.2a2.8 2.8 0 010 5.2M15 11.8c1.7.5 2.8 1.9 2.8 4" />
              </svg>
            }
          />
          <AccesoDirecto
            titulo="Horarios"
            detalle="El horario fijo de la semana, día por día"
            onClick={onIrAHorarios}
            icono={
              <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2.6" y="4" width="14.8" height="13.4" rx="2.6" />
                <path d="M2.6 8.2h14.8M6.6 2.6v2.8M13.4 2.6v2.8" />
              </svg>
            }
          />
        </div>
      </section>
    </div>
  )
}
