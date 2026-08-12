// ─── DATOS DE EJEMPLO — HORARIOS ────────────────────────────────────────────
// Los horarios son FIJOS por semana: cada combinación de día + hora tiene siempre
// el mismo grupo asignado, que viene todas las semanas. No es una lista distinta
// cada día. La vista "HOY" no hace más que filtrar esta grilla por el día actual.
//
// `dia` sigue la convención de Date.getDay(): 0 domingo … 6 sábado.
// `participantes` son IDs de `mockClientes.js` — coinciden a propósito, para poder
// cruzar la info en las dos direcciones (quién viene a esta clase / a qué clases va
// esta persona).
//
// Forma: { id, dia, hora, duracion, actividad, profe, cupo, participantes: [id] }

export const horarios = [
  // ── Lunes ────────────────────────────────────────────────────────────────
  { id: 'lun-0800', dia: 1, hora: '08:00', duracion: 50, actividad: 'Aquagym',           profe: 'Paula Ríos',    cupo: 6, participantes: [1, 3, 7, 14, 17] },
  { id: 'lun-1000', dia: 1, hora: '10:00', duracion: 45, actividad: 'Natación Adultos',  profe: 'Diego Ferrari', cupo: 5, participantes: [2, 4, 9, 12] },
  { id: 'lun-1700', dia: 1, hora: '17:00', duracion: 45, actividad: 'Natación Niños',    profe: 'Sol Medina',    cupo: 6, participantes: [6, 11, 15, 16, 18] },
  { id: 'lun-1900', dia: 1, hora: '19:00', duracion: 50, actividad: 'Aquagym',           profe: 'Paula Ríos',    cupo: 6, participantes: [5, 10, 13, 20] },

  // ── Martes ───────────────────────────────────────────────────────────────
  { id: 'mar-0900', dia: 2, hora: '09:00', duracion: 40, actividad: 'Hidroterapia',      profe: 'Marcos Leiva',  cupo: 4, participantes: [5, 13, 20] },
  { id: 'mar-1100', dia: 2, hora: '11:00', duracion: 45, actividad: 'Natación Adultos',  profe: 'Diego Ferrari', cupo: 5, participantes: [2, 4, 9, 12, 17] },
  { id: 'mar-1600', dia: 2, hora: '16:00', duracion: 30, actividad: 'Clases Particulares', profe: 'Diego Ferrari', cupo: 1, participantes: [8] },
  { id: 'mar-1830', dia: 2, hora: '18:30', duracion: 45, actividad: 'Natación Niños',    profe: 'Sol Medina',    cupo: 6, participantes: [6, 11, 15, 16] },

  // ── Miércoles ────────────────────────────────────────────────────────────
  { id: 'mie-0800', dia: 3, hora: '08:00', duracion: 50, actividad: 'Aquagym',           profe: 'Paula Ríos',    cupo: 6, participantes: [1, 3, 7, 14, 17] },
  { id: 'mie-1000', dia: 3, hora: '10:00', duracion: 45, actividad: 'Natación Adultos',  profe: 'Diego Ferrari', cupo: 5, participantes: [2, 4, 9, 12] },
  { id: 'mie-1700', dia: 3, hora: '17:00', duracion: 45, actividad: 'Natación Niños',    profe: 'Sol Medina',    cupo: 6, participantes: [6, 11, 15, 16, 18] },
  { id: 'mie-1900', dia: 3, hora: '19:00', duracion: 50, actividad: 'Aquagym',           profe: 'Paula Ríos',    cupo: 6, participantes: [5, 10, 13, 20] },

  // ── Jueves ───────────────────────────────────────────────────────────────
  { id: 'jue-0900', dia: 4, hora: '09:00', duracion: 40, actividad: 'Hidroterapia',      profe: 'Marcos Leiva',  cupo: 4, participantes: [5, 13, 20] },
  { id: 'jue-1100', dia: 4, hora: '11:00', duracion: 45, actividad: 'Natación Adultos',  profe: 'Diego Ferrari', cupo: 5, participantes: [2, 4, 9, 12, 17] },
  { id: 'jue-1600', dia: 4, hora: '16:00', duracion: 30, actividad: 'Clases Particulares', profe: 'Diego Ferrari', cupo: 1, participantes: [19] },
  { id: 'jue-1830', dia: 4, hora: '18:30', duracion: 45, actividad: 'Natación Niños',    profe: 'Sol Medina',    cupo: 6, participantes: [6, 11, 15, 16] },

  // ── Viernes ──────────────────────────────────────────────────────────────
  { id: 'vie-0800', dia: 5, hora: '08:00', duracion: 50, actividad: 'Aquagym',           profe: 'Paula Ríos',    cupo: 6, participantes: [1, 3, 7, 14, 17] },
  { id: 'vie-1000', dia: 5, hora: '10:00', duracion: 45, actividad: 'Natación Adultos',  profe: 'Diego Ferrari', cupo: 5, participantes: [2, 4, 9, 12] },
  { id: 'vie-1700', dia: 5, hora: '17:00', duracion: 45, actividad: 'Natación Niños',    profe: 'Sol Medina',    cupo: 6, participantes: [6, 11, 15, 16, 18] },
  { id: 'vie-1900', dia: 5, hora: '19:00', duracion: 40, actividad: 'Hidroterapia',      profe: 'Marcos Leiva',  cupo: 4, participantes: [5, 13] },

  // ── Sábado ───────────────────────────────────────────────────────────────
  { id: 'sab-0900', dia: 6, hora: '09:00', duracion: 45, actividad: 'Natación Niños',    profe: 'Sol Medina',    cupo: 8, participantes: [6, 11, 15, 16, 18] },
  { id: 'sab-1030', dia: 6, hora: '10:30', duracion: 50, actividad: 'Aquagym',           profe: 'Paula Ríos',    cupo: 6, participantes: [1, 3, 7, 10, 14, 17] },
  { id: 'sab-1200', dia: 6, hora: '12:00', duracion: 30, actividad: 'Clases Particulares', profe: 'Diego Ferrari', cupo: 2, participantes: [8, 19] },
]

export default horarios
