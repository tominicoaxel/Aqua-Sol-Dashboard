// ─── Métodos de cobro ───────────────────────────────────────────────────────
// Las transferencias entran a seis cuentas: tres billeteras (Mercado Pago, Naranja
// X y BBVA) por cada uno de los dos titulares. El efectivo no tiene cuenta, tiene
// número de recibo.
//
// El desglose del mes se arma por TITULAR y no por billetera, porque la pregunta
// que ella se hace es "cuánto le entró a cada uno", no "cuánto entró por cada app".
// El detalle por cuenta queda disponible igual, un nivel más abajo.

export const METODOS = [
  { id: 'transferencia', etiqueta: 'Transferencia' },
  { id: 'efectivo', etiqueta: 'Efectivo' },
]

export const CUENTAS = [
  { id: 'mp-moni', etiqueta: 'MP Moni', billetera: 'MP', titular: 'Moni' },
  { id: 'nx-moni', etiqueta: 'NX Moni', billetera: 'NX', titular: 'Moni' },
  { id: 'bbva-moni', etiqueta: 'BBVA Moni', billetera: 'BBVA', titular: 'Moni' },
  { id: 'mp-ser', etiqueta: 'MP Ser', billetera: 'MP', titular: 'Sergio' },
  { id: 'nx-ser', etiqueta: 'NX Ser', billetera: 'NX', titular: 'Sergio' },
  { id: 'bbva-ser', etiqueta: 'BBVA Ser', billetera: 'BBVA', titular: 'Sergio' },
]

export const TITULARES = ['Moni', 'Sergio']

export const cuentaPorId = (id) => CUENTAS.find((c) => c.id === id)

/** Cómo se lee un pago en el historial: "Transferencia — MP Moni" o
 *  "Efectivo — Recibo 0043".
 *
 *  Tolera los pagos viejos, de antes de que existiera este detalle: los del demo
 *  original solo tenían `medio`. Antes que mostrar "undefined" se muestra lo que
 *  haya. */
export function descripcionPago(pago) {
  if (!pago) return ''
  if (pago.metodo === 'transferencia') {
    const cuenta = cuentaPorId(pago.cuenta)
    return cuenta ? `Transferencia — ${cuenta.etiqueta}` : 'Transferencia'
  }
  if (pago.metodo === 'efectivo') {
    return pago.recibo ? `Efectivo — Recibo ${pago.recibo}` : 'Efectivo'
  }
  return pago.medio || 'Sin detalle'
}

const mismoMes = (fecha, referencia) =>
  fecha.getFullYear() === referencia.getFullYear() && fecha.getMonth() === referencia.getMonth()

/** Lo cobrado en el mes, partido por destino. Es la cuenta que hoy hace a mano en
 *  el Excel al final de cada mes. */
export function cobradoDelMes(clientes, referencia = new Date()) {
  const porTitular = Object.fromEntries(TITULARES.map((t) => [t, 0]))
  const porCuenta = Object.fromEntries(CUENTAS.map((c) => [c.id, 0]))
  let efectivo = 0
  let otros = 0
  let total = 0
  let cantidad = 0

  for (const cliente of clientes) {
    for (const pago of cliente.historial ?? []) {
      if (!(pago.fecha instanceof Date) || !mismoMes(pago.fecha, referencia)) continue
      const monto = Number(pago.monto) || 0
      total += monto
      cantidad++

      if (pago.metodo === 'efectivo') {
        efectivo += monto
        continue
      }
      const cuenta = cuentaPorId(pago.cuenta)
      if (pago.metodo === 'transferencia' && cuenta) {
        porCuenta[cuenta.id] += monto
        porTitular[cuenta.titular] += monto
      } else {
        otros += monto
      }
    }
  }

  return { porTitular, porCuenta, efectivo, otros, total, cantidad }
}
