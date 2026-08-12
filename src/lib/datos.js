// Derivación de datos. Todo acá es una función PURA: recibe los datos crudos (la
// misma forma que devolvería una API) y devuelve los datos ya listos para pintar,
// con estado, días para vencer, antigüedad y cupo calculados.
//
// Antes esto se calculaba una sola vez al importar. Ahora que los datos se editan
// desde la app, la derivación tiene que poder volver a correr con cada cambio, así
// que no guarda nada: el estado vive en `store.jsx` y esto solo lo transforma.

import { hoy, parseISO, diasEntre } from './fechas.js'
import { estadoDeDias, ORDEN_ESTADOS } from './estados.js'

export function derivarClientes(crudos) {
  const HOY = hoy()
  return crudos.map((c) => {
    const vence = parseISO(c.fechaVencimiento)
    const alta = parseISO(c.fechaAlta)
    const diasParaVencer = diasEntre(HOY, vence)
    return {
      ...c,
      vence,
      pago: parseISO(c.fechaPago),
      alta,
      diasParaVencer,
      antiguedadDias: diasEntre(alta, HOY),
      estado: estadoDeDias(diasParaVencer),
      historial: [...c.historialPagos]
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .map((p) => ({ ...p, fecha: parseISO(p.fecha) })),
    }
  })
}

export function derivarHorarios(crudos, porId) {
  return crudos.map((h) => ({
    ...h,
    ocupados: h.participantes.length,
    lleno: h.participantes.length >= h.cupo,
    grupo: h.participantes.map((id) => porId.get(id)).filter(Boolean),
  }))
}

/** Las clases de un día (0 domingo … 6 sábado), ordenadas por hora. */
export function horariosDelDia(horarios, dia) {
  return horarios.filter((h) => h.dia === dia).sort((a, b) => a.hora.localeCompare(b.hora))
}

/** La otra dirección del cruce: a qué clases va una persona. */
export function horariosDeCliente(horarios, id) {
  return horarios
    .filter((h) => h.participantes.includes(id))
    .sort((a, b) => a.dia - b.dia || a.hora.localeCompare(b.hora))
}

export function conteoPorEstado(clientes) {
  const conteo = { 'al-dia': 0, 'por-vencer': 0, vencido: 0 }
  for (const c of clientes) conteo[c.estado]++
  return conteo
}

export function resumenDelDia(horarios, dia) {
  const delDia = horariosDelDia(horarios, dia)
  return {
    clases: delDia.length,
    ocupados: delDia.reduce((a, h) => a + h.ocupados, 0),
    cupo: delDia.reduce((a, h) => a + h.cupo, 0),
    llenas: delDia.filter((h) => h.lleno).length,
  }
}

/** Vencidos y por vencer primero, y dentro de cada grupo el más urgente arriba. */
export function ordenarPorUrgencia(lista) {
  return [...lista].sort(
    (a, b) =>
      ORDEN_ESTADOS.indexOf(a.estado) - ORDEN_ESTADOS.indexOf(b.estado) ||
      a.diasParaVencer - b.diasParaVencer ||
      a.nombre.localeCompare(b.nombre, 'es'),
  )
}
