// ─── DATOS DE EJEMPLO — CLIENTES ────────────────────────────────────────────
// Este archivo es el punto de reemplazo: cuando haya datos reales, lo único que
// tiene que sobrevivir es la FORMA de cada cliente (el objeto de abajo). Nada de
// `src/` importa acá adentro salvo el export final, y este archivo no importa nada
// de la app, así que se puede tirar entero y reemplazar por un fetch.
//
// Forma de un cliente:
//   { id, nombre, telefono, plan, cuota, responsable?,
//     fechaAlta, fechaPago, fechaVencimiento,   ← "AAAA-MM-DD"
//     historialPagos: [{ fecha, monto, metodo, cuenta? , recibo? }] }
//   metodo: 'transferencia' (con `cuenta`) o 'efectivo' (con `recibo`)
//
// Las fechas se generan RELATIVAS al día en que se abre el demo (ver `venceEnDias`)
// para que la pantalla cuente la misma historia hoy que dentro de tres meses.

const fmt = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const desdeHoy = (dias) => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + dias)
  return fmt(d)
}

// Las seis cuentas de transferencia (tres billeteras por cada titular) más el
// efectivo. Se reparten de forma determinística para que el desglose del mes tenga
// algo que mostrar desde el arranque.
const CUENTAS = ['mp-moni', 'nx-moni', 'bbva-moni', 'mp-ser', 'nx-ser', 'bbva-ser']

/** Historial mensual hacia atrás desde el último pago. Los montos viejos bajan un
 *  poco (los precios subieron), y todo es determinístico: mismo cliente, mismo
 *  historial en cada render. */
function generarHistorial(venceEnDias, diasComoCliente, cuota, semilla) {
  const pagos = []
  const cantidad = Math.min(6, Math.max(1, Math.floor(diasComoCliente / 30)))
  for (let i = 0; i < cantidad; i++) {
    const monto = Math.round((cuota * Math.pow(0.93, i)) / 500) * 500
    // Reparto determinístico entre efectivo y las seis cuentas. Va por una mezcla
    // no lineal y no por `semilla % 6`: los pocos clientes cuyo último pago cae en
    // el mes en curso tienen semillas que ya vienen agrupadas, y cualquier resto
    // lineal las mantiene juntas — el desglose del mes arrancaría con la mitad de
    // las cuentas en cero.
    const mezcla = (n) => {
      n = (n ^ 61) ^ (n >>> 16)
      n = n + (n << 3)
      n = n ^ (n >>> 4)
      n = Math.imul(n, 0x27d4eb2d)
      return (n ^ (n >>> 15)) >>> 0
    }
    const enEfectivo = mezcla(semilla * 13 + i * 101) % 5 === 0
    pagos.push({
      id: `pago-${semilla}-${i}`,
      fecha: desdeHoy(venceEnDias - 30 - i * 30),
      monto,
      ...(enEfectivo
        ? { metodo: 'efectivo', recibo: String(1000 + semilla * 7 + i * 3).padStart(4, '0') }
        : { metodo: 'transferencia', cuenta: CUENTAS[mezcla(semilla + i * 37) % CUENTAS.length] }),
    })
  }
  return pagos
}

// venceEnDias:  negativo = ya venció · 0 a 7 = por vencer · más de 7 = al día
// antiguedad:   días desde que es cliente
const base = [
  { id: 1,  nombre: 'Valentina Suárez',   telefono: '11 5487-2310', plan: 'Aquagym 3x',            cuota: 42000, venceEnDias: 14,  antiguedad: 420 },
  { id: 2,  nombre: 'Martín Gómez',       telefono: '11 6032-8874', plan: 'Natación Adultos 3x',   cuota: 48000, venceEnDias: 3,   antiguedad: 240 },
  { id: 3,  nombre: 'Sofía Ferreyra',     telefono: '11 3391-5566', plan: 'Aquagym 3x',            cuota: 42000, venceEnDias: -12, antiguedad: 610 },
  { id: 4,  nombre: 'Joaquín Peralta',    telefono: '11 2247-9013', plan: 'Natación Adultos 3x',   cuota: 48000, venceEnDias: 21,  antiguedad: 95  },
  { id: 5,  nombre: 'Camila Ibarra',      telefono: '11 5570-4482', plan: 'Hidroterapia 2x',       cuota: 56000, venceEnDias: 5,   antiguedad: 180 },
  { id: 6,  nombre: 'Lucas Quiroga',      telefono: '11 6684-1129', plan: 'Natación Niños 3x',     cuota: 38000, venceEnDias: 9,   antiguedad: 300, responsable: 'Marina Quiroga (mamá)' },
  { id: 7,  nombre: 'Julieta Moyano',     telefono: '11 4419-7735', plan: 'Aquagym 3x',            cuota: 42000, venceEnDias: -3,  antiguedad: 730 },
  { id: 8,  nombre: 'Nicolás Bustos',     telefono: '11 3128-6690', plan: 'Clases Particulares',   cuota: 82000, venceEnDias: 27,  antiguedad: 55  },
  { id: 9,  nombre: 'Agustina Ledesma',   telefono: '11 5903-2214', plan: 'Natación Adultos 3x',   cuota: 48000, venceEnDias: 0,   antiguedad: 365 },
  { id: 10, nombre: 'Facundo Ríos',       telefono: '11 2765-3348', plan: 'Aquagym 2x',            cuota: 34000, venceEnDias: 18,  antiguedad: 145 },
  { id: 11, nombre: 'Micaela Sosa',       telefono: '11 6011-9927', plan: 'Natación Niños 3x',     cuota: 38000, venceEnDias: 7,   antiguedad: 210, responsable: 'Gabriel Sosa (papá)' },
  { id: 12, nombre: 'Tomás Aguirre',      telefono: '11 4482-0071', plan: 'Natación Adultos 3x',   cuota: 48000, venceEnDias: -23, antiguedad: 500 },
  { id: 13, nombre: 'Rocío Maldonado',    telefono: '11 5346-8802', plan: 'Hidroterapia 2x',       cuota: 56000, venceEnDias: 11,  antiguedad: 88  },
  { id: 14, nombre: 'Federico Ponce',     telefono: '11 3874-1150', plan: 'Aquagym 3x',            cuota: 42000, venceEnDias: 25,  antiguedad: 640 },
  { id: 15, nombre: 'Brenda Cabrera',     telefono: '11 6259-7743', plan: 'Natación Niños 3x',     cuota: 38000, venceEnDias: 2,   antiguedad: 130, responsable: 'Vanina Cabrera (mamá)' },
  { id: 16, nombre: 'Benjamín Vera',      telefono: '11 2930-5518', plan: 'Natación Niños 3x',     cuota: 38000, venceEnDias: 34,  antiguedad: 40,  responsable: 'Ezequiel Vera (papá)' },
  { id: 17, nombre: 'Guadalupe Ojeda',    telefono: '11 5128-6674', plan: 'Aquagym 3x',            cuota: 42000, venceEnDias: -1,  antiguedad: 275 },
  { id: 18, nombre: 'Emma Correa',        telefono: '11 4703-2295', plan: 'Natación Niños 2x',     cuota: 30000, venceEnDias: 16,  antiguedad: 70,  responsable: 'Carla Correa (mamá)' },
  { id: 19, nombre: 'Malena Figueroa',    telefono: '11 6845-3306', plan: 'Clases Particulares',   cuota: 82000, venceEnDias: 23,  antiguedad: 195 },
  { id: 20, nombre: 'Ariel Zabala',       telefono: '11 3057-9948', plan: 'Hidroterapia 2x',       cuota: 56000, venceEnDias: 29,  antiguedad: 810 },
]

export const clientes = base.map((c, i) => ({
  id: c.id,
  nombre: c.nombre,
  telefono: c.telefono,
  plan: c.plan,
  cuota: c.cuota,
  ...(c.responsable ? { responsable: c.responsable } : {}),
  fechaAlta: desdeHoy(-c.antiguedad),
  fechaPago: desdeHoy(c.venceEnDias - 30),
  fechaVencimiento: desdeHoy(c.venceEnDias),
  historialPagos: generarHistorial(c.venceEnDias, c.antiguedad, c.cuota, i),
}))

export default clientes
