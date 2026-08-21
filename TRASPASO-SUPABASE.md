# Traspaso — migración a Supabase (en curso)

> Estado al 12/08/2026. Este documento manda sobre `HANDOFF.md` en todo lo que
> tenga que ver con datos, persistencia y despliegue — `HANDOFF.md` describe la
> v3, que era un demo sin backend. Lo que sigue vigente de ahí: identidad visual,
> reglas de accesibilidad, estilo de código y las trampas del importador.
>
> **Todo el código en español.** Nombres de variables, funciones y comentarios.
> Los comentarios explican **por qué**, no qué.

---

## 1. Qué se hizo

La app dejó de ser un demo con `localStorage`. Los datos viven en **Supabase**
(Postgres + Auth), detrás de login, con RLS.

El plan original tenía 5 fases. **Las fases 1 a 4 están terminadas y verificadas
contra la base real.** Falta la 5 (limpieza final, README y despliegue) y el
rediseño visual completo.

### Fase 1 — Esquema y RLS ✅

`supabase/migrations/20260812120000_esquema_inicial.sql`, ya aplicada al proyecto
real. Cinco tablas: `clientes`, `clases`, `participantes`, `pagos`, `asistencias`.

Decisiones que **no** se deducen del SQL:

- **Los ids los genera el CLIENTE, no la base.** `clientes.id` es `bigint` y
  `clases.id` es `text` — no `uuid`. Motivo: `aplicarClientes` asigna ids con
  `max(id)+1` y `generarIdClase` arma `'clase-3'`. Las dos son funciones puras que
  no se tocan; un `gen_random_uuid()` obligaba a reescribirlas.
- **Se agregaron columnas que el plan original no listaba** porque la app las usa:
  `clientes.telefono`, `clientes.plan`, `clases.profe`, `clases.duracion`. El
  "nombre" de la clase se llama `actividad`, como en el código.
- **`hora` es `text` con check de formato**, no `time`: Postgres devuelve
  `'09:00:00'` y habría que recortarlo en cada lectura.
- **Las fechas de negocio son `date`.** Nunca `timestamptz` — con zona horaria, en
  UTC-3 vuelve el día anterior y revive el bug que `parseISO` existe para evitar.
  Los `creado_en` sí son `timestamptz`: son auditoría, no se muestran.
- **Índice único `(usuario_id, nombre_normalizado)`** en `clientes`. Es lo que
  hace posible el upsert por nombre del importador.
- **Cascadas asimétricas, a propósito**: borrar una clase se lleva sus
  `participantes` **y** sus `asistencias`. Sacar a alguien del grupo borra su fila
  en `participantes` y **nada más** — no hay FK de `asistencias` hacia
  `participantes` justamente por eso. Hay tests que lo cubren.
- **NO se revocan los grants de `anon`.** Con los grants puestos y ninguna política
  que lo alcance, una consulta sin sesión devuelve **cero filas**; revocando,
  devolvería un error de permisos, que se confunde con "la app se rompió".

### Fase 2 — Auth ✅

Login con email y contraseña. **Sin pantalla de registro**: el usuario se crea a
mano desde el panel y los signups están deshabilitados.

- `src/lib/supabase.js` — el cliente. **Sin `flowType: 'pkce'` a propósito**: PKCE
  guarda un verificador en el navegador que pidió el mail, así que el link de
  recuperación solo funcionaría en ese dispositivo.
- `src/lib/sesion.jsx` — contexto + `mensajeDeError()`, que traduce los errores de
  Supabase al castellano con **qué pasó y qué hacer**. Nunca muestra jerga cruda.
- `src/components/Puerta.jsx` — decide entre: faltan claves / resolviendo sesión /
  login / app. **Mientras resuelve NO muestra el login**, muestra solo el fondo de
  agua: la sesión guardada casi siempre existe y el parpadeo hace dudar.
- `src/components/Login.jsx` — entrar · recuperar · contraseña nueva.
- `src/components/PantallaAgua.jsx` — el armazón visual, compartido por las tres.
- `src/components/Cuenta.jsx` — cerrar sesión (pie del sidebar y esquina en celular).
- `src/lib/espera.js` — `useEsperaLarga(activo, ms = 300)`, la convención de los
  300ms para spinners, en un solo lugar.

### Fase 3 — Persistencia ✅

**Las funciones puras de `store.jsx` (`conPagoRegistrado`, `conClaseCreada`, …) no
se tocaron.** Lo único que cambió es de dónde sale el estado y adónde se guarda.

- `src/lib/nombres.js` — `normalizar` y `claveNombre`. **Existe por dos motivos**:
  que haya una sola definición de "mismo nombre" (la usa el importador y la usa el
  mapeo para `nombre_normalizado`), y que el mapeo **no** tenga que importar de
  `importer.js`, que arrastra SheetJS (512 kB) al bundle principal y rompe la carga
  diferida. Esto ya pasó una vez: el bundle saltó de 137 a 299 kB gzip.
- `src/lib/mapeo.js` — traducción fila ↔ objeto. Toda la conversión snake_case ↔
  camelCase vive acá. `armarCrudos()` arma `{clientes, horarios, asistencias}`, la
  misma forma que antes tenía `localStorage`.
- `src/lib/persistencia.js` — `crearPersistencia(usuarioId)`, una función por
  acción. **Acá no se calcula nada**: el estado nuevo ya lo calcularon las funciones
  puras. Si aparece lógica de negocio en este archivo, está en el lugar equivocado.
- `src/lib/store.jsx` — el proveedor ahora carga de la base y aplica **actualización
  optimista**: `aplicar(mutar, escribir)` cambia la pantalla, escribe, y si falla
  **revierte** y ofrece reintentar.

Detalles que importan:

- **Un pago son dos escrituras** (el asiento y las fechas del cliente). Si la
  segunda falla, `registrarPago` **borra el pago recién insertado** a mano. Sin esa
  compensación quedaría un pago cobrado que la ficha no refleja.
- **`ProveedorDatos` acepta `datosIniciales`**: es la costura por la que la
  verificación monta la app con un padrón de prueba sin salir a la red. La app
  nunca lo pasa.
- **El importador guarda con un solo `upsert`** sobre
  `(usuario_id, nombre_normalizado)`. Agrega y actualiza, **nunca borra**. Un
  borrar-y-reinsertar sería más simple y catastrófico: si se corta la señal en el
  medio, ella se queda sin padrón.
- **Los mocks se mudaron a `verificacion/semilla/`.** `src/data/` ya no existe. Las
  fechas relativas a hoy siguen ahí y **está bien**: los chequeos buscan "un
  cliente vencido" y "uno al día"; con fechas fijas, en dos meses la mitad de la
  verificación dejaría de probar nada.
- **Se fue el flag `editado`, `restablecer()` y el pie "Restablecer datos de
  ejemplo".** Sin `localStorage` no significan nada y el botón pasaba de útil a
  borrar-todo.
- Estados nuevos en `src/components/Arranque.jsx`: `Cargando` (esqueleto, a los
  300ms), `ErrorDeCarga` (con reintentar, sin necesidad de recargar la página) y
  `PrimerArranque` (la base vacía empuja directo al importador).
- `src/components/Aviso.jsx` ahora también muestra el error de red, con
  **Reintentar**, y **no se va solo**: pide una decisión.

### Fase 4 — Importador contra la base real ✅

Sección 6 de `verificacion/persistencia.mjs`: las tres planillas de `ejemplos/`
pasan por el pipeline completo y se guardan. Cada una se importa **dos veces** para
probar que reimportar no duplica.

Ese bloque **se saltea solo** si la base ya tiene clientes reales (id < 900000),
para no pisarle una fila a la dueña con un upsert por nombre.

---

### Baja de clientes y planilla del mes ✅

Las dos cosas que figuraban como fuera de alcance en `HANDOFF.md` y que la clienta
pidió después.

**Eliminar un cliente.** Es la única baja del padrón que existe: el importador
agrega y actualiza, nunca borra. Vive al final de la ficha, en "Dar de baja", con
confirmación en dos pasos que enumera qué se lleva puesto (la ficha, sus pagos, su
lugar en cada clase y sus asistencias). La app borra **una** fila —la de
`clientes`— y el resto cae por las cascadas que ya estaban en la migración
inicial; `conClienteEliminado` deja la pantalla igual a lo que devolvería una
recarga. Lo que NO toca es la lista de espera: quien pidió un lugar nunca fue
cliente.

**Descargar un mes en Excel.** En Inicio, abajo de "Cobros del mes". Un selector
con los meses que tienen algo (más el mes en curso, siempre) y un botón que baja un
`.xlsx` con siete hojas: Resumen, Pagos, Clientes, Clases dadas, Asistencias,
Docentes y Lista de espera. Antes de bajar nada se dice cuántos pagos, cuánto y
cuántas clases van adentro.

Dos decisiones que no se deducen del código:

- **Los hechos son del mes; el padrón es de hoy.** Pagos, asistencias y clases
  dadas se cortan por el mes elegido. Clientes, cuotas, horarios y docentes van
  como están hoy, porque la base guarda el estado actual de cada ficha y no sus
  versiones anteriores. La planilla lo dice en su hoja de Resumen en vez de dejarlo
  a la interpretación.
- **Los importes van como número con formato de moneda, no como texto.** Un
  "$42.000" de texto no se suma ni se ordena, y sumar una columna es lo primero que
  se hace con esta planilla. Las fechas, igual: fecha de Excel con formato
  `dd/mm/yyyy`.

El cálculo entero (`src/lib/exportar.js`) es puro y no toca SheetJS: la única
función que lo importa es `descargarMesExcel`, y lo hace con `import()` dinámico
para que los 512 kB de la biblioteca no entren al bundle de Inicio.

---

## 2. Lo que falta

### Fase 5 — Limpieza y despliegue ⬜

1. **Actualizar `README.md`.** Todavía describe el demo con `localStorage` y el
   botón de restablecer, que ya no existen. Tiene que hablar de: `.env.local`,
   `supabase/LEEME.md`, cómo se crea el usuario, y la pausa del plan gratuito.
2. **`git init` + primer commit + push.** La carpeta **no es un repo git todavía**.
   El repo remoto ya existe: `https://github.com/tominicoaxel/Aqua-Sol-Dashboard.git`
   **El usuario autorizó subirlo.** Verificar antes que `.env.local` esté ignorado
   (lo está).
3. **Vercel.** Importar el repo, framework Vite, y cargar las dos variables
   `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en el panel del host. No hace
   falta `vercel.json`: no hay router de cliente, así que no hacen falta rewrites.
   **El usuario tiene que hacer los clics** — no se puede entrar a su cuenta.

### Rediseño visual ⬜

El usuario pidió instalar tres skills y **rediseñar toda la app**. Las tres están
instaladas en `~/.claude/skills/` y funcionando:

| Skill | De dónde salió |
|---|---|
| `frontend-design` | `anthropics/skills` |
| `micro-interactions` | `solinkz/micro-interactions-skill` |
| `ui-refactor` | `LovroPodobnik/refactoring-ui-skill` (trajo además 5 slash commands: `/ui-refactor`, `/fix-colors`, `/fix-hierarchy`, `/fix-layout`, `/fix-typography`) |

**Solo la pantalla de login se diseñó con ellas.** Falta la pasada sobre las 6
pantallas: Inicio, Clientes, Ficha, Horarios, Detalle de clase e Importador.

La dirección que ya se estableció en el login, para mantener coherencia: la
composición sale de los nombres de la propia paleta — una tarjeta **Espuma**
flotando sobre **Agua Profunda**, con el degradé de `agua-claro` a `agua-hondo`
porque es lo que hace el agua con la profundidad. En celular la tarjeta va **pegada
abajo**, en la zona del pulgar.

**Restricciones del brief que el rediseño no puede romper** (están en
`PROMPT-CLAUDE-DESIGN.md` y `HANDOFF.md`):

- Los colores vivos **no llegan a 3:1** sobre el fondo Espuma. Nunca cargan
  información solos; para texto van las tintas oscuras verificadas
  (`exito-tinta`, `alerta-tinta`, `error-tinta`, `cloro-tinta`). El estado
  **siempre se escribe además de pintarse**.
- **Nada de `py-24` a `py-40`.** Es una herramienta, no una landing.
- **Nada de animaciones de entrada al scrollear.** La app se abre veinte veces por
  día; 800ms de animación dejan de ser lujo y pasan a ser espera.
- **El motivo de carriles va en UN solo lugar**: la cabecera de marca.
- Alturas en `dvh`, nunca `vh`. Sombras tintadas con el azul, nunca negras.
- Mayúsculas solo en microetiquetas, no en los títulos de sección.

### Suelto, menor ⬜

- La columna `clientes.revisar` existe y el mapeo la lee, pero **nada la muestra en
  la UI**. `aplicarClientes` reporta las fechas ilegibles en `sinFecha` pero no
  marca el objeto. Cerrar ese círculo es un rato de trabajo.
- El bundle principal pasó de 78 a 137 kB gzip: es `supabase-js`, que trae realtime
  y storage aunque no se usen. No es lazy-cargable porque el login lo necesita.

---

## 3. Comandos

```bash
npm run dev                  # http://localhost:5173
npm run build
npm run verificar            # los 5 scripts (294 chequeos sin contar la base)
npm run verificar:base       # solo lo que toca Supabase
npm run verificar:importador # solo el importador; regenera ejemplos/
npm run verificar:exportador # solo la planilla del mes
```

`npm run verificar` corre cinco scripts:

| Script | Qué prueba |
|---|---|
| `verificacion/correr.mjs` | 18 secciones: render SSR de todas las pantallas + las mutaciones puras + la puerta + la baja de un cliente |
| `verificacion/importador.mjs` | El pipeline de planillas, sin red |
| `verificacion/exportador.mjs` | La planilla del mes: el corte por mes y el .xlsx leído de vuelta |
| `verificacion/supabase.mjs` | Esquema y RLS contra la base real, incluidas las dos cascadas |
| `verificacion/persistencia.mjs` | El ciclo completo con el código real, y las 3 planillas contra la base |

**Los dos últimos se saltean solos** si faltan credenciales en `.env.local`, y lo
dicen fuerte. Nunca pasan en silencio fingiendo que verificaron.

**Al agregar una feature, agregarle su sección.** Es el único test que hay.

---

## 4. Credenciales y entorno

`.env.local` (no versionado) tiene cuatro valores. `.env.example` está versionado
con las claves vacías. El paso a paso completo de Supabase está en
`supabase/LEEME.md`.

- La **`anon key` es pública por diseño**: viaja al navegador. Lo que protege los
  datos es RLS.
- La **`service_role` nunca** toca el navegador, el repo ni un mensaje de chat.
- `SUPABASE_EMAIL_PRUEBA` / `SUPABASE_PASSWORD_PRUEBA` son solo para la
  verificación con sesión.

**Plan gratuito**: el proyecto se pausa solo tras varios días sin actividad y hay
que despertarlo a mano desde el panel. La app va a mostrar errores de red como si
estuviera rota, y no lo está.

---

## 5. Cómo verificar sin navegador

**No hay navegador en este entorno.** La app nunca se revisó visualmente. Se
verifica por build, render SSR de todas las pantallas y chequeos de datos contra la
base real. **Decilo así cuando reportes**, en vez de afirmar que se ve bien.

Lo que en consecuencia **no está probado de punta a punta**:

- El flujo de "me olvidé la contraseña" — necesita que llegue un mail real.
- El comportamiento visual del login en celular real.
- La reversión optimista con una caída de red de verdad (está probada por código,
  no provocando el corte).
