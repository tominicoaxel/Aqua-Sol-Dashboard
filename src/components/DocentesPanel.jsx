import { useState } from 'react'
import { nombreDia } from '../lib/fechas.js'
import { useDatos } from '../lib/store.jsx'
import Boton from './Boton.jsx'
import Campo from './Campo.jsx'

function FormularioDocente({ docente, onConfirmar, onCancelar }) {
  const [nombre, setNombre] = useState(docente?.nombre ?? '')
  const [telefono, setTelefono] = useState(docente?.telefono ?? '')
  const [email, setEmail] = useState(docente?.email ?? '')
  const [rol, setRol] = useState(docente?.rol ?? 'titular')
  const [tocado, setTocado] = useState(false)

  const errorNombre = nombre.trim() ? null : 'Escribí el nombre del docente.'
  const errorEmail = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ? null
    : 'Revisá el formato del email.'
  const invalido = Boolean(errorNombre || errorEmail)

  return (
    <form
      className="anim-subir rounded-2xl border border-cloro/40 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault()
        setTocado(true)
        if (invalido) return
        onConfirmar({
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          email: email.trim(),
          rol,
        })
      }}
    >
      <h2 className="font-titulo text-sm font-semibold text-tinta">
        {docente ? 'Editar docente' : 'Nuevo docente'}
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre y apellido *" error={tocado ? errorNombre : null}>
          {(p) => (
            <input {...p} value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={() => setTocado(true)} />
          )}
        </Campo>
        <Campo etiqueta="Función *">
          {(p) => (
            <select {...p} value={rol} onChange={(e) => setRol(e.target.value)}>
              <option value="titular">Docente titular</option>
              <option value="suplente">Docente suplente</option>
            </select>
          )}
        </Campo>
        <Campo etiqueta="Teléfono">
          {(p) => (
            <input {...p} type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          )}
        </Campo>
        <Campo etiqueta="Email" error={tocado ? errorEmail : null}>
          {(p) => (
            <input {...p} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTocado(true)} />
          )}
        </Campo>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Boton variante="primario" type="submit" disabled={tocado && invalido}>Guardar docente</Boton>
        <Boton variante="secundario" onClick={onCancelar}>Cancelar</Boton>
      </div>
    </form>
  )
}

function TarjetaDocente({ docente, onEditar, onEliminar, onCancelarEliminar, eliminando, onAbrirClase }) {
  return (
    <li className="rounded-2xl border border-borde bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-titulo text-base font-semibold text-tinta">{docente.nombre}</h2>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              docente.rol === 'suplente'
                ? 'bg-sol/15 text-sol-tinta ring-1 ring-sol/30'
                : 'bg-cloro/15 text-cloro-tinta ring-1 ring-cloro/25'
            }`}>
              {docente.rol === 'suplente' ? 'Suplente' : 'Titular'}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-3">
            {docente.telefono && (
              <a className="dato hover:text-cloro-tinta hover:underline" href={`tel:${docente.telefono.replace(/\s|-/g, '')}`}>
                {docente.telefono}
              </a>
            )}
            {docente.email && <a className="hover:text-cloro-tinta hover:underline" href={`mailto:${docente.email}`}>{docente.email}</a>}
          </div>
        </div>
        {!eliminando && (
          <div className="flex gap-1">
            <Boton variante="fantasma" className="px-3" onClick={onEditar}>Editar</Boton>
            <Boton variante="fantasma" className="px-3 text-error-tinta" onClick={onEliminar}>Eliminar</Boton>
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-borde-suave pt-3">
        <p className="text-[11px] font-medium tracking-wide text-tinta-3 uppercase">
          {docente.clases.length} {docente.clases.length === 1 ? 'clase a cargo' : 'clases a cargo'}
        </p>
        {docente.clases.length === 0 ? (
          <p className="mt-2 text-sm text-tinta-3">
            {docente.rol === 'suplente' ? 'Disponible para cubrir suplencias.' : 'Todavía no tiene horarios asignados.'}
          </p>
        ) : (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {docente.clases.map((clase) => (
              <li key={clase.id}>
                <button
                  type="button"
                  onClick={() => onAbrirClase(clase)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl bg-espuma px-3 py-2 text-left transition hover:bg-cloro/10"
                >
                  <span className="dato text-xs font-medium text-agua">{clase.hora}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-tinta">{clase.actividad}</span>
                    <span className="block text-[11px] capitalize text-tinta-3">{nombreDia(clase.dia)}</span>
                  </span>
                  <span className="dato text-[11px] text-tinta-3">{clase.ocupados}/{clase.cupo}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {eliminando && (
        <div role="alert" className="mt-4 rounded-xl bg-error/10 p-3 text-sm text-error-tinta ring-1 ring-error/25">
          <p>
            ¿Eliminar a {docente.nombre}? {docente.clases.length > 0 && `${docente.clases.length} clases quedarán sin docente asignado.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Boton variante="peligro" onClick={onEliminar}>Sí, eliminar</Boton>
            <Boton variante="secundario" onClick={onCancelarEliminar}>Cancelar</Boton>
          </div>
        </div>
      )}
    </li>
  )
}

export default function DocentesPanel({ onAbrirClase }) {
  const { docentes, crearDocente, editarDocente, eliminarDocente, avisar } = useDatos()
  const [formulario, setFormulario] = useState(null)
  const [eliminando, setEliminando] = useState(null)

  const guardar = (datos) => {
    if (formulario === 'nuevo') {
      crearDocente(datos)
      avisar(`Agregaste a ${datos.nombre} como docente ${datos.rol}.`)
    } else {
      editarDocente(formulario.id, datos)
      avisar(`Actualizaste los datos de ${datos.nombre}.`)
    }
    setFormulario(null)
  }

  const confirmarEliminar = (docente) => {
    eliminarDocente(docente.id)
    setEliminando(null)
    avisar(`Eliminaste a ${docente.nombre}.`)
  }

  const titulares = docentes.filter((d) => d.rol === 'titular').length
  const suplentes = docentes.filter((d) => d.rol === 'suplente').length

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-tinta sm:text-3xl">Docentes</h1>
          <p className="mt-1 text-sm text-tinta-3">Quién está a cargo de cada clase y quién puede cubrir suplencias.</p>
        </div>
        {!formulario && <Boton variante="primario" onClick={() => setFormulario('nuevo')}>Nuevo docente</Boton>}
      </header>

      <div className="flex gap-3 text-xs text-tinta-3">
        <span><span className="dato font-bold text-agua">{titulares}</span> titulares</span>
        <span><span className="dato font-bold text-agua">{suplentes}</span> suplentes</span>
      </div>

      {formulario && (
        <FormularioDocente
          key={formulario === 'nuevo' ? 'nuevo' : formulario.id}
          docente={formulario === 'nuevo' ? null : formulario}
          onConfirmar={guardar}
          onCancelar={() => setFormulario(null)}
        />
      )}

      {docentes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-borde bg-white/60 p-8 text-center">
          <h2 className="font-titulo text-base font-semibold text-tinta">Todavía no hay docentes</h2>
          <p className="mt-1 text-sm text-tinta-3">Cargá titulares y suplentes para poder asignarlos a las clases.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {docentes.map((docente) => (
            <TarjetaDocente
              key={docente.id}
              docente={docente}
              onEditar={() => setFormulario(docente)}
              eliminando={eliminando === docente.id}
              onEliminar={() => eliminando === docente.id ? confirmarEliminar(docente) : setEliminando(docente.id)}
              onCancelarEliminar={() => setEliminando(null)}
              onAbrirClase={onAbrirClase}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
