# Contexto para retomar — Dashboard Pileta

> **LEER PRIMERO: `TRASPASO-SUPABASE.md`.** La app ya no es un demo sin backend:
> los datos viven en Supabase, detrás de login. Ese documento manda sobre éste en
> todo lo que tenga que ver con datos, persistencia y despliegue.
>
> De acá sigue vigente: la identidad visual, las reglas de accesibilidad, el estilo
> de código y las trampas ya pisadas del importador.

> Documento de traspaso entre sesiones. Si sos una instancia nueva: leé esto entero
> antes de tocar nada, después mirá `README.md` y el código. Todo está en español
> (nombres de variables, funciones y comentarios incluidos) — mantenelo así.

---

## 1. Qué es esto y para quién

Dashboard de gestión para una **pileta privada** con clientes, clases y cuotas.
La dueña ("la clienta") hoy lleva **todo en Excel** y se le hace tedioso.

Hay dos personas en juego, no confundirlas:
- **El usuario con el que hablás** (Tomás): es quien construye el demo.
- **"La clienta"**: la amiga dueña de la pileta, que es a quien se le muestra.

Esto es un **demo para vender la idea**, sin backend. La frase que guía las
decisiones: *"el importador es el punto donde la app se gana o se pierde la venta:
si falla ahí, ella vuelve al Excel"*.

---

## 2. Estado actual: v3 terminada

Se construyó en tres tandas, cada una con su prompt (el de v1 está en
`prompt-claude-code-dashboard-pileta.md`; los de v2 y v3 llegaron por chat).

**v1 — el demo de solo lectura**
Inicio (resumen), Clientes (lista + ficha), Horarios (grilla semanal + detalle de
clase). Datos de ejemplo, nada editable.

**v2 — edición**
Estado compartido en Context + `localStorage`. Registrar pago, corregir fechas,
agregar/sacar participantes de una clase, restablecer datos.

**v3 — el caso de venta real**
Importador de planillas Excel/CSV, gestión de clases (crear/editar/eliminar),
método de pago con detalle, y desglose de cobros del mes en Inicio.

**v3.1 — asistencia**
Marcar quién se presentó a cada clase, por fecha.

**v3.2 — pulido visual**
Auditoría con el skill `redesign-existing-projects` y sus arreglos.

**Todo funciona.** `npm run build` limpio, `npm run verificar` con 143 chequeos en
verde.

---

## 3. Stack y comandos

React 19 + Vite 8 + Tailwind v4 (`@tailwindcss/vite`, sin archivo de config —
los tokens están en `@theme` dentro de `src/index.css`). JavaScript, no TypeScript.
SheetJS `xlsx` 0.20.3.

```bash
npm run dev                  # http://localhost:5173
npm run build
npm run verificar            # consistencia de datos + importador (143 chequeos)
npm run verificar:importador # solo el importador; regenera ejemplos/
```

---

## 4. Mapa del código

```
src/
  data/                  Datos de ejemplo. Auto-contenidos: NO importan nada de la
    mockClientes.js      app. Es lo único a reemplazar cuando haya backend.
    mockHorarios.js
  lib/
    store.jsx            Context + localStorage + acciones. Las mutaciones están
                         exportadas como funciones PURAS (conPagoRegistrado,
                         conClaseCreada, …) fuera del componente, para poder
                         verificarlas sin navegador.
    datos.js             Derivación pura: estado, días para vencer, antigüedad,
                         cupo, y el cruce clientes <-> horarios.
    importer.js          Planillas: leerArchivo / sugerirMapeo / interpretarFilas /
                         aplicarClientes. Genérico a propósito.
    exportar.js          La planilla del mes: datosDelMes() es pura y arma las 7
                         hojas; descargarMesExcel() es la única que toca SheetJS.
    pagos.js             Métodos, las 6 cuentas, cobradoDelMes().
    estados.js           Regla al día / por vencer / vencido + sus colores.
    listaEspera.js       Los 4 estados de un pedido de lugar + sus colores.
    fechas.js            Parseo y formato de fechas.
  components/            15 componentes, uno por archivo.
  App.jsx                Navegación entre las 3 vistas.
verificacion/            Los chequeos. No entran al build.
ejemplos/                3 planillas de prueba para arrastrar al importador.
```

---

## 5. Las decisiones que NO se deducen del código

Estas son las que importa no romper sin querer.

### Color: dos niveles, a propósito
La paleta del brief (Cloro `#2EC4B6`, Sol `#F2A541`, éxito `#4CA771`, error
`#E15554`) **no llega a 3:1 sobre el fondo Espuma** — se validó con el script del
skill `dataviz`. Por eso hay dos tiers:
- **marca** (los vivos): puntos, barras, fills. Nunca cargan información solos.
- **tinta** (variantes oscuras verificadas ≥4.5:1): `exito-tinta #276B47`,
  `alerta-tinta #8A5510`, `error-tinta #A32B29`, `cloro-tinta #16776E`. Para texto.

El estado siempre se escribe además de pintarse. Los botones "peligro" usan
`error-tinta`, no el rojo vivo (blanco sobre el vivo da 3.7:1, insuficiente).

### Las fechas se generan relativas a HOY
`mockClientes.js` define `venceEnDias` (offsets) y calcula las fechas al importar.
Con fechas fijas, en dos meses el demo mostraría a todos vencidos.

**Corolario**: `localStorage` **solo empieza a guardar tras la primera edición**
(flag `editado`). Si nadie tocó nada, cada visita resiembra fresco. No romper esto.

### `parseISO` propio, nunca `new Date('2026-08-14')`
El nativo parsea como UTC y en Argentina (UTC-3) devuelve el día anterior.

### Se guardan IDs, no objetos
`App.jsx` guarda `clienteAbierto`/`claseAbierta` como **ID**. Con el objeto, tras
editar la hoja abierta mostraría datos viejos.

### Un solo panel de detalle a la vez
Abrir uno cierra el otro. Las confirmaciones de borrado pasan **dentro de la fila**,
no en un modal encima del modal.

### Escala de z-index: 30 / 40 / 50
Navegación · hoja de detalle · aviso. Sin valores arbitrarios.

### La vista previa del importador ES lo que se guarda
El mismo `aplicarClientes()` alimenta la tabla de revisión y el commit. No hay forma
de que confirme una cosa y quede otra.

### El importador agrega y actualiza, NUNCA borra
Quien está en la app y no en el archivo se queda como está. Es lo que hace que
reimportar no dé miedo. Cruce por nombre normalizado (sin acentos, minúsculas).

### Nada se pierde en silencio
Filas sin nombre → se saltean y se reportan. Fechas ilegibles → la persona **entra
igual**, marcada para revisar. Perder un cliente callado es peor que importarlo con
un dato a confirmar.

### La asistencia cuelga de (clase, fecha), no de la persona
El grupo es fijo todas las semanas, así que una marca sin fecha sería permanente y
no diría nada. Se guarda `asistencias: { [claseId]: { "2026-08-11": [ids] } }` y
**solo la lista de los que vinieron**: el que no está, no vino.

Por defecto se toma la **última vez que cayó ese día** (`ocurrenciaMasReciente`),
no la próxima — la lista se marca durante o después de la clase, nunca antes. Hay
navegación de a una semana hacia atrás para completar una que quedó sin marcar.

Dos reglas que hay tests para que no se rompan: sacar a alguien del grupo **no**
borra las clases a las que ya vino (es un hecho pasado), pero eliminar la clase
**sí** se lleva su asistencia (no queda huérfana).

### Eliminar un cliente es la única baja, y se lleva todo
El importador agrega y actualiza y NUNCA borra; la única forma de sacar a alguien
del padrón es la confirmación de dos pasos al final de su ficha. Se lleva su ficha,
sus pagos, su lugar en cada clase y sus asistencias, porque un participante
apuntando a un cliente que no existe rompe el cruce entre las dos pantallas. La
app borra una sola fila y el resto lo hacen las cascadas de la migración inicial:
`conClienteEliminado` replica en la pantalla exactamente eso.

Sacar a alguien de una clase NO lo borra del padrón — eso sigue viviendo en el
detalle de la clase, y la ficha lo dice para que nadie use la baja por error.

### La planilla del mes: hechos del mes, padrón de hoy
Pagos, asistencias y clases dadas se cortan por el mes elegido. Clientes, cuotas,
horarios y docentes van como están HOY: la base no guarda versiones anteriores de
una ficha, así que escribir "el plan que tenía en marzo" sería inventarlo. La hoja
de Resumen lo dice con todas las letras.

Los importes viajan como número con formato de moneda y las fechas como fecha de
Excel. Un "$42.000" de texto no se suma ni se ordena, y eso es exactamente para lo
que se baja la planilla.

### Cupo lleno avisa pero no bloquea
Vale para agregar participantes a una clase llena y para bajar el cupo por debajo de
los anotados. Quién entra lo decide ella, no el sistema.

### SheetJS se carga bajo demanda
`lazy()` en `App.jsx`. Pesa 512 kB; en el bundle principal, Inicio pasaba de 78 kB a
245 kB gzip.

### Jerarquía tipográfica: mayúsculas solo en microetiquetas
Al principio TODOS los encabezados iban en versalitas y quedaban todos con el mismo
rango. Ahora los títulos de sección van en caja normal y más grandes; las
mayúsculas quedan para las etiquetas chicas (dentro de las hojas de detalle), que
es donde la convención suma.

### Motion: curva propia `--ease-suave`, y NADA de animaciones de entrada
`cubic-bezier(0.32, 0.72, 0, 1)` en las transiciones interactivas — arranca rápido
y frena despacio, como algo con masa. La de fábrica es simétrica y se siente de
plástico.

Lo que NO se hace: animaciones de entrada al scrollear. Varias skills de diseño las
piden ("ningún elemento aparece estáticamente"), pero esto es una herramienta que se
abre veinte veces por día — ahí una animación de 800ms deja de ser lujo y pasa a ser
espera.

### Alturas en `dvh`, nunca `vh`
La barra de direcciones de Safari en iPhone hace saltar el layout con `100vh`. La
clienta lo mira desde el teléfono.

### Sombras tintadas, nunca negro
`--shadow-agua` y `--shadow-agua-lg` en `index.css`, con el azul de la paleta. Una
sombra negra sobre un fondo de matiz frío se ve gris sucio.

### El motivo de carriles va en UN solo lugar
La cabecera de marca (`LineasDeCarril.jsx`). Es CSS y no SVG para que los tramos
midan igual a cualquier ancho. No repetirlo por la app.

---

## 6. Trampas ya pisadas (no volver a caer)

**`xlsx` en npm es 0.18.5, de 2022, con 2 advisories.** SheetJS ya no publica ahí.
Está instalado desde el CDN oficial:
`npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. Figura como URL en
`package.json`. `npm audit` = 0 vulnerabilidades. **No "arreglar" esto reinstalando
desde npm.**

**CSV en UTF-8 leído como Windows-1252.** Era el bug más grave: "Tomás" llegaba como
"TomÃ¡s", no matcheaba con el cliente existente y **duplicaba** en vez de actualizar.
Con acentos en medio padrón argentino, arruina la importación. Resuelto en
`decodificarTexto()`: UTF-8 con `fatal:true` primero, Windows-1252 de reserva.

**SheetJS en Node/ESM no engancha `fs` solo.** Hace falta `XLSX.set_fs(fs)` para
`writeFile`. En el navegador no.

**El heredoc del tool Bash colapsa las barras invertidas.** Escribir `\\u0300` o
`\\n` dentro de `<<'PY'` llega a Python como `̀`/`\n` ya interpretados. Para
meter un backslash literal en un archivo hay que construirlo con `chr(92)`. También
por esto los heredocs con JSX largo fallan — para componentes usar la tool Write.

**No hay navegador en el entorno.** La app NUNCA se revisó visualmente. Se verifica
por: build, render SSR de todas las pantallas, y chequeos de consistencia de datos.
Decilo cuando corresponda en vez de afirmar que se ve bien.

---

## 7. Cómo se verifica

`npm run verificar` corre cinco scripts (los dos de la base se saltean solos sin
credenciales):

**`verificacion/correr.mjs`** (13 secciones) — levanta Vite en modo SSR, renderiza
App, el importador, las 20 fichas y los 23 detalles de clase; después aplica cada
mutación con los reducers reales y chequea invariantes: ningún participante
apuntando a un cliente inexistente, nadie repetido en una clase, cupo ocupado ==
lista real, el cruce visible en las dos puntas, ida y vuelta por localStorage.

**`verificacion/importador.mjs`** — genera las 3 planillas en `ejemplos/` y pasa el
pipeline completo, más 4 archivos que no son planillas.

**`verificacion/exportador.mjs`** — la planilla del mes contra un padrón inventado a
mano (las fechas de la semilla son relativas a hoy y acá hace falta saber de qué mes
es cada pago): que el corte por mes deje afuera lo que no es del mes, y que el
.xlsx, leído de vuelta, traiga los importes como números y las fechas como fechas.

**Al agregar una feature, agregarle su sección acá.** Es el único test que hay.

---

## 8. Preguntas abiertas para la clienta

Ninguna está confirmada. Se asumió y se dejó fácil de cambiar:

| Tema | Asumido | Dónde se cambia |
|---|---|---|
| Umbral "por vencer" | 7 días | `UMBRAL_POR_VENCER` en `estados.js` |
| Ciclo de cobro | mensual (meses de calendario: 31/01 + 1 = 28/02) | `vencimientoPara()` en `store.jsx` |
| Corregir fechas | NO asienta pago en el historial (es ajuste, no pago) | `conFechasEditadas` |
| Etiqueta de titular | "Ser" tal como lo escribió el usuario, no "Sergio" | `CUENTAS` en `pagos.js` |
| Número de recibo | opcional (para no bloquear si no tiene el talonario) | `FormularioPago` |
| Fechas ambiguas (`03/04/2026`) | día/mes, criterio argentino | `parsearFecha()` |
| Si falta vencimiento | se deduce del último pago + 1 mes | `aplicarClientes()` |
| Precios de cuotas | inventados (34.000–82.000) | `mockClientes.js` |
| 5 clientes son chicos | con adulto responsable; la cuenta va a nombre del chico | `mockClientes.js` |

---

## 9. Fuera de alcance (todavía)

- **Historial de asistencia en la ficha del cliente** ("vino a X de las últimas Y
  clases"). Los datos ya están en `asistencias`; falta solo la vista.
- **Importar pagos e historial** — es lo próximo. `importer.js` ya está partido para
  eso: `leerArchivo` / `sugerirMapeo` / `interpretarFilas` son genéricos y reciben la
  lista de campos por parámetro. Alcanza con definir `CAMPOS_PAGO` y un
  `aplicarPagos()`. **Reusar, no reescribir.**
- Importar horarios (mismo mecanismo).
- Alta de cliente nuevo desde cero, a mano.
- Recordatorios por WhatsApp/mail.
- Importar pagos históricos junto con el padrón.

Ya no están fuera de alcance —se hicieron después de escribir esto—: backend real
(Supabase), login, exportar a Excel y borrar un cliente por completo.

---

## 10. Cómo trabajar en este proyecto

**Skills instalados en `~/.claude/skills/`:**

| Skill | Para qué sirve acá |
|---|---|
| `ui-ux-pro-max` | Consultas por dominio de UX. `python ~/.claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain ux` |
| `redesign-existing-projects` | **El más útil de los de diseño.** Auditoría de UI existente. Ya se corrió una pasada completa. |
| `high-end-visual-design` | Sombras, espaciado, micro-interacciones |
| `design-system` | Tokens en tres capas |
| `design-taste-frontend` | Reglas anti-genérico |
| `dataviz` (bundled) | Validador de paleta — se usó para los dos tiers de color |

**Cuidado con estos.** Salieron del repo `ttomisanchezz/Todos-Proyectos-de-claude`
(108 skills, la mayoría de marketing) y **no** se instalaron a propósito:

- `industrial-brutalist-ui`, `minimalist-ui` — preajustes de estilo que chocan de
  frente con la identidad definida en el brief original.
- `banner-design`, `slides`, `imagegen-*`, `brandkit`, `brand` — generan piezas
  (logos, banners, imágenes para redes), no UI de aplicación.
- `stitch-design-taste` — genera `DESIGN.md` para Google Stitch, otra herramienta.
- `tool-design` — el nombre engaña: es sobre diseñar **APIs de herramientas para
  agentes** (MCP, schemas), no diseño visual.

Y dos advertencias sobre los que sí están:
- `design-taste-frontend` dice en su propio encabezado *"Not dashboards, not data
  tables, not multi-step product UI"* — o sea, excluye exactamente lo que es este
  proyecto. Usar con criterio, no al pie de la letra.
- `high-end-visual-design` trae un *"Variance Mandate: NEVER generate the same
  layout twice"*. Acá eso es al revés: la identidad es fija y la consistencia es
  la que hace que se vea prolijo.
- `design-system/scripts/fetch-background.py` y `ui-styling/scripts/shadcn_add.py`
  salen a la red / corren `npx`. No hacen falta: no usamos shadcn ni slides.

**Nunca correr `--design-system` para regenerar la identidad**: la paleta, la
tipografía y el motivo de carriles vienen del brief y no se rehacen.

Reglas que ya salieron de ahí y están aplicadas — respetarlas al agregar UI:
confirmación antes de destructivas · feedback de éxito visible (nada silencioso) ·
labels siempre visibles, nunca solo placeholder · validación en blur pegada al campo
· targets de 44px con 8px de separación · estados vacíos y "sin resultados" con
salida · `role="alert"` en errores · marcar campos obligatorios · indicador "paso N
de M" · spinner en esperas >300ms.

**Estilo de código.** Todo en español. Comentarios que explican **por qué**, no qué
— y solo donde la decisión no es obvia. Mirar cualquier archivo de `lib/` para el
tono.

**Estilo de respuesta.** El usuario escribe en español, informal y directo. Espera:
resumen corto de qué se hizo, decisiones tomadas con su razón, y las cosas a
confirmar. Sin relleno. Suele mandar correcciones a mitad de tarea — incorporarlas
sin drama.

**Tokens.** El usuario se quedó sin contexto en la sesión anterior. Ser eficiente:
no releer archivos completos sin necesidad, no spawnear subagentes salvo pedido
explícito.
