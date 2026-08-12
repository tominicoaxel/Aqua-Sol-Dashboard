# Prompt para Codex — terminar Dashboard Pileta

> Copiá desde la línea de abajo hasta el final y pegalo.

---

Estás retomando un proyecto a mitad de camino. **No escribas una línea de código
antes de leer, en este orden:**

1. `TRASPASO-SUPABASE.md` — el estado real. Manda sobre todo lo demás.
2. `HANDOFF.md` — identidad visual, accesibilidad, estilo de código y las trampas
   ya pisadas. Ignorá lo que diga sobre datos: está desactualizado.
3. `PROMPT-CLAUDE-DESIGN.md` — el brief de diseño, para la parte visual.
4. `supabase/LEEME.md` — cómo está configurada la base.

**Todo el código va en español**: nombres de variables, funciones y comentarios. Los
comentarios explican **por qué**, no qué, y solo donde la decisión no es obvia.
Mirá cualquier archivo de `src/lib/` para el tono.

## Dónde está parado esto

Era un demo sin backend. Ahora los datos viven en Supabase, detrás de login, con
RLS. Las fases 1 a 4 del plan están terminadas y verificadas contra la base real:
esquema, auth, persistencia e importador. `npm run verificar` da **233 chequeos en
verde** y `npm run build` sale limpio.

**Verificá eso vos mismo antes de tocar nada.** Si no da verde, algo se rompió
entre que se escribió esto y ahora, y eso es lo primero a resolver.

## Lo que tenés que hacer

Cuatro cosas, en este orden. **Pará y mostrame el resultado entre una y otra.**

### 1. Actualizar el README

Todavía describe el demo con `localStorage` y un botón de "Restablecer datos de
ejemplo" que ya no existe. Tiene que hablar de lo que la app es hoy: `.env.local`,
el paso a paso de `supabase/LEEME.md`, cómo se crea el usuario a mano, que el
registro público está cerrado, y que en el plan gratuito el proyecto **se pausa
solo** tras varios días sin actividad y hay que despertarlo desde el panel — para
que no parezca que la app se rompió.

### 2. Subir el repo

La carpeta **no es un repo git todavía**. El remoto ya existe y está vacío:
`https://github.com/tominicoaxel/Aqua-Sol-Dashboard.git`

`git init`, primer commit, push. **Antes de commitear, confirmá que `.env.local` no
entra** — está en `.gitignore`, pero verificalo con `git status` y no confíes en
que sí. Ese archivo tiene las credenciales.

### 3. Desplegar en Vercel

Importar el repo, framework Vite, y cargar las dos variables `VITE_SUPABASE_URL` y
`VITE_SUPABASE_ANON_KEY` en el panel del host. No hace falta `vercel.json`: no hay
router de cliente, así que no hacen falta rewrites.

**Los clics los tengo que hacer yo** — no podés entrar a mi cuenta. Dejame las
instrucciones exactas y decime qué pegar dónde.

### 4. Rediseñar las 6 pantallas

Es lo más grande y va último, sobre la app ya conectada. Las pantallas son: Inicio,
Clientes, Ficha de cliente, Horarios, Detalle de clase e Importador.

Hay tres skills instaladas para esto en `~/.claude/skills/`: `frontend-design`,
`micro-interactions` y `ui-refactor`. **Usalas.** La pantalla de login ya se diseñó
con ellas y estableció la dirección: la composición sale de los nombres de la
propia paleta — una tarjeta **Espuma** flotando sobre **Agua Profunda**, con el
degradé de `agua-claro` a `agua-hondo` porque es lo que hace el agua con la
profundidad. Mantené esa coherencia.

**Restricciones que no se negocian** (están en `HANDOFF.md` y
`PROMPT-CLAUDE-DESIGN.md`, ahí está el detalle):

- Los colores vivos **no llegan a 3:1** sobre el fondo Espuma. Nunca cargan
  información solos; para texto van las tintas oscuras verificadas. El estado
  **siempre se escribe además de pintarse**.
- **Nada de `py-24` a `py-40`.** Es una herramienta de trabajo, no una landing. El
  aire generoso acá se paga en scroll.
- **Nada de animaciones de entrada al scrollear.** Esta app se abre veinte veces
  por día; 800ms dejan de ser lujo y pasan a ser espera.
- **El motivo de líneas de carril va en UN solo lugar**: la cabecera de marca.
- Alturas en `dvh`, nunca `vh`. Sombras tintadas con el azul, nunca negras.
- Mayúsculas solo en microetiquetas, nunca en los títulos de sección.
- El 80% del uso es **desde el celular, al borde de la pileta**. Si al final no
  puede responder "¿quién me debe?" en tres segundos con una mano, el rediseño
  falló por más lindo que sea.

## Reglas del proyecto que no podés romper

- **Las funciones puras de `src/lib/store.jsx` no se tocan.** `conPagoRegistrado`,
  `conClaseCreada`, `conAsistenciaMarcada` y las demás siguen recibiendo estado y
  devolviendo estado nuevo. Lo mismo con `datos.js`, `estados.js`, `fechas.js`,
  `pagos.js` e `importer.js`: son puros y agnósticos. Si te encontrás metiendo un
  `await` ahí adentro, retrocedé.
- **`npm run verificar` tiene que seguir en verde.** Es el único test que hay. Si
  agregás una feature, agregale su sección.
- **No importes nada de `verificacion/semilla/` desde `src/`.** Son los datos de
  ejemplo y la app real no los usa: arranca vacía y se puebla desde el importador.
- **Cuidado con `src/lib/nombres.js`.** Existe para que el mapeo no tenga que
  importar de `importer.js`, que arrastra SheetJS (512 kB) al bundle principal y
  rompe la carga diferida. Ya pasó una vez. Si tocás imports, mirá el tamaño del
  bundle después de buildear: el chunk principal tiene que quedar en ~137 kB gzip
  y el del importador tiene que seguir siendo un archivo aparte.

## Cómo quiero que trabajes

Antes de escribir código en cada punto, decime en dos o tres líneas qué vas a hacer
y qué archivos vas a tocar. Si algo no te cierra, **preguntá en vez de asumir**.

**No hay navegador en el entorno**: la app nunca se revisó visualmente. Se verifica
por build, render SSR de todas las pantallas y chequeos de datos contra la base
real. **Decilo así cuando reportes**, en vez de afirmar que se ve bien.

Escribime corto y directo: qué hiciste, qué decidiste y por qué, y qué tengo que
confirmar. Sin relleno.
