// Regla de estados (el supuesto declarado en el brief — está en UN solo lugar para
// que cambiar el umbral sea cambiar este número y nada más):
//   al día     → vence en MÁS de 7 días
//   por vencer → vence dentro de los próximos 7 días (incluido hoy)
//   vencido    → la fecha ya pasó
export const UMBRAL_POR_VENCER = 7

export function estadoDeDias(diasParaVencer) {
  if (diasParaVencer < 0) return 'vencido'
  if (diasParaVencer <= UMBRAL_POR_VENCER) return 'por-vencer'
  return 'al-dia'
}

// Cada estado carga su color vivo (marca: puntos, barras, fills) y su tinta oscura
// (texto). El color nunca viaja solo: `etiqueta` siempre se escribe al lado, así el
// estado se lee igual en blanco y negro, con daltonismo o en una captura mala de
// WhatsApp.
export const ESTADOS = {
  'al-dia': {
    id: 'al-dia',
    etiqueta: 'Al día',
    titulo: 'Al día',
    descripcion: 'Vencen en más de una semana',
    hex: '#4CA771',
    punto: 'bg-exito',
    texto: 'text-exito-tinta',
    chip: 'bg-exito/12 text-exito-tinta ring-1 ring-exito/25',
    barra: 'bg-exito',
    orden: 2,
  },
  'por-vencer': {
    id: 'por-vencer',
    etiqueta: 'Por vencer',
    titulo: 'Por vencer',
    descripcion: 'Vencen dentro de los próximos 7 días',
    hex: '#F2A541',
    punto: 'bg-alerta',
    texto: 'text-alerta-tinta',
    chip: 'bg-alerta/16 text-alerta-tinta ring-1 ring-alerta/35',
    barra: 'bg-alerta',
    orden: 1,
  },
  vencido: {
    id: 'vencido',
    etiqueta: 'Vencido',
    titulo: 'Vencidos',
    descripcion: 'La fecha de pago ya pasó',
    hex: '#E15554',
    punto: 'bg-error',
    texto: 'text-error-tinta',
    chip: 'bg-error/12 text-error-tinta ring-1 ring-error/30',
    barra: 'bg-error',
    orden: 0,
  },
}

/** Orden de lectura para el tablero: primero lo que la apura. */
export const ORDEN_ESTADOS = ['vencido', 'por-vencer', 'al-dia']
