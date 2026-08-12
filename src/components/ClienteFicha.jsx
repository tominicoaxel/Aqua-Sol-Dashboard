import { useEffect, useState } from 'react'
import { ESTADOS } from '../lib/estados.js'
import { horariosDeCliente } from '../lib/datos.js'
import {
  formatoFecha,
  textoVencimiento,
  textoAntiguedad,
  formatoMonto,
  nombreDia,
  parseISO,
} from '../lib/fechas.js'
import { isoDeHoy, useDatos, vencimientoPara } from '../lib/store.jsx'
import { CUENTAS, METODOS, TITULARES, descripcionPago } from '../lib/pagos.js'
import Boton from './Boton.jsx'
import Campo from './Campo.jsx'
import Hoja from './Hoja.jsx'

function Dato({ etiqueta, children, className = '' }) {
  return (
    <div className={className}>
      <dt className="text-[11px] tracking-wide text-tinta-3 uppercase">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm text-tinta">{children}</dd>
    </div>
  )
}

function Seccion({ titulo, children, extra }) {
  return (
    <section className="mt-6 first:mt-0">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="font-titulo text-xs font-semibold tracking-wide text-tinta-2 uppercase">{titulo}</h3>
        {extra}
      </div>
      {children}
    </section>
  )
}

/** Un vencimiento anterior al pago no es un caso raro, es un error de tipeo. Se
 *  avisa al salir del campo y no recién al confirmar, para no hacer completar todo
 *  el formulario para después rebotarlo. */
const errorDeFechas = (pago, vencimiento) => {
  if (!pago || !vencimiento) return 'Completá las dos fechas.'
  if (vencimiento < pago) return 'El vencimiento no puede ser anterior a la fecha de pago.'
  return null
}

/** Registrar un pago. Además de mover las fechas, asienta el pago en el historial:
 *  si la ficha mostrara arriba un pago que abajo no figura, el número dejaría de
 *  ser confiable. */
function FormularioPago({ cliente, onConfirmar, onCancelar }) {
  const hoyISO = isoDeHoy()
  const [fecha, setFecha] = useState(hoyISO)
  const [vencimiento, setVencimiento] = useState(() => vencimientoPara(hoyISO))
  const [vencManual, setVencManual] = useState(false)
  const [monto, setMonto] = useState(String(cliente.cuota))
  const [metodo, setMetodo] = useState('transferencia')
  const [cuenta, setCuenta] = useState(CUENTAS[0].id)
  const [recibo, setRecibo] = useState('')
  const [tocado, setTocado] = useState(false)

  // Al cambiar de método se limpia el dato del otro. Si no, alguien tipea un
  // recibo, se da cuenta de que fue transferencia, cambia — y el recibo viejo se
  // guardaría igual, contradiciendo al método.
  const cambiarMetodo = (nuevo) => {
    setMetodo(nuevo)
    if (nuevo === 'transferencia') setRecibo('')
    else setCuenta(CUENTAS[0].id)
  }

  // Mientras no la corrijan a mano, la fecha de vencimiento sigue a la de pago.
  const cambiarFecha = (valor) => {
    setFecha(valor)
    if (!vencManual && valor) setVencimiento(vencimientoPara(valor))
  }

  const errorFechas = errorDeFechas(fecha, vencimiento)
  const errorMonto = Number(monto) > 0 ? null : 'Poné un importe mayor a cero.'
  const invalido = Boolean(errorFechas || errorMonto)

  return (
    <form
      className="anim-subir rounded-2xl border border-cloro/40 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault()
        setTocado(true)
        if (invalido) return
        onConfirmar({
          fecha,
          vencimiento,
          monto: Number(monto),
          metodo,
          ...(metodo === 'transferencia' ? { cuenta } : { recibo: recibo.trim() }),
        })
      }}
    >
      <h4 className="font-titulo text-xs font-semibold tracking-wide text-tinta-2 uppercase">
        Registrar un pago
      </h4>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Campo etiqueta="Fecha de pago" error={tocado && !fecha ? 'Falta la fecha.' : null}>
          {(p) => <input {...p} type="date" value={fecha} onChange={(e) => cambiarFecha(e.target.value)} onBlur={() => setTocado(true)} />}
        </Campo>

        <Campo
          etiqueta="Vence el"
          ayuda={vencManual ? 'Editado a mano' : 'Un mes después'}
          error={tocado ? errorFechas : null}
        >
          {(p) => (
            <input
              {...p}
              type="date"
              value={vencimiento}
              onChange={(e) => {
                setVencManual(true)
                setVencimiento(e.target.value)
              }}
              onBlur={() => setTocado(true)}
            />
          )}
        </Campo>

        <Campo etiqueta="Importe" ayuda={`Cuota: ${formatoMonto(cliente.cuota)}`} error={tocado ? errorMonto : null}>
          {(p) => (
            <input
              {...p}
              type="number"
              inputMode="numeric"
              min="0"
              step="500"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              onBlur={() => setTocado(true)}
              className={`${p.className} dato`}
            />
          )}
        </Campo>

      </div>

      {/* Método como dos botones y no como lista desplegable: son dos opciones, se
          ven las dos de una y el dedo tiene dónde caer. */}
      <fieldset className="mt-3">
        <legend className="text-xs font-medium text-tinta-2">Método de pago</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {METODOS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => cambiarMetodo(m.id)}
              aria-pressed={metodo === m.id}
              className={`min-h-11 rounded-xl border px-3 text-sm font-medium transition ${
                metodo === m.id
                  ? 'border-agua bg-agua text-white'
                  : 'border-borde bg-white text-tinta-2 hover:border-cloro/60'
              }`}
            >
              {m.etiqueta}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Un campo o el otro, nunca los dos */}
      {metodo === 'transferencia' ? (
        <Campo etiqueta="¿A qué cuenta entró?" className="mt-3">
          {(p) => (
            <select {...p} value={cuenta} onChange={(e) => setCuenta(e.target.value)}>
              {TITULARES.map((titular) => (
                <optgroup key={titular} label={titular}>
                  {CUENTAS.filter((c) => c.titular === titular).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.etiqueta}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
        </Campo>
      ) : (
        <Campo etiqueta="Número de recibo" ayuda="Opcional — si no lo tenés a mano, se puede cargar después" className="mt-3">
          {(p) => (
            <input
              {...p}
              type="text"
              inputMode="numeric"
              value={recibo}
              onChange={(e) => setRecibo(e.target.value)}
              placeholder="0043"
              className={`${p.className} dato`}
            />
          )}
        </Campo>
      )}

      <div className="mt-4 flex gap-2">
        <Boton variante="primario" type="submit" disabled={tocado && invalido}>
          Confirmar pago
        </Boton>
        <Boton variante="secundario" onClick={onCancelar}>
          Cancelar
        </Boton>
      </div>
    </form>
  )
}

/** Corrección de fechas para los casos especiales: un descuento, un pago que entró
 *  con otra fecha, un arreglo particular. No asienta nada en el historial porque no
 *  es un pago nuevo, es un ajuste del que ya estaba. */
function FormularioFechas({ cliente, onConfirmar, onCancelar }) {
  const [pago, setPago] = useState(cliente.fechaPago)
  const [vencimiento, setVencimiento] = useState(cliente.fechaVencimiento)
  const [tocado, setTocado] = useState(false)

  const error = errorDeFechas(pago, vencimiento)

  return (
    <form
      className="anim-subir rounded-2xl border border-borde bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault()
        setTocado(true)
        if (error) return
        onConfirmar({ fechaPago: pago, fechaVencimiento: vencimiento })
      }}
    >
      <h4 className="font-titulo text-xs font-semibold tracking-wide text-tinta-2 uppercase">
        Corregir las fechas
      </h4>
      <p className="mt-1 text-[11px] leading-relaxed text-tinta-3">
        Cambia solo las fechas y el estado que se calcula con ellas. No suma un pago al historial.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Campo etiqueta="Último pago">
          {(p) => <input {...p} type="date" value={pago} onChange={(e) => setPago(e.target.value)} onBlur={() => setTocado(true)} />}
        </Campo>
        <Campo etiqueta="Vence el" error={tocado ? error : null}>
          {(p) => (
            <input
              {...p}
              type="date"
              value={vencimiento}
              onChange={(e) => setVencimiento(e.target.value)}
              onBlur={() => setTocado(true)}
            />
          )}
        </Campo>
      </div>

      <div className="mt-4 flex gap-2">
        <Boton variante="primario" type="submit" disabled={tocado && Boolean(error)}>
          Guardar fechas
        </Boton>
        <Boton variante="secundario" onClick={onCancelar}>
          Cancelar
        </Boton>
      </div>
    </form>
  )
}

export default function ClienteFicha({ clienteId, onCerrar, onAbrirClase }) {
  const { clientePorId, horarios, registrarPago, editarFechas, avisar } = useDatos()
  const [modo, setModo] = useState(null)

  // Cambiar de cliente cierra cualquier formulario que hubiera quedado abierto, para
  // no registrarle a alguien un pago que se estaba escribiendo para otra persona.
  useEffect(() => setModo(null), [clienteId])

  const cliente = clienteId ? clientePorId(clienteId) : null
  if (!cliente) return null

  const e = ESTADOS[cliente.estado]
  const clases = horariosDeCliente(horarios, cliente.id)

  const confirmarPago = (datos) => {
    registrarPago(cliente.id, datos)
    setModo(null)
    avisar(`Pago de ${cliente.nombre} registrado. Vence el ${formatoFecha(parseISO(datos.vencimiento))}.`)
  }

  const confirmarFechas = (datos) => {
    editarFechas(cliente.id, datos)
    setModo(null)
    avisar(`Actualizaste las fechas de ${cliente.nombre}.`)
  }

  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      titulo={`Ficha de ${cliente.nombre}`}
      encabezado={
        <div className="pr-10">
          <p className="dato text-[11px] tracking-widest text-cloro uppercase">Ficha de cliente</p>
          <h2 className="mt-1 font-titulo text-xl font-bold text-white">{cliente.nombre}</h2>
          <p className="mt-0.5 text-sm text-white/70">{cliente.plan}</p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
            <span className={`size-2 rounded-full ${e.punto}`} aria-hidden="true" />
            {e.etiqueta}
            <span className="text-white/60">· {textoVencimiento(cliente.diasParaVencer)}</span>
          </p>
        </div>
      }
    >
      <Seccion titulo="Contacto">
        <div className="rounded-2xl border border-borde bg-white p-4">
          <dl className="space-y-3">
            <Dato etiqueta="Teléfono">
              <a href={`tel:${cliente.telefono.replace(/\s|-/g, '')}`} className="dato text-cloro-tinta hover:underline">
                {cliente.telefono}
              </a>
            </Dato>
            {cliente.responsable && <Dato etiqueta="Responsable">{cliente.responsable}</Dato>}
            <Dato etiqueta="Cliente hace">
              <span className="dato">{textoAntiguedad(cliente.antiguedadDias)}</span>
              <span className="text-tinta-3"> · desde el </span>
              <span className="dato text-tinta-2">{formatoFecha(cliente.alta)}</span>
            </Dato>
          </dl>
        </div>
      </Seccion>

      <Seccion titulo="Cuota">
        <div className="rounded-2xl border border-borde bg-white p-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Dato etiqueta="Último pago">
              <span className="dato">{formatoFecha(cliente.pago)}</span>
            </Dato>
            <Dato etiqueta="Vence">
              <span className="dato">{formatoFecha(cliente.vence)}</span>
              <span className={`mt-0.5 block text-xs ${cliente.estado === 'al-dia' ? 'text-tinta-3' : e.texto}`}>
                {textoVencimiento(cliente.diasParaVencer)}
              </span>
            </Dato>
            <Dato etiqueta="Importe" className="col-span-2">
              <span className="dato text-lg font-bold text-agua">{formatoMonto(cliente.cuota)}</span>
              <span className="text-xs text-tinta-3"> por mes</span>
            </Dato>
          </dl>
        </div>

        {/* Los formularios aparecen recién cuando se los pide: la ficha se abre para
            consultar mucho más seguido de lo que se abre para editar. */}
        <div className="mt-3">
          {modo === 'pago' && (
            <FormularioPago cliente={cliente} onConfirmar={confirmarPago} onCancelar={() => setModo(null)} />
          )}
          {modo === 'fechas' && (
            <FormularioFechas cliente={cliente} onConfirmar={confirmarFechas} onCancelar={() => setModo(null)} />
          )}
          {modo === null && (
            <div className="flex flex-wrap gap-2">
              <Boton variante="primario" onClick={() => setModo('pago')}>
                <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3.5 8.5l3 3 6-6.5" />
                </svg>
                Registrar pago
              </Boton>
              <Boton variante="secundario" onClick={() => setModo('fechas')}>
                Corregir fechas
              </Boton>
            </div>
          )}
        </div>
      </Seccion>

      <Seccion titulo="Viene a estas clases" extra={<span className="dato text-xs text-tinta-3">{clases.length}</span>}>
        {clases.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-borde p-5 text-center">
            <p className="text-sm text-tinta">Todavía no está anotada en ningún horario</p>
            <p className="mt-1 text-xs text-tinta-3">
              Se la suma desde el detalle de la clase, en el panel de Horarios.
            </p>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-borde bg-white">
            {clases.map((h) => (
              <li key={h.id} className="border-b border-borde-suave last:border-0">
                <button
                  type="button"
                  onClick={() => onAbrirClase(h)}
                  className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-cloro/8"
                >
                  <span className="dato w-12 shrink-0 text-sm font-medium text-agua">{h.hora}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-tinta">{h.actividad}</span>
                    <span className="block text-xs text-tinta-3 capitalize">{nombreDia(h.dia)}</span>
                  </span>
                  <span className="dato shrink-0 text-xs text-tinta-3">
                    {h.ocupados}/{h.cupo}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion titulo="Historial de pagos" extra={<span className="dato text-[11px] text-tinta-3">{cliente.historial.length}</span>}>
        <div className="overflow-hidden rounded-2xl border border-borde bg-white">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-borde bg-espuma/70 text-[11px] tracking-wide text-tinta-3 uppercase">
                <th scope="col" className="px-4 py-2 font-medium">Fecha</th>
                <th scope="col" className="px-4 py-2 font-medium">Importe</th>
                <th scope="col" className="px-4 py-2 font-medium">Cómo pagó</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde-suave">
              {cliente.historial.map((p, i) => (
                <tr key={`${p.fecha.getTime()}-${i}`}>
                  <td className="dato px-4 py-2.5 text-sm text-tinta-2">{formatoFecha(p.fecha)}</td>
                  <td className="dato px-4 py-2.5 text-sm font-medium text-tinta">{formatoMonto(p.monto)}</td>
                  <td className="px-4 py-2.5 text-xs text-tinta-3">{descripcionPago(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>
    </Hoja>
  )
}
