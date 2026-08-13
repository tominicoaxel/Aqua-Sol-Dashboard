import { useState } from 'react'
import { GRUPOS_EDAD_ESPERA, grupoEdadEspera } from '../lib/edades.js'
import { formatoFecha, nombreDia, parseISO } from '../lib/fechas.js'
import { isoDeHoy, useDatos } from '../lib/store.jsx'
import Boton from './Boton.jsx'
import Campo from './Campo.jsx'

export const ESTADOS_ESPERA = {
  esperando: { etiqueta: 'Esperando', clase: 'bg-sol/15 text-sol-tinta ring-sol/30' },
  contactado: { etiqueta: 'Contactado', clase: 'bg-cloro/15 text-cloro-tinta ring-cloro/25' },
  ingreso: { etiqueta: 'Ingresó', clase: 'bg-exito/15 text-exito-tinta ring-exito/25' },
  baja: { etiqueta: 'Baja', clase: 'bg-error/10 text-error-tinta ring-error/20' },
}

function etiquetaClase(clase) {
  if (!clase) return 'Clase eliminada o sin asignar'
  return `${clase.actividad} · ${nombreDia(clase.dia)} ${clase.hora}`
}

function FormularioEspera({ persona, horarios, onConfirmar, onCancelar }) {
  const [nombre, setNombre] = useState(persona?.nombre ?? '')
  const [edad, setEdad] = useState(persona?.edad == null ? '' : String(persona.edad))
  const [telefono, setTelefono] = useState(persona?.telefono ?? '')
  const [claseId, setClaseId] = useState(persona?.claseId ?? '')
  const [fechaSolicitud, setFechaSolicitud] = useState(persona?.fechaSolicitud ?? isoDeHoy())
  const [estado, setEstado] = useState(persona?.estado ?? 'esperando')
  const [notas, setNotas] = useState(persona?.notas ?? '')
  const [tocado, setTocado] = useState(false)

  const errorNombre = nombre.trim() ? null : 'Escribí el nombre de la persona.'
  const edadNumero = Number(edad)
  const errorEdad = !edad
    ? 'Ingresá la edad para ubicar a la persona en su grupo.'
    : !Number.isInteger(edadNumero)
      ? 'Ingresá la edad en años enteros.'
      : !grupoEdadEspera(edadNumero)
        ? 'La edad debe ser de 6 a 18 años o mayor de 65.'
        : null
  const errorTelefono = telefono.trim() ? null : 'Necesitás un teléfono para avisarle cuando haya lugar.'
  const errorClase = claseId ? null : 'Elegí la clase que quiere reservar.'
  const errorFecha = fechaSolicitud ? null : 'Elegí la fecha del pedido.'
  const invalido = Boolean(errorNombre || errorEdad || errorTelefono || errorClase || errorFecha)
  const ordenados = [...horarios].sort((a, b) => a.dia - b.dia || a.hora.localeCompare(b.hora))

  return (
    <form
      className="anim-subir rounded-2xl border border-cloro/40 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault()
        setTocado(true)
        if (invalido) return
        onConfirmar({
          nombre: nombre.trim(),
          edad: edadNumero,
          telefono: telefono.trim(),
          claseId,
          fechaSolicitud,
          estado,
          notas: notas.trim(),
        })
      }}
    >
      <h2 className="font-titulo text-sm font-semibold text-tinta">
        {persona ? 'Editar pedido' : 'Agregar a la lista de espera'}
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre y apellido *" error={tocado ? errorNombre : null}>
          {(p) => <input {...p} value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={() => setTocado(true)} />}
        </Campo>
        <Campo etiqueta="Edad *" error={tocado ? errorEdad : null} ayuda="Grupos admitidos: 6 a 18 años y mayores de 65">
          {(p) => (
            <input
              {...p}
              className={`${p.className} dato`}
              type="number"
              inputMode="numeric"
              min="6"
              step="1"
              value={edad}
              onChange={(e) => setEdad(e.target.value)}
              onBlur={() => setTocado(true)}
            />
          )}
        </Campo>
        <Campo etiqueta="Teléfono *" error={tocado ? errorTelefono : null}>
          {(p) => <input {...p} type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} onBlur={() => setTocado(true)} />}
        </Campo>
        <Campo etiqueta="Clase y horario que reserva *" error={tocado ? errorClase : null}>
          {(p) => (
            <select {...p} value={claseId} onChange={(e) => setClaseId(e.target.value)}>
              <option value="">Elegir clase</option>
              {ordenados.map((clase) => (
                <option key={clase.id} value={clase.id}>
                  {etiquetaClase(clase)} · {clase.ocupados}/{clase.cupo}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo etiqueta="Fecha del pedido *" error={tocado ? errorFecha : null}>
          {(p) => <input {...p} className={`${p.className} dato`} type="date" value={fechaSolicitud} onChange={(e) => setFechaSolicitud(e.target.value)} />}
        </Campo>
        <Campo etiqueta="Estado *">
          {(p) => (
            <select {...p} value={estado} onChange={(e) => setEstado(e.target.value)}>
              {Object.entries(ESTADOS_ESPERA).map(([id, valor]) => <option key={id} value={id}>{valor.etiqueta}</option>)}
            </select>
          )}
        </Campo>
        <Campo etiqueta="Notas" ayuda="Preferencias, disponibilidad o cualquier dato útil" className="sm:col-span-2">
          {(p) => <textarea {...p} className={`${p.className} min-h-24 py-3`} value={notas} onChange={(e) => setNotas(e.target.value)} />}
        </Campo>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Boton variante="primario" type="submit" disabled={tocado && invalido}>Guardar pedido</Boton>
        <Boton variante="secundario" onClick={onCancelar}>Cancelar</Boton>
      </div>
    </form>
  )
}

function TarjetaEspera({ persona, onEditar, onEliminar, eliminando, onCancelarEliminar, onAbrirClase }) {
  const estado = ESTADOS_ESPERA[persona.estado]
  const hayLugar = persona.clase && persona.clase.ocupados < persona.clase.cupo

  return (
    <li className="rounded-2xl border border-borde bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-titulo text-base font-semibold text-tinta">{persona.nombre}</h2>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${estado.clase}`}>{estado.etiqueta}</span>
            {hayLugar && persona.estado === 'esperando' && (
              <span className="rounded-full bg-exito/15 px-2 py-0.5 text-[11px] font-medium text-exito-tinta ring-1 ring-exito/25">Hay lugar</span>
            )}
          </div>
          <a href={`tel:${persona.telefono.replace(/\s|-/g, '')}`} className="dato mt-1 inline-block text-xs text-cloro-tinta hover:underline">{persona.telefono}</a>
          {persona.edad != null && <span className="dato ml-3 text-xs text-tinta-3">{persona.edad} años</span>}
        </div>
        {!eliminando && (
          <div className="flex gap-1">
            <Boton variante="fantasma" className="px-3" onClick={onEditar}>Editar</Boton>
            <Boton variante="fantasma" className="px-3 text-error-tinta" onClick={onEliminar}>Eliminar</Boton>
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={!persona.clase}
        onClick={() => persona.clase && onAbrirClase(persona.clase)}
        className="mt-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-espuma px-3 py-2 text-left transition enabled:hover:bg-cloro/10 disabled:cursor-default"
      >
        <span>
          <span className="block text-[11px] text-tinta-3">Quiere reservar</span>
          <span className="block text-sm text-tinta">{etiquetaClase(persona.clase)}</span>
        </span>
        {persona.clase && <span className="dato shrink-0 text-xs text-tinta-3">{persona.clase.ocupados}/{persona.clase.cupo}</span>}
      </button>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-2 text-xs text-tinta-3">
        <span>En espera desde <span className="dato text-tinta-2">{formatoFecha(parseISO(persona.fechaSolicitud))}</span></span>
        {persona.notas && <p className="w-full rounded-xl border border-borde-suave px-3 py-2 text-tinta-2">{persona.notas}</p>}
      </div>

      {eliminando && (
        <div role="alert" className="mt-4 rounded-xl bg-error/10 p-3 text-sm text-error-tinta ring-1 ring-error/25">
          <p>¿Eliminar a {persona.nombre} de la lista de espera?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Boton variante="peligro" onClick={onEliminar}>Sí, eliminar</Boton>
            <Boton variante="secundario" onClick={onCancelarEliminar}>Cancelar</Boton>
          </div>
        </div>
      )}
    </li>
  )
}

export default function ListaEsperaPanel({ onAbrirClase }) {
  const { listaEspera, horarios, crearEnEspera, editarEnEspera, eliminarDeEspera, avisar } = useDatos()
  const [formulario, setFormulario] = useState(null)
  const [filtro, setFiltro] = useState('activos')
  const [eliminando, setEliminando] = useState(null)

  const guardar = (datos) => {
    if (formulario === 'nuevo') {
      crearEnEspera(datos)
      avisar(`Agregaste a ${datos.nombre} a la lista de espera.`)
    } else {
      editarEnEspera(formulario.id, datos)
      avisar(`Actualizaste el pedido de ${datos.nombre}.`)
    }
    setFormulario(null)
  }

  const confirmarEliminar = (persona) => {
    eliminarDeEspera(persona.id)
    setEliminando(null)
    avisar(`Eliminaste a ${persona.nombre} de la lista de espera.`)
  }

  const visibles = listaEspera.filter((p) => {
    if (filtro === 'todos') return true
    if (filtro === 'activos') return p.estado === 'esperando' || p.estado === 'contactado'
    return p.estado === filtro
  })
  const activos = listaEspera.filter((p) => p.estado === 'esperando' || p.estado === 'contactado').length
  const gruposVisibles = GRUPOS_EDAD_ESPERA.map((grupo) => ({
    ...grupo,
    personas: visibles.filter((persona) => grupoEdadEspera(persona.edad)?.id === grupo.id),
  }))
  // Los registros creados antes de que existiera la edad siguen visibles para que
  // se puedan completar desde Editar; nunca se esconden por una migración.
  const sinGrupo = visibles.filter((persona) => !grupoEdadEspera(persona.edad))

  const renderPersonas = (personas) => (
    <ul className="mt-3 space-y-3">
      {personas.map((persona) => (
        <TarjetaEspera
          key={persona.id}
          persona={persona}
          onEditar={() => setFormulario(persona)}
          eliminando={eliminando === persona.id}
          onEliminar={() => eliminando === persona.id ? confirmarEliminar(persona) : setEliminando(persona.id)}
          onCancelarEliminar={() => setEliminando(null)}
          onAbrirClase={onAbrirClase}
        />
      ))}
    </ul>
  )

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-tinta sm:text-3xl">Lista de espera</h1>
          <p className="mt-1 text-sm text-tinta-3">Personas interesadas y el horario que quieren reservar cuando se libere un lugar.</p>
        </div>
        {!formulario && <Boton variante="primario" onClick={() => setFormulario('nuevo')}>Agregar persona</Boton>}
      </header>

      {formulario && (
        <FormularioEspera
          key={formulario === 'nuevo' ? 'nuevo' : formulario.id}
          persona={formulario === 'nuevo' ? null : formulario}
          horarios={horarios}
          onConfirmar={guardar}
          onCancelar={() => setFormulario(null)}
        />
      )}

      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar lista de espera">
        {[
          ['activos', `Activos ${activos}`],
          ['esperando', 'Esperando'],
          ['contactado', 'Contactados'],
          ['ingreso', 'Ingresaron'],
          ['todos', `Todos ${listaEspera.length}`],
        ].map(([id, etiqueta]) => (
          <button
            key={id}
            type="button"
            aria-pressed={filtro === id}
            onClick={() => setFiltro(id)}
            className={`min-h-11 shrink-0 rounded-xl border px-3 text-xs font-medium transition ${
              filtro === id ? 'border-agua bg-agua text-white' : 'border-borde bg-white text-tinta-2 hover:border-cloro/60'
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-borde bg-white/60 p-8 text-center">
          <h2 className="font-titulo text-base font-semibold text-tinta">No hay personas en este estado</h2>
          <p className="mt-1 text-sm text-tinta-3">Podés cambiar el filtro o agregar un nuevo pedido.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {gruposVisibles.filter((grupo) => grupo.personas.length > 0).map((grupo) => (
            <section key={grupo.id} aria-labelledby={`grupo-edad-${grupo.id}`}>
              <div className="flex items-center gap-2">
                <h2 id={`grupo-edad-${grupo.id}`} className="font-titulo text-lg font-semibold text-tinta">{grupo.etiqueta}</h2>
                <span className="dato rounded-full bg-agua/10 px-2 py-0.5 text-xs text-agua">
                  {grupo.personas.length}
                </span>
              </div>
              {renderPersonas(grupo.personas)}
            </section>
          ))}

          {sinGrupo.length > 0 && (
            <section aria-labelledby="grupo-edad-pendiente">
              <div className="flex items-center gap-2">
                <h2 id="grupo-edad-pendiente" className="font-titulo text-lg font-semibold text-tinta">Edad pendiente</h2>
                <span className="dato rounded-full bg-alerta/15 px-2 py-0.5 text-xs text-alerta-tinta">{sinGrupo.length}</span>
              </div>
              <p className="mt-1 text-xs text-tinta-3">Editá estas personas para asignarlas a uno de los grupos.</p>
              {renderPersonas(sinGrupo)}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
