import { useState } from 'react'
import { horariosDelDia, resumenDelDia } from '../lib/datos.js'
import { useDatos } from '../lib/store.jsx'
import { diaDeHoy, nombreDia, nombreDiaPlural, formatoFechaLarga, hoy, sumarDias } from '../lib/fechas.js'
import BarraCupo from './BarraCupo.jsx'
import Boton from './Boton.jsx'
import FormularioClase from './FormularioClase.jsx'
import { iniciales } from './ClaseDetalle.jsx'

const DIAS = [
  { id: 1, corto: 'Lun' },
  { id: 2, corto: 'Mar' },
  { id: 3, corto: 'Mié' },
  { id: 4, corto: 'Jue' },
  { id: 5, corto: 'Vie' },
  { id: 6, corto: 'Sáb' },
]

/** La próxima vez que cae ese día (hoy mismo, si es hoy). Así la fecha que se
 *  muestra al lado del nombre siempre mira para adelante y nunca aparece un
 *  "lunes 10" cuando hoy ya es martes 11. */
function fechaDelDia(dia) {
  const h = hoy()
  return sumarDias(h, (dia - h.getDay() + 7) % 7)
}

function TarjetaClase({ clase, onAbrir }) {
  const libres = clase.cupo - clase.ocupados

  return (
    <li>
      <button
        type="button"
        onClick={() => onAbrir(clase)}
        className="group flex w-full items-stretch gap-4 rounded-2xl border border-borde bg-white p-4 text-left transition duration-300 ease-suave hover:-translate-y-0.5 hover:border-cloro/50 hover:shadow-agua-lg"
      >
        <div className="flex w-14 shrink-0 flex-col items-start justify-center border-r border-borde-suave pr-4">
          <span className="dato text-lg leading-none font-bold text-agua">{clase.hora}</span>
          <span className="dato mt-1 text-[11px] text-tinta-3">{clase.duracion} min</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-titulo text-sm font-semibold text-tinta">{clase.actividad}</h3>
              <p className="truncate text-xs text-tinta-3">{clase.profe}</p>
            </div>
            {clase.lleno && (
              <span className="shrink-0 rounded-full bg-agua/8 px-2 py-0.5 text-[11px] font-medium text-agua ring-1 ring-agua/20">
                Completo
              </span>
            )}
          </div>

          <BarraCupo ocupados={clase.ocupados} cupo={clase.cupo} className="mt-3" />

          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {clase.grupo.slice(0, 5).map((c) => (
                <span
                  key={c.id}
                  title={c.nombre}
                  className="dato grid size-6 place-items-center rounded-md bg-cloro/15 text-[9px] font-medium text-cloro-tinta ring-2 ring-white"
                >
                  {iniciales(c.nombre)}
                </span>
              ))}
              {clase.grupo.length > 5 && (
                <span className="dato grid size-6 place-items-center rounded-md bg-agua/8 text-[9px] font-medium text-agua ring-2 ring-white">
                  +{clase.grupo.length - 5}
                </span>
              )}
            </div>
            <span className="text-[11px] text-tinta-3">
              {libres > 0 ? `${libres} ${libres === 1 ? 'lugar libre' : 'lugares libres'}` : 'sin lugares'}
            </span>
            <svg viewBox="0 0 16 16" className="ml-auto size-4 text-tinta-4 transition group-hover:translate-x-0.5 group-hover:text-cloro-tinta" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3l5 5-5 5" />
            </svg>
          </div>
        </div>
      </button>
    </li>
  )
}

export default function HorariosPanel({ onAbrirClase }) {
  const { horarios, crearClase, avisar } = useDatos()
  const diaHoy = diaDeHoy()
  // Si se abre un domingo no hay nada que mostrar en "hoy", así que arranca en lunes.
  const [dia, setDia] = useState(diaHoy === 0 ? 1 : diaHoy)
  const [creando, setCreando] = useState(false)

  const guardarNueva = (datos) => {
    crearClase(datos)
    setCreando(false)
    setDia(datos.dia)
    avisar(`Creaste ${datos.actividad} los ${nombreDiaPlural(datos.dia)} a las ${datos.hora}.`)
  }

  const clases = horariosDelDia(horarios, dia)
  const resumen = resumenDelDia(horarios, dia)
  const esHoy = dia === diaHoy

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-tinta sm:text-3xl">Horarios</h1>
          <p className="mt-1 text-sm text-tinta-3">
            El horario es fijo: cada día y hora tiene siempre el mismo grupo, todas las semanas.
          </p>
        </div>
        {!creando && (
          <Boton variante="primario" onClick={() => setCreando(true)}>
            <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M8 3.5v9M3.5 8h9" />
            </svg>
            Nueva clase
          </Boton>
        )}
      </header>

      {creando && (
        <FormularioClase
          titulo="Nueva clase"
          clase={{ dia }}
          onConfirmar={guardarNueva}
          onCancelar={() => setCreando(false)}
        />
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {DIAS.map((d) => {
          const activo = dia === d.id
          const marcado = d.id === diaHoy
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setDia(d.id)}
              aria-pressed={activo}
              className={`relative flex-1 rounded-xl border px-3 py-2.5 text-center transition ${
                activo
                  ? 'border-agua bg-agua text-white'
                  : 'border-borde bg-white text-tinta-2 hover:border-cloro/60'
              }`}
            >
              <span className="block text-xs font-medium">{d.corto}</span>
              <span className={`dato mt-0.5 block text-[11px] ${activo ? 'text-white/65' : 'text-tinta-4'}`}>
                {horariosDelDia(horarios, d.id).length}
              </span>
              {marcado && (
                <span
                  className="absolute inset-x-0 -top-px mx-auto h-1 w-6 rounded-full bg-cloro"
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-titulo text-base font-semibold text-tinta capitalize">
          {nombreDia(dia)}
          {esHoy && (
            <span className="dato ml-2 rounded-full bg-cloro/18 px-2 py-0.5 align-middle text-[10px] font-bold tracking-wider text-cloro-tinta uppercase">
              Hoy
            </span>
          )}
        </h2>
        <p className="dato text-xs text-tinta-3">{formatoFechaLarga(fechaDelDia(dia))}</p>
        {!esHoy && (
          <button
            type="button"
            onClick={() => setDia(diaHoy === 0 ? 1 : diaHoy)}
            className="ml-auto text-xs font-medium text-cloro-tinta hover:underline"
          >
            Volver a hoy
          </button>
        )}
      </div>

      {clases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-borde bg-white/60 p-10 text-center">
          <p className="font-titulo text-base font-semibold text-tinta">
            No hay clases los {nombreDiaPlural(dia)}
          </p>
          <p className="mt-1 text-sm text-tinta-3">Podés crear la primera con el botón de arriba.</p>
          {!creando && (
            <Boton variante="secundario" onClick={() => setCreando(true)} className="mt-4">
              Crear una clase los {nombreDiaPlural(dia)}
            </Boton>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-borde bg-white px-4 py-3">
            <p className="text-xs text-tinta-3">
              <span className="dato text-base font-bold text-agua">{resumen.clases}</span>{' '}
              {resumen.clases === 1 ? 'clase' : 'clases'}
            </p>
            <div className="min-w-[10rem] flex-1">
              <p className="mb-1.5 text-xs text-tinta-3">
                <span className="dato font-medium text-tinta-2">
                  {resumen.ocupados}/{resumen.cupo}
                </span>{' '}
                lugares ocupados
              </p>
              <BarraCupo ocupados={resumen.ocupados} cupo={resumen.cupo} mostrarNumero={false} />
            </div>
            {resumen.llenas > 0 && (
              <p className="text-xs text-tinta-3">
                <span className="dato font-medium text-tinta-2">{resumen.llenas}</span>{' '}
                {resumen.llenas === 1 ? 'completa' : 'completas'}
              </p>
            )}
          </div>

          <ul className="space-y-2.5">
            {clases.map((c) => (
              <TarjetaClase key={c.id} clase={c} onAbrir={onAbrirClase} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
