# Prompt para Claude Design

> Copiá desde la línea de abajo hasta el final y pegalo. No hace falta adjuntar
> ningún archivo: el prompt tiene todo el contexto.

---

Necesito que diseñes la interfaz completa de **Pileta**, un panel de gestión para
una pileta privada. No es una landing ni un sitio de marketing: es la herramienta
con la que la dueña trabaja todos los días.

## Quién lo usa y cómo

Una mujer de unos 50 años que hoy lleva todo en Excel: quién le pagó, quién le
debe, quién viene a cada clase. No es técnica y se cansa del Excel. **Lo va a mirar
casi siempre desde el celular**, muchas veces parada al borde de la pileta con las
manos mojadas, entre clase y clase. También lo abre desde una notebook cuando se
sienta a hacer las cuentas del mes.

Eso define todo: tiene que poder responder "¿quién me debe?" en tres segundos, con
una mano, sin scrollear de más. La densidad es de tablero de trabajo, no de página
de producto.

## Las pantallas

### 1. Inicio — el resumen

Cuatro bloques, en este orden:

**Estado de pagos.** Tres números grandes, comparables entre sí de un vistazo:
- Vencidos: **4** de 20 clientes (20%)
- Por vencer esta semana: **5** de 20 (25%)
- Al día: **11** de 20 (55%)

Cada uno es clickeable y lleva a la lista ya filtrada por ese estado.

**Cobros del mes.** Lo que hoy calcula a mano en el Excel a fin de mes. Total
cobrado en agosto: **$440.000** en 8 pagos, desglosado por dónde entró la plata:
- Moni: $168.000 (repartido entre tres cuentas: MP Moni, NX Moni, BBVA Moni)
- Sergio: $98.000 (MP Ser, NX Ser, BBVA Ser)
- Efectivo: $132.000

**Las clases de hoy.** Martes 11 de agosto: 4 clases, 13 de 16 lugares ocupados.
La lista, cada una con su hora, actividad, profesor y cupo:
- 09:00 · Hidroterapia · Marcos Leiva · 3/4
- 11:00 · Natación Adultos · Diego Ferrari · 5/5 (completa)
- 16:00 · Clases Particulares · Diego Ferrari · 1/1 (completa)
- 18:30 · Natación Niños · Sol Medina · 4/6

**Accesos directos** a Clientes y a Horarios.

### 2. Clientes

Lista de 20 personas. Buscador por nombre, filtros por estado con su contador
(Todos 20 · Vencidos 4 · Por vencer 5 · Al día 11), y orden por urgencia o por
nombre. En escritorio es una tabla; en el celular, tarjetas.

Cada fila muestra: nombre, plan, estado con color, último pago, vencimiento (fecha
más "en 5 días" / "hace 12 días"), y hace cuánto es clienta.

Datos reales para que lo pueblen:

| Nombre | Plan | Estado | Último pago | Vence | Clienta hace |
|---|---|---|---|---|---|
| Tomás Aguirre | Natación Adultos 3x | vencido, hace 23 días | 19/06/2026 | 19/07/2026 | 1 año 4 meses |
| Sofía Ferreyra | Aquagym 3x | vencido, hace 12 días | 30/06/2026 | 30/07/2026 | 1 año 8 meses |
| Julieta Moyano | Aquagym 3x | vencido, hace 3 días | 09/07/2026 | 08/08/2026 | 2 años |
| Guadalupe Ojeda | Aquagym 3x | vencido, ayer | 11/07/2026 | 10/08/2026 | 9 meses |
| Agustina Ledesma | Natación Adultos 3x | vence hoy | 12/07/2026 | 11/08/2026 | 1 año |
| Brenda Cabrera | Natación Niños 3x | por vencer, en 2 días | 14/07/2026 | 13/08/2026 | 4 meses |
| Martín Gómez | Natación Adultos 3x | por vencer, en 3 días | 15/07/2026 | 14/08/2026 | 8 meses |
| Camila Ibarra | Hidroterapia 2x | por vencer, en 5 días | 17/07/2026 | 16/08/2026 | 6 meses |
| Micaela Sosa | Natación Niños 3x | por vencer, en 7 días | 19/07/2026 | 18/08/2026 | 7 meses |
| Lucas Quiroga | Natación Niños 3x | al día, en 9 días | 21/07/2026 | 20/08/2026 | 10 meses |
| Rocío Maldonado | Hidroterapia 2x | al día, en 11 días | 23/07/2026 | 22/08/2026 | 3 meses |
| Valentina Suárez | Aquagym 3x | al día, en 14 días | 26/07/2026 | 25/08/2026 | 1 año 2 meses |
| Facundo Ríos | Aquagym 2x | al día, en 18 días | 30/07/2026 | 29/08/2026 | 5 meses |
| Ariel Zabala | Hidroterapia 2x | al día, en 29 días | 10/08/2026 | 09/09/2026 | 2 años 3 meses |

Las cuotas van de $30.000 a $82.000 por mes.

### 3. Ficha de cliente

Se abre al tocar una fila. En el celular entra desde abajo como hoja; en
escritorio, desde la derecha como cajón. Adentro:

- Encabezado con el nombre, el plan y el estado
- Contacto: teléfono, y en el caso de los chicos, el adulto responsable
  ("Marina Quiroga (mamá)")
- Cuota: último pago, vencimiento, importe mensual
- Botones **Registrar pago** y **Corregir fechas**
- A qué clases viene (día, hora, actividad, cupo)
- Historial de pagos: fecha, importe, y cómo pagó
  ("Transferencia — BBVA Ser", "Efectivo — Recibo 0043")

### 4. Horarios

El horario es **fijo por semana**: cada día y hora tiene siempre el mismo grupo,
que viene todas las semanas. Selector de día (Lun a Sáb) que arranca en hoy, y las
clases de ese día en tarjetas con hora, actividad, profesor, medidor de cupo e
iniciales de los participantes.

### 5. Detalle de una clase

- Encabezado: Hidroterapia, martes 09:00, 40 min, Marcos Leiva, 3/4, 1 lugar libre
- Aviso si alguien del grupo debe: "1 de 3 personas de este grupo tiene la cuota
  vencida o por vencer"
- Lista de participantes: cada uno con un check para marcar que **se presentó**,
  sus iniciales, el nombre, cuándo vence su cuota y su estado
- Los lugares libres se muestran como huecos, no se dejan en blanco
- Botones para agregar participante, editar la clase y eliminarla

### 6. Importar desde Excel

Un asistente de cuatro pasos (subir → emparejar columnas → revisar → listo) para
que pueda migrar su planilla. Necesita: zona de arrastrar y soltar, indicador de
paso, una tabla de vista previa, y estados claros de carga, error y resultado.

## La identidad visual

Esta paleta viene del brief original y **se mantiene**. Podés extenderla con más
tonos, superficies o un modo oscuro, pero estos son los anclas:

- **Agua Profunda** `#0B4F6C` — principal, encabezados y navegación
- **Cloro** `#2EC4B6` — acento vivo, elementos activos
- **Sol** `#F2A541` — acento cálido, alertas de "por vencer"
- **Espuma** `#F5FAFA` — fondo general
- **Profundidad** `#0D2B33` — texto principal
- Estados: éxito `#4CA771` · alerta `#F2A541` · error `#E15554`

**Dato crítico de accesibilidad, ya medido:** esos colores vivos **no llegan a 3:1
de contraste sobre el fondo Espuma** (Sol da 2.0:1, Éxito 2.9:1, Cloro 2.1:1). No
pueden llevar información solos ni usarse en texto. La solución actual es un
segundo nivel de tintas oscuras verificadas para texto — Éxito `#276B47` (6.1:1),
Alerta `#8A5510` (5.9:1), Error `#A32B29` (6.8:1), Cloro `#16776E` (5.1:1) — y que
el estado **siempre se escriba además de pintarse**. Mantené ese principio; si
proponés otros valores, decime el ratio de cada uno.

**Tipografía:**
- Títulos: Space Grotesk
- Cuerpo: Inter
- Números, fechas, horas, cupos e importes: JetBrains Mono con cifras tabulares.
  Esto es funcional: hace que las columnas de fechas y plata se escaneen de arriba
  abajo sin leer fila por fila.

**Elemento de identidad:** un motivo de líneas de carril de pileta —rayas finas
alternadas, como las sogas con boyas vistas desde arriba— usado en **un solo lugar
bien resuelto**, no repetido por toda la pantalla.

## Prohibido

Estos son clichés de diseño generado con IA y el brief original los descartó de
entrada:

- Fondo crema + serif de alto contraste + acento terracota
- Fondo oscuro + verde ácido
- Layout tipo diario, con líneas finas y esquinas 100% rectas
- Tarjetas genéricas de ícono + número grande sin personalidad
- Gradientes violeta/azul tipo "producto de IA"
- Sombras negras genéricas: tintalas con el azul de la paleta
- Círculos con iniciales como avatar (es el default de todo dashboard generado)

Y estas dos, propias de este proyecto:

- **Nada de `py-24` a `py-40` entre secciones.** Es una herramienta, no una
  landing. El aire generoso acá se paga en scroll, y ella necesita ver mucha
  información junta.
- **Nada de animaciones de entrada al scrollear.** Esta app se abre veinte veces
  por día; una animación de 800ms deja de ser lujo y pasa a ser espera. Las
  transiciones van solo en respuesta a una acción, entre 150 y 300ms.

## Qué te pido que entregues

Un solo archivo HTML autocontenido (CSS embebido, sin dependencias externas salvo
las fuentes de Google) con:

1. **Un bloque `@theme` de Tailwind v4** al principio del CSS, con todos los tokens
   nombrados: colores, tipografías, sombras, curvas de animación. Este bloque lo
   voy a pegar tal cual en mi proyecto, así que que sea completo y coherente.

2. **Las 6 pantallas**, cada una a fidelidad de app real —no una lámina de
   presentación— con un selector arriba para cambiar entre ellas. Poblalas con los
   datos de arriba, no con texto de relleno.

3. **Cada pantalla mostrada en ancho de celular y de escritorio**, porque el 80%
   del uso es en teléfono y ahí es donde más fácil se rompe.

4. **Un comentario breve** al final explicando las decisiones: por qué esa
   jerarquía, qué hiciste con el motivo de carriles, y qué agregaste que yo no
   pedí y por qué creés que suma.

Mi stack es React + Tailwind v4, así que usá clases de utilidad de Tailwind y
mantené los nombres de token en el `@theme`. Cuanto más cerca esté de eso, más
directo es el traspaso.

Sorprendeme, pero que siga siendo una herramienta de trabajo: si al final no puede
responder "¿quién me debe?" en tres segundos desde el celular, el diseño falló por
más lindo que sea.
