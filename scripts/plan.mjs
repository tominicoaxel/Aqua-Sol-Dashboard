// El texto del "plan" que se ve en la ficha de cada persona, armado desde los días
// en que efectivamente tiene clase. Vive acá y no adentro de un script porque lo
// necesitan los dos: `leer-planilla.mjs` para la gente que entra por primera vez y
// `cargar-planilla.mjs` para recalcularlo cuando alguien aparece en las dos hojas y
// pasa a venir cuatro días.
//
// Los nombres de los días salen de `src/lib/fechas.js` para no tener una segunda
// lista que pueda divergir.

import { nombreDia } from '../src/lib/fechas.js'

/** [1, 3] → "Lunes y miércoles" · [1, 2, 3, 4] → "Lunes, martes, miércoles y jueves"
 *  `dias` sigue la convención de Date.getDay(): 0 domingo … 6 sábado. */
export function nombrePlan(dias) {
  const nombres = [...new Set(dias)].sort((a, b) => a - b).map(nombreDia)
  if (!nombres.length) return 'Sin plan'
  const texto = nombres.length === 1
    ? nombres[0]
    : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`
  return texto[0].toUpperCase() + texto.slice(1)
}
