import { useId } from 'react'

// Campo de formulario con la etiqueta SIEMPRE visible arriba del input, nunca solo
// el placeholder: el placeholder desaparece justo cuando la persona escribe, que es
// el momento en que más necesita saber qué está completando.
//
// El error se muestra pegado al campo que falló y no arriba de todo, para no tener
// que buscar cuál de los cuatro campos es el que está mal.

export default function Campo({ etiqueta, ayuda, error, children, className = '' }) {
  const id = useId()
  const idAyuda = ayuda ? `${id}-ayuda` : undefined
  const idError = error ? `${id}-error` : undefined

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs font-medium text-tinta-2">
        {etiqueta}
      </label>
      {children({
        id,
        'aria-describedby': [idAyuda, idError].filter(Boolean).join(' ') || undefined,
        'aria-invalid': error ? true : undefined,
        className: `mt-1 w-full min-h-11 rounded-xl border bg-white px-3 text-sm text-tinta transition focus:outline-none ${
          error ? 'border-error focus:border-error-tinta' : 'border-borde focus:border-cloro'
        }`,
      })}
      {ayuda && !error && (
        <p id={idAyuda} className="mt-1 text-[11px] text-tinta-3">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} role="alert" className="mt-1 flex items-start gap-1 text-[11px] text-error-tinta">
          <svg viewBox="0 0 16 16" className="mt-px size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="8" cy="8" r="6.2" />
            <path d="M8 5v3.6M8 11h.01" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}
