import { clientes } from './mockClientes.js'
import { horarios } from './mockHorarios.js'

// ─── Padrón de prueba ───────────────────────────────────────────────────────
// Vive acá y no en `src/` a propósito: la app real ya no tiene datos de ejemplo,
// arranca vacía y se puebla desde el importador. Estos 20 clientes y 23 clases
// existen solo para que la verificación pueda ejercitar las funciones puras y
// renderizar todas las pantallas sin salir a la red.
//
// Las fechas se siguen generando relativas a HOY, y acá sí corresponde: los
// chequeos buscan "un cliente vencido" y "uno al día". Con fechas fijas, dentro de
// dos meses estarían todos vencidos y media verificación dejaría de probar nada.

export function datosDeEjemplo() {
  return {
    clientes: structuredClone(clientes),
    horarios: structuredClone(horarios),
    asistencias: {},
  }
}
