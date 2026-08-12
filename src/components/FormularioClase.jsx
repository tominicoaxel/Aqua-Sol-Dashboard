import { useState } from 'react'
import { nombreDia } from '../lib/fechas.js'
import Boton from './Boton.jsx'
import Campo from './Campo.jsx'

const DIAS = [1, 2, 3, 4, 5, 6]

/** Alta y edición de una clase. Es el mismo formulario para las dos cosas: los
 *  campos son idénticos y tener dos versiones sería tener dos lugares donde
 *  arreglar el mismo bug. */
export default function FormularioClase({ clase, anotados = 0, titulo, onConfirmar, onCancelar }) {
  const [actividad, setActividad] = useState(clase?.actividad ?? '')
  const [dia, setDia] = useState(clase?.dia ?? 1)
  const [hora, setHora] = useState(clase?.hora ?? '09:00')
  const [profe, setProfe] = useState(clase?.profe ?? '')
  const [cupo, setCupo] = useState(String(clase?.cupo ?? 8))
  const [duracion, setDuracion] = useState(String(clase?.duracion ?? 45))
  const [tocado, setTocado] = useState(false)

  const errorActividad = actividad.trim() ? null : 'Poné un nombre para la clase.'
  const errorHora = /^\d{2}:\d{2}$/.test(hora) ? null : 'Elegí una hora.'
  const errorCupo = Number(cupo) >= 1 ? null : 'El cupo tiene que ser al menos 1.'
  const errorDuracion = Number(duracion) >= 5 ? null : 'La duración tiene que ser de 5 minutos o más.'
  const invalido = Boolean(errorActividad || errorHora || errorCupo || errorDuracion)

  // Bajar el cupo por debajo de los que ya están anotados avisa, pero no bloquea:
  // el mismo criterio que al sumar gente a una clase llena. Quién entra y quién no
  // lo decide ella, no el formulario.
  const quedanAfuera = Number(cupo) >= 1 ? Math.max(0, anotados - Number(cupo)) : 0

  return (
    <form
      className="anim-subir rounded-2xl border border-cloro/40 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault()
        setTocado(true)
        if (invalido) return
        onConfirmar({
          actividad: actividad.trim(),
          dia: Number(dia),
          hora,
          profe: profe.trim(),
          cupo: Number(cupo),
          duracion: Number(duracion),
        })
      }}
    >
      <h4 className="font-titulo text-xs font-semibold tracking-wide text-tinta-2 uppercase">{titulo}</h4>

      <Campo etiqueta="Nombre de la clase *" error={tocado ? errorActividad : null} className="mt-3">
        {(p) => (
          <input
            {...p}
            type="text"
            value={actividad}
            onChange={(e) => setActividad(e.target.value)}
            onBlur={() => setTocado(true)}
            placeholder="Aquagym, Natación Niños…"
          />
        )}
      </Campo>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Campo etiqueta="Día *">
          {(p) => (
            <select {...p} value={dia} onChange={(e) => setDia(Number(e.target.value))}>
              {DIAS.map((d) => (
                <option key={d} value={d} className="capitalize">
                  {nombreDia(d)}
                </option>
              ))}
            </select>
          )}
        </Campo>

        <Campo etiqueta="Hora *" error={tocado ? errorHora : null}>
          {(p) => (
            <input
              {...p}
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              onBlur={() => setTocado(true)}
              className={`${p.className} dato`}
            />
          )}
        </Campo>

        <Campo etiqueta="Cupo máximo *" error={tocado ? errorCupo : null}>
          {(p) => (
            <input
              {...p}
              type="number"
              inputMode="numeric"
              min="1"
              value={cupo}
              onChange={(e) => setCupo(e.target.value)}
              onBlur={() => setTocado(true)}
              className={`${p.className} dato`}
            />
          )}
        </Campo>

        <Campo etiqueta="Duración (min)" error={tocado ? errorDuracion : null}>
          {(p) => (
            <input
              {...p}
              type="number"
              inputMode="numeric"
              min="5"
              step="5"
              value={duracion}
              onChange={(e) => setDuracion(e.target.value)}
              onBlur={() => setTocado(true)}
              className={`${p.className} dato`}
            />
          )}
        </Campo>
      </div>

      <Campo etiqueta="Profesor/a" className="mt-3">
        {(p) => (
          <input
            {...p}
            type="text"
            value={profe}
            onChange={(e) => setProfe(e.target.value)}
            placeholder="Quién la da"
          />
        )}
      </Campo>

      {quedanAfuera > 0 && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-alerta/12 px-3 py-2.5 text-[11px] leading-relaxed text-alerta-tinta ring-1 ring-alerta/25">
          <svg viewBox="0 0 16 16" className="mt-px size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 2.2l6 11.6H2z" />
            <path d="M8 6.6v3M8 11.6h.01" />
          </svg>
          <span>
            Ahora hay <span className="dato">{anotados}</span> anotados y el cupo queda en{' '}
            <span className="dato">{cupo}</span>. No sacamos a nadie: la clase va a quedar{' '}
            <span className="dato">{quedanAfuera}</span> por encima del cupo.
          </span>
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <Boton variante="primario" type="submit" disabled={tocado && invalido}>
          Guardar
        </Boton>
        <Boton variante="secundario" onClick={onCancelar}>
          Cancelar
        </Boton>
      </div>
    </form>
  )
}
