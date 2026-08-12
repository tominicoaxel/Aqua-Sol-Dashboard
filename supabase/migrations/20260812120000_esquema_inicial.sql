-- ─── Esquema inicial — Dashboard Pileta ─────────────────────────────────────
-- Migración única: las cinco tablas, sus índices y RLS.
--
-- Criterio general: la base guarda LO CRUDO y nada derivado. El estado (al día /
-- por vencer / vencido), el cupo ocupado, la antigüedad y el cruce entre clientes
-- y clases se siguen calculando en el cliente (`src/lib/datos.js`). Cualquier
-- vista o columna calculada acá sería una segunda fuente de verdad que se
-- desincroniza.

-- ─── clientes ───────────────────────────────────────────────────────────────
-- `id` es bigint y lo genera el CLIENTE, no la base. No es un descuido: el
-- importador (`aplicarClientes`, función pura) asigna ids con max(id)+1 y esa
-- función no se toca. Un `gen_random_uuid()` acá obligaría a reescribirla.
--
-- `nombre_normalizado` también viene calculado del cliente, con el mismo
-- `claveNombre()` de `importer.js` (minúsculas, sin acentos, espacios colapsados).
-- Replicarlo en SQL exigiría la extensión `unaccent` y dos definiciones de
-- "mismo nombre" que pueden divergir. Una sola implementación, la de JS.
create table if not exists public.clientes (
  id                 bigint primary key,
  usuario_id         uuid not null references auth.users (id) on delete cascade default auth.uid(),
  nombre             text not null check (length(trim(nombre)) > 0),
  nombre_normalizado text not null,
  telefono           text not null default '',
  plan               text not null default 'Sin plan',
  cuota              numeric(12, 2) not null default 0 check (cuota >= 0),
  fecha_ultimo_pago  date,
  fecha_vencimiento  date,
  cliente_desde      date,
  adulto_responsable text,
  -- Bandera del importador: la fila entró aunque su fecha fuera ilegible. Perder
  -- a una persona en silencio es peor que importarla con un dato a confirmar.
  revisar            boolean not null default false,
  creado_en          timestamptz not null default now()
);

-- Lo que hace posible el upsert por nombre del importador: reimportar la misma
-- planilla actualiza, no duplica. "Sofía Ferreyra" y "SOFIA  FERREYRA" chocan acá.
create unique index if not exists clientes_usuario_nombre_norm_idx
  on public.clientes (usuario_id, nombre_normalizado);

-- ─── clases ─────────────────────────────────────────────────────────────────
-- `id` es text y también lo genera el cliente (`generarIdClase` → 'clase-3'), por
-- la misma razón que en clientes.
--
-- `hora` es text 'HH:MM' y no `time`: Postgres devuelve '09:00:00' y habría que
-- recortarlo en cada lectura. El check hace el trabajo que haría el tipo.
--
-- `dia` sigue la convención de Date.getDay(): 0 domingo … 6 sábado.
create table if not exists public.clases (
  id         text primary key check (length(trim(id)) > 0),
  usuario_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  actividad  text not null check (length(trim(actividad)) > 0),
  profe      text not null default '',
  dia        smallint not null check (dia between 0 and 6),
  hora       text not null check (hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  duracion   smallint not null default 45 check (duracion > 0),
  cupo       smallint not null default 0 check (cupo >= 0),
  creado_en  timestamptz not null default now()
);

create index if not exists clases_usuario_dia_idx on public.clases (usuario_id, dia, hora);

-- ─── participantes ──────────────────────────────────────────────────────────
-- Quién está anotado en cada clase. El cupo ocupado NO se guarda: se cuenta desde
-- acá. Un contador guardado se desincroniza al primer borrado.
create table if not exists public.participantes (
  clase_id   text not null references public.clases (id) on delete cascade,
  cliente_id bigint not null references public.clientes (id) on delete cascade,
  primary key (clase_id, cliente_id)
);

create index if not exists participantes_cliente_idx on public.participantes (cliente_id);

-- ─── pagos ──────────────────────────────────────────────────────────────────
-- El check de coherencia replica la regla de `conPagoRegistrado`: se guarda SOLO
-- el dato del método elegido. Si alguien tipeó un recibo, después cambió a
-- transferencia y confirmó, ese recibo no puede quedar colgado contradiciendo al
-- método.
create table if not exists public.pagos (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  cliente_id bigint not null references public.clientes (id) on delete cascade,
  fecha      date not null,
  importe    numeric(12, 2) not null check (importe >= 0),
  metodo     text not null check (metodo in ('transferencia', 'efectivo')),
  -- Las seis cuentas de `src/lib/pagos.js`: tres billeteras × dos titulares.
  cuenta     text check (cuenta in ('mp-moni', 'nx-moni', 'bbva-moni', 'mp-ser', 'nx-ser', 'bbva-ser')),
  recibo     text,
  creado_en  timestamptz not null default now(),
  constraint pagos_detalle_coherente check (
    (metodo = 'transferencia' and cuenta is not null and recibo is null)
    or
    (metodo = 'efectivo' and cuenta is null)
  )
);

create index if not exists pagos_cliente_fecha_idx on public.pagos (cliente_id, fecha desc);
create index if not exists pagos_usuario_fecha_idx on public.pagos (usuario_id, fecha desc);

-- ─── asistencias ────────────────────────────────────────────────────────────
-- La asistencia cuelga de (clase, fecha), no de la persona: el grupo es fijo todas
-- las semanas, así que una marca sin fecha sería permanente y no diría nada. Se
-- guarda solo a quien VINO; el que no tiene fila, no vino.
--
-- La clave primaria compuesta es además lo que impide marcar dos veces a la misma
-- persona en la misma fecha.
--
-- ASIMETRÍA DELIBERADA, hay tests que la cubren:
--   · Eliminar una clase se lleva sus participantes Y sus asistencias (cascada
--     desde `clases`): no quedan huérfanas.
--   · Sacar a alguien del grupo borra su fila en `participantes` y NADA MÁS. No
--     hay FK desde acá hacia `participantes` justamente por eso: que vino un
--     martes es un hecho, no una preferencia.
create table if not exists public.asistencias (
  clase_id   text not null references public.clases (id) on delete cascade,
  fecha      date not null,
  cliente_id bigint not null references public.clientes (id) on delete cascade,
  primary key (clase_id, fecha, cliente_id)
);

create index if not exists asistencias_clase_fecha_idx on public.asistencias (clase_id, fecha desc);

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Activado en las cinco tablas, sin excepciones.
--
-- NO se revocan los grants de `anon`. Es a propósito: con los grants puestos y
-- ninguna política que lo alcance, una consulta sin sesión devuelve CERO FILAS,
-- que es el comportamiento pedido. Si se revocara el grant, devolvería un error de
-- permisos — más ruidoso y más difícil de distinguir de "la app se rompió".

alter table public.clientes      enable row level security;
alter table public.clases        enable row level security;
alter table public.participantes enable row level security;
alter table public.pagos         enable row level security;
alter table public.asistencias   enable row level security;

-- Tablas raíz: la dueña es la fila.
create policy "clientes son del dueño" on public.clientes
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create policy "clases son del dueño" on public.clases
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create policy "pagos son del dueño" on public.pagos
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- Tablas de cruce: no tienen `usuario_id` propio, la política sale del dueño de la
-- clase. Un `usuario_id` acá sería un dato que puede contradecir a su clase.
create policy "participantes siguen al dueño de la clase" on public.participantes
  for all to authenticated
  using (
    exists (
      select 1 from public.clases c
      where c.id = participantes.clase_id and c.usuario_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clases c
      where c.id = participantes.clase_id and c.usuario_id = auth.uid()
    )
    and exists (
      select 1 from public.clientes cl
      where cl.id = participantes.cliente_id and cl.usuario_id = auth.uid()
    )
  );

create policy "asistencias siguen al dueño de la clase" on public.asistencias
  for all to authenticated
  using (
    exists (
      select 1 from public.clases c
      where c.id = asistencias.clase_id and c.usuario_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clases c
      where c.id = asistencias.clase_id and c.usuario_id = auth.uid()
    )
    and exists (
      select 1 from public.clientes cl
      where cl.id = asistencias.cliente_id and cl.usuario_id = auth.uid()
    )
  );
