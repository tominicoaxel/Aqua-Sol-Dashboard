// ─── Los cuatro estados de un pedido de lugar ───────────────────────────────
// Viven en una biblioteca y no adentro del panel porque los usa también la
// descarga del mes (`exportar.js`), y un lib que importe una pantalla se lleva la
// pantalla entera al chunk. Es el mismo criterio de `estados.js` con los estados
// de cuota: el color acompaña a la etiqueta, nunca viaja solo.
//
// El orden es el del recorrido real de un pedido: espera, la llaman, entra o se
// da de baja. Es el orden en que se ofrecen en el formulario.
export const ESTADOS_ESPERA = {
  esperando: { etiqueta: 'Esperando', clase: 'bg-sol/15 text-sol-tinta ring-sol/30' },
  contactado: { etiqueta: 'Contactado', clase: 'bg-cloro/15 text-cloro-tinta ring-cloro/25' },
  ingreso: { etiqueta: 'Ingresó', clase: 'bg-exito/15 text-exito-tinta ring-exito/25' },
  baja: { etiqueta: 'Baja', clase: 'bg-error/10 text-error-tinta ring-error/20' },
}

/** Quien todavía puede entrar: pidió el lugar y no se dio de baja ni ingresó. Es
 *  el número que contesta "¿cuánta gente estoy debiendo?". */
export const SIGUE_ESPERANDO = ['esperando', 'contactado']
