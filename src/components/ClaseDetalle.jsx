import { useEffect, useMemo, useState } from 'react'
import { ESTADOS } from '../lib/estados.js'
import {
  aISO,
  formatoFecha,
  nombreDia,
  nombreDiaPlural,
  ocurrenciaMasReciente,
  textoVencimiento,
} from '../lib/fechas.js'
import { useDatos } from '../lib/store.jsx'
import BarraCupo from './BarraCupo.jsx'
import Boton from './Boton.jsx'
import EstadoChip from './EstadoChip.jsx'
import FormularioClase from './FormularioClase.jsx'
import Hoja from './Hoja.jsx'

export const iniciales = (nombre) =>
  nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

const normalizar = (t) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

/** Buscador de gente para sumar al grupo. Solo ofrece clientes que ya existen y que
 *  todavía no están anotados acá — dar de alta a alguien nuevo es otra cosa y no
 *  entra en este panel. Cada candidato muestra su estado de pago con el mismo
 *  código de color que el panel de Clientes, porque a la hora de sumar a alguien a
 *  una clase importa saber si está al día. */
function BuscadorDeParticipantes({ clase, onAgregar, onCerrar }) {
  const { clientes } = useDatos()
  const [busqueda, setBusqueda] = useState('')

  const candidatos = useMemo(() => {
    const q = normalizar(busqueda.trim())
    return clientes
      .filter((c) => !clase.participantes.includes(c.id))
      .filter((c) => q === '' || normalizar(c.nombre).includes(q) || normalizar(c.plan).includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [clientes, clase.participantes, busqueda])

  const yaEstanTodos = clientes.length === clase.participantes.length

  return (
    <div className="anim-subir mt-3 rounded-2xl border border-cloro/40 bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="font-titulo text-xs font-semibold tracking-wide text-tinta-2 uppercase">
          Agregar a la clase
        </h4>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar el buscador"
          className="grid size-11 place-items-center rounded-xl text-tinta-4 transition hover:bg-agua/6 hover:text-tinta"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {/* El cupo lleno avisa, pero no bloquea: quién entra o no a una clase llena es
          una decisión de ella, no del sistema. */}
      {clase.lleno && (
        <p className="mb-3 flex items-start gap-2 rounded-xl bg-alerta/12 px-3 py-2.5 text-[11px] leading-relaxed text-alerta-tinta ring-1 ring-alerta/25">
          <svg viewBox="0 0 16 16" className="mt-px size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 2.2l6 11.6H2z" />
            <path d="M8 6.6v3M8 11.6h.01" />
          </svg>
          <span>
            La clase ya está completa (<span className="dato">{clase.ocupados}/{clase.cupo}</span>). Podés
            sumar a alguien igual y va a quedar por encima del cupo.
          </span>
        </p>
      )}

      {yaEstanTodos ? (
        <p className="px-1 py-6 text-center text-sm text-tinta-3">
          Todos los clientes ya están anotados en esta clase.
        </p>
      ) : (
        <>
          <label htmlFor="buscar-participante" className="block text-xs font-medium text-tinta-2">
            Buscar cliente
          </label>
          <input
            id="buscar-participante"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre o plan…"
            autoComplete="off"
            className="mt-1 min-h-11 w-full rounded-xl border border-borde bg-white px-3 text-sm text-tinta transition placeholder:text-tinta-4 focus:border-cloro focus:outline-none"
          />

          {candidatos.length === 0 ? (
            <div className="px-1 py-6 text-center">
              <p className="text-sm font-medium text-tinta">No encontramos a nadie con ese nombre</p>
              <p className="mt-1 text-xs text-tinta-3">
                Probá con el apellido, o fijate si ya está anotado más abajo en la lista.
              </p>
            </div>
          ) : (
            <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto overscroll-contain">
              {candidatos.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onAgregar(c)}
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-cloro/10"
                  >
                    <span className="dato grid size-8 shrink-0 place-items-center rounded-lg bg-agua/8 text-[10px] font-medium text-agua">
                      {iniciales(c.nombre)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-tinta">{c.nombre}</span>
                      <span className="block truncate text-[11px] text-tinta-3">{c.plan}</span>
                    </span>
                    <EstadoChip estado={c.estado} chico />
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-cloro/15 text-cloro-tinta" aria-hidden="true">
                      <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <path d="M8 3.5v9M3.5 8h9" />
                      </svg>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

export default function ClaseDetalle({ claseId, onCerrar, onAbrirCliente }) {
  const {
    horarioPorId,
    agregarParticipante,
    sacarParticipante,
    editarClase,
    eliminarClase,
    marcarAsistencia,
    asistencias,
    avisar,
  } = useDatos()
  const [confirmando, setConfirmando] = useState(null)
  const [agregando, setAgregando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [borrando, setBorrando] = useState(false)
  // 0 = la última vez que cayó ese día (hoy, si la clase es hoy). Sube para tomar
  // asistencia de una semana anterior que quedó sin marcar.
  const [semanasAtras, setSemanasAtras] = useState(0)

  // Al cambiar de clase, ningún formulario ni confirmación a medias queda abierto
  // sobre la nueva.
  useEffect(() => {
    setConfirmando(null)
    setAgregando(false)
    setEditando(false)
    setBorrando(false)
    setSemanasAtras(0)
  }, [claseId])

  const clase = claseId ? horarioPorId(claseId) : null
  if (!clase) return null

  const conDeuda = clase.grupo.filter((c) => c.estado !== 'al-dia')
  const libres = clase.cupo - clase.ocupados

  const fechaClase = ocurrenciaMasReciente(clase.dia, semanasAtras)
  const fechaISO = aISO(fechaClase)
  const presentes = asistencias?.[clase.id]?.[fechaISO] ?? []
  const esHoy = semanasAtras === 0 && clase.dia === new Date().getDay()

  const alternarAsistencia = (c) => {
    const vaAEstar = !presentes.includes(c.id)
    marcarAsistencia(clase.id, fechaISO, c.id, vaAEstar)
    avisar(
      vaAEstar
        ? `${c.nombre} se presentó a ${clase.actividad} del ${formatoFecha(fechaClase)}.`
        : `Desmarcaste a ${c.nombre} de ${clase.actividad} del ${formatoFecha(fechaClase)}.`,
    )
  }

  const sacar = (c) => {
    sacarParticipante(clase.id, c.id)
    setConfirmando(null)
    avisar(`Sacaste a ${c.nombre} de ${clase.actividad} de los ${nombreDiaPlural(clase.dia)}.`)
  }

  const agregar = (c) => {
    agregarParticipante(clase.id, c.id)
    setAgregando(false)
    avisar(`Agregaste a ${c.nombre} a ${clase.actividad} de los ${nombreDiaPlural(clase.dia)}.`)
  }

  const guardarCambios = (datos) => {
    editarClase(clase.id, datos)
    setEditando(false)
    avisar(`Guardamos los cambios de ${datos.actividad}.`)
  }

  const confirmarBorrado = () => {
    const nombre = clase.actividad
    const dia = nombreDiaPlural(clase.dia)
    eliminarClase(clase.id)
    onCerrar()
    avisar(`Eliminaste ${nombre} de los ${dia}.`)
  }

  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      titulo={`${clase.actividad}, ${nombreDia(clase.dia)} ${clase.hora}`}
      encabezado={
        <div className="pr-10">
          <p className="dato text-[11px] tracking-widest text-cloro uppercase">
            <span className="capitalize">{nombreDia(clase.dia)}</span> · todas las semanas
          </p>
          <h2 className="mt-1 font-titulo text-xl font-bold text-white">{clase.actividad}</h2>
          <p className="mt-0.5 text-sm text-white/70">
            <span className="dato">{clase.hora}</span> · {clase.duracion} min · {clase.profe}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className="dato text-2xl font-bold text-white">
              {clase.ocupados}
              <span className="text-base font-medium text-white/60">/{clase.cupo}</span>
            </span>
            <span className="text-xs text-white/70">
              {libres > 0
                ? `${libres} ${libres === 1 ? 'lugar libre' : 'lugares libres'}`
                : libres === 0
                  ? 'Grupo completo'
                  : `${Math.abs(libres)} por encima del cupo`}
            </span>
          </div>
        </div>
      }
    >
      <BarraCupo ocupados={clase.ocupados} cupo={clase.cupo} mostrarNumero={false} />

      {conDeuda.length > 0 && (
        <p className="mt-4 rounded-xl bg-alerta/12 px-4 py-3 text-xs leading-relaxed text-alerta-tinta ring-1 ring-alerta/25">
          <span className="dato font-bold">{conDeuda.length}</span> de{' '}
          <span className="dato">{clase.ocupados}</span>{' '}
          {conDeuda.length === 1 ? 'persona de este grupo tiene' : 'personas de este grupo tienen'} la
          cuota vencida o por vencer.
        </p>
      )}

      <section className="mt-6">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h3 className="font-titulo text-xs font-semibold tracking-wide text-tinta-2 uppercase">
            Participantes
          </h3>
          <span className="dato text-xs text-tinta-3">{clase.ocupados}</span>
        </div>

        {/* La asistencia va contra una FECHA, no contra el grupo: el grupo es el
            mismo todas las semanas, así que una marca sin fecha sería permanente y
            no diría nada. Por defecto se toma la última vez que cayó ese día. */}
        {clase.ocupados > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-2xl border border-borde bg-white px-3 py-2">
            <button
              type="button"
              onClick={() => setSemanasAtras((n) => n + 1)}
              aria-label="Semana anterior"
              className="grid size-11 shrink-0 place-items-center rounded-xl text-tinta-3 transition hover:bg-agua/6 hover:text-tinta"
            >
              <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 3L5 8l5 5" />
              </svg>
            </button>

            <div className="min-w-0 flex-1 text-center">
              <p className="text-[11px] tracking-wide text-tinta-3 uppercase">Asistencia del</p>
              <p className="dato text-sm font-medium text-tinta">
                {formatoFecha(fechaClase)}
                {esHoy && (
                  <span className="ml-1.5 rounded-full bg-cloro/18 px-1.5 py-0.5 align-middle text-[10px] font-bold tracking-wider text-cloro-tinta uppercase">
                    Hoy
                  </span>
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSemanasAtras((n) => Math.max(0, n - 1))}
              disabled={semanasAtras === 0}
              aria-label="Semana siguiente"
              className="grid size-11 shrink-0 place-items-center rounded-xl text-tinta-3 transition hover:bg-agua/6 hover:text-tinta disabled:pointer-events-none disabled:opacity-30"
            >
              <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3l5 5-5 5" />
              </svg>
            </button>

            <p className="w-full border-t border-borde-suave pt-2 text-center text-xs text-tinta-3">
              <span className="dato font-medium text-tinta-2">
                {presentes.length}/{clase.ocupados}
              </span>{' '}
              {presentes.length === 1 ? 'se presentó' : 'se presentaron'}
            </p>
          </div>
        )}

        {clase.ocupados === 0 ? (
          <div className="rounded-2xl border border-dashed border-borde p-6 text-center">
            <p className="text-sm font-medium text-tinta">Todavía no hay nadie en este grupo</p>
            <p className="mt-1 text-xs text-tinta-3">Agregá al primer participante con el botón de abajo.</p>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-borde bg-white">
            {clase.grupo.map((c) =>
              confirmando === c.id ? (
                // La confirmación pasa acá adentro, en la fila misma, y no en otra
                // ventana encima de esta: apilar un modal sobre otro en un celular
                // es la forma más rápida de que alguien confirme sin leer.
                <li key={c.id} className="border-b border-borde-suave bg-error/6 p-4 last:border-0">
                  <p className="text-sm text-tinta">
                    ¿Sacar a <span className="font-semibold">{c.nombre}</span> de esta clase?
                  </p>
                  <p className="mt-1 text-xs text-tinta-3">
                    Sigue siendo cliente: solo deja de venir los{' '}
                    {nombreDiaPlural(clase.dia)} a las <span className="dato">{clase.hora}</span>.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Boton variante="peligro" onClick={() => sacar(c)}>
                      Sí, sacar
                    </Boton>
                    <Boton variante="secundario" onClick={() => setConfirmando(null)}>
                      Cancelar
                    </Boton>
                  </div>
                </li>
              ) : (
                <li
                  key={c.id}
                  className={`flex items-center gap-2 border-b border-borde-suave pr-2 last:border-0 ${
                    presentes.includes(c.id) ? 'bg-exito/6' : ''
                  }`}
                >
                  {/* Marcar presente es lo que más se toca durante la clase, así
                      que va primero y con el target más grande de la fila. */}
                  <button
                    type="button"
                    onClick={() => alternarAsistencia(c)}
                    aria-pressed={presentes.includes(c.id)}
                    aria-label={`${presentes.includes(c.id) ? 'Desmarcar' : 'Marcar'} que ${c.nombre} se presentó`}
                    title={presentes.includes(c.id) ? 'Se presentó' : 'Marcar que se presentó'}
                    className="ml-2 grid size-11 shrink-0 place-items-center rounded-xl transition"
                  >
                    <span
                      className={`grid size-6 place-items-center rounded-full border-2 transition ${
                        presentes.includes(c.id)
                          ? 'border-exito bg-exito text-white'
                          : 'border-borde text-transparent hover:border-exito/60'
                      }`}
                    >
                      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3.5 8.5l3 3 6-6.5" />
                      </svg>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onAbrirCliente(c)}
                    className="flex min-h-11 flex-1 items-center gap-3 py-3 pr-2 text-left transition hover:bg-cloro/8"
                  >
                    <span className="dato grid size-9 shrink-0 place-items-center rounded-xl bg-agua/8 text-xs font-medium text-agua">
                      {iniciales(c.nombre)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-tinta">{c.nombre}</span>
                      <span className={`block truncate text-xs ${c.estado === 'al-dia' ? 'text-tinta-3' : ESTADOS[c.estado].texto}`}>
                        {textoVencimiento(c.diasParaVencer)}
                      </span>
                    </span>
                    <EstadoChip estado={c.estado} chico />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmando(c.id)}
                    aria-label={`Sacar a ${c.nombre} de esta clase`}
                    title={`Sacar a ${c.nombre}`}
                    className="grid size-11 shrink-0 place-items-center rounded-xl text-tinta-4 transition hover:bg-error/10 hover:text-error-tinta"
                  >
                    <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M3.5 8h9" />
                    </svg>
                  </button>
                </li>
              ),
            )}

            {/* Los lugares libres se muestran, no se dejan en blanco: el hueco es
                justamente la información que sirve para vender otro lugar. */}
            {Array.from({ length: Math.max(0, libres) }).map((_, i) => (
              <li
                key={`libre-${i}`}
                className="flex items-center gap-3 border-b border-borde-suave px-4 py-3 last:border-0"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-dashed border-borde text-tinta-4">
                  <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M8 3.5v9M3.5 8h9" />
                  </svg>
                </span>
                <span className="text-sm text-tinta-4">Lugar libre</span>
              </li>
            ))}
          </ul>
        )}

        {agregando ? (
          <BuscadorDeParticipantes clase={clase} onAgregar={agregar} onCerrar={() => setAgregando(false)} />
        ) : (
          <Boton variante="primario" onClick={() => setAgregando(true)} className="mt-3 w-full">
            <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M8 3.5v9M3.5 8h9" />
            </svg>
            Agregar participante
          </Boton>
        )}
      </section>

      <section className="mt-6">
        <h3 className="mb-2 font-titulo text-xs font-semibold tracking-wide text-tinta-2 uppercase">
          La clase
        </h3>

        {editando ? (
          <FormularioClase
            clase={clase}
            anotados={clase.ocupados}
            titulo="Editar la clase"
            onConfirmar={guardarCambios}
            onCancelar={() => setEditando(false)}
          />
        ) : borrando ? (
          <div className="rounded-2xl border border-error/30 bg-error/6 p-4">
            <p className="text-sm text-tinta">
              ¿Eliminar <span className="font-semibold">{clase.actividad}</span> de los{' '}
              {nombreDiaPlural(clase.dia)} a las <span className="dato">{clase.hora}</span>?
            </p>
            <p className="mt-1 text-xs leading-relaxed text-tinta-3">
              {clase.ocupados === 0 ? (
                'No hay nadie anotado en esta clase.'
              ) : (
                <>
                  Hay <span className="dato font-semibold text-error-tinta">{clase.ocupados}</span>{' '}
                  {clase.ocupados === 1 ? 'persona anotada' : 'personas anotadas'} que se{' '}
                  {clase.ocupados === 1 ? 'queda' : 'quedan'} sin este horario:{' '}
                  {clase.grupo.map((c) => c.nombre).join(', ')}. Siguen siendo clientes; solo
                  desaparece la clase.
                </>
              )}
            </p>
            <div className="mt-3 flex gap-2">
              <Boton variante="peligro" onClick={confirmarBorrado}>
                Sí, eliminar
              </Boton>
              <Boton variante="secundario" onClick={() => setBorrando(false)}>
                Cancelar
              </Boton>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-borde bg-white p-4">
            <p className="text-xs leading-relaxed text-tinta-3">
              Este grupo es fijo: viene todos los {nombreDiaPlural(clase.dia)} a las{' '}
              <span className="dato">{clase.hora}</span>, semana a semana.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Boton variante="secundario" onClick={() => setEditando(true)}>
                Editar la clase
              </Boton>
              <Boton variante="fantasma" onClick={() => setBorrando(true)}>
                Eliminar
              </Boton>
            </div>
          </div>
        )}
      </section>
    </Hoja>
  )
}
