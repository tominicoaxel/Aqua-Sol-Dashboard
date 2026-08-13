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
  const docentes = [
    { id: 'doc-paula', nombre: 'Paula Ríos', telefono: '11 4000-1001', email: 'paula@aquasol.com', rol: 'titular' },
    { id: 'doc-diego', nombre: 'Diego Ferrari', telefono: '11 4000-1002', email: 'diego@aquasol.com', rol: 'titular' },
    { id: 'doc-sol', nombre: 'Sol Medina', telefono: '11 4000-1003', email: 'sol@aquasol.com', rol: 'titular' },
    { id: 'doc-marcos', nombre: 'Marcos Leiva', telefono: '11 4000-1004', email: 'marcos@aquasol.com', rol: 'titular' },
    { id: 'doc-lucia', nombre: 'Lucía Gómez', telefono: '11 4000-1005', email: 'lucia@aquasol.com', rol: 'suplente' },
  ]
  const docentePorNombre = new Map(docentes.map((d) => [d.nombre, d.id]))
  const horariosConDocente = structuredClone(horarios).map((h) => ({
    ...h,
    docenteId: docentePorNombre.get(h.profe) ?? null,
  }))

  return {
    clientes: structuredClone(clientes),
    horarios: horariosConDocente,
    asistencias: {},
    docentes,
    listaEspera: [
      {
        id: 'espera-1',
        nombre: 'Carolina Méndez',
        edad: 8,
        telefono: '11 7000-1001',
        claseId: 'mar-1100',
        fechaSolicitud: '2026-08-10',
        estado: 'esperando',
        notas: 'Prefiere turno de mañana.',
      },
      {
        id: 'espera-2',
        nombre: 'Ramiro Acosta',
        edad: 67,
        telefono: '11 7000-1002',
        claseId: 'sab-0900',
        fechaSolicitud: '2026-08-11',
        estado: 'contactado',
        notas: '',
      },
    ],
  }
}
