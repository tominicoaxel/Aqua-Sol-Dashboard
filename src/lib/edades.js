export const GRUPOS_EDAD_ESPERA = [
  { id: '6-8', etiqueta: 'De 6 a 8 años', desde: 6, hasta: 8 },
  { id: '9-12', etiqueta: 'De 9 a 12 años', desde: 9, hasta: 12 },
  { id: '13-18', etiqueta: 'De 13 a 18 años', desde: 13, hasta: 18 },
  { id: 'mayores-65', etiqueta: 'Mayores de 65 años', desde: 66, hasta: Infinity },
]

/** Devuelve el grupo de la lista de espera al que pertenece una edad.
 *  Las edades que no forman parte de los grupos pedidos quedan sin grupo. */
export function grupoEdadEspera(edad) {
  const numero = Number(edad)
  if (!Number.isInteger(numero)) return null
  return GRUPOS_EDAD_ESPERA.find((grupo) => numero >= grupo.desde && numero <= grupo.hasta) ?? null
}
