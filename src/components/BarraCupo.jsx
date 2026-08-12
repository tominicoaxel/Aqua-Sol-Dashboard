/** Medidor de cupo: barra fina, parte-sobre-total, con el dato en mono al lado.
 *  Una clase llena se marca en Agua Profunda y no con un color de estado: llenarse
 *  es bueno, no es una alarma, y los colores de estado están reservados para la
 *  situación de pago. */
export default function BarraCupo({ ocupados, cupo, mostrarNumero = true, className = '' }) {
  const pct = cupo > 0 ? Math.min(100, (ocupados / cupo) * 100) : 0
  const lleno = ocupados >= cupo

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-borde">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${lleno ? 'bg-agua' : 'bg-cloro'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {mostrarNumero && (
        <span className="dato shrink-0 text-xs font-medium text-tinta-2">
          {ocupados}/{cupo}
        </span>
      )}
      <span className="sr-only">{ocupados} de {cupo} lugares ocupados</span>
    </div>
  )
}
