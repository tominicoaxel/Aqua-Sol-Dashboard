import { useEffect, useState } from 'react'

/** Verdadero solo si `activo` lleva más de `ms` prendido.
 *
 *  La convención del proyecto: spinner únicamente en esperas de más de 300ms. Uno
 *  que aparece y desaparece en 80ms no se lee como progreso, se lee como un
 *  parpadeo roto — y con buena señal casi todas las respuestas entran en ese
 *  rango. La acción igual se bloquea desde el milisegundo cero; lo que se demora
 *  es *mostrar* que está esperando. */
export function useEsperaLarga(activo, ms = 300) {
  const [larga, setLarga] = useState(false)

  useEffect(() => {
    if (!activo) {
      setLarga(false)
      return
    }
    const t = setTimeout(() => setLarga(true), ms)
    return () => clearTimeout(t)
  }, [activo, ms])

  return larga
}
