-- Docentes y lista de espera.
--
-- Los nombres que ya viven en `clases.profe` se convierten en docentes titulares
-- para que la migración no obligue a reconstruir los horarios a mano. La columna
-- vieja se conserva como respaldo legible, pero la relación real pasa a ser
-- `clases.docente_id`.

create table if not exists public.docentes (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references auth.users (id) on delete cascade default auth.uid(),
  nombre              text not null check (length(trim(nombre)) > 0),
  nombre_normalizado  text not null,
  telefono            text not null default '',
  email               text not null default '',
  rol                 text not null default 'titular' check (rol in ('titular', 'suplente')),
  creado_en           timestamptz not null default now(),
  unique (usuario_id, nombre_normalizado)
);

alter table public.clases
  add column if not exists docente_id uuid references public.docentes (id) on delete set null;

-- Una fila por nombre actual y por usuaria. La normalización SQL alcanza solo
-- para el traspaso; desde la app se usa la misma `claveNombre` del importador.
insert into public.docentes (usuario_id, nombre, nombre_normalizado, rol)
select
  existentes.usuario_id,
  existentes.nombre,
  lower(trim(regexp_replace(existentes.nombre, '\s+', ' ', 'g'))),
  'titular'
from (
  select usuario_id, min(trim(profe)) as nombre
  from public.clases
  where profe is not null and length(trim(profe)) > 0
  group by usuario_id, lower(trim(regexp_replace(profe, '\s+', ' ', 'g')))
) existentes
where not exists (
  select 1
  from public.docentes d
  where d.usuario_id = existentes.usuario_id
    and d.nombre_normalizado = lower(trim(regexp_replace(existentes.nombre, '\s+', ' ', 'g')))
);

update public.clases c
set docente_id = d.id
from public.docentes d
where c.docente_id is null
  and c.usuario_id = d.usuario_id
  and lower(trim(regexp_replace(c.profe, '\s+', ' ', 'g'))) = d.nombre_normalizado;

create index if not exists clases_docente_idx on public.clases (docente_id);
create index if not exists docentes_usuario_rol_idx on public.docentes (usuario_id, rol, nombre);

create table if not exists public.lista_espera (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references auth.users (id) on delete cascade default auth.uid(),
  nombre           text not null check (length(trim(nombre)) > 0),
  telefono         text not null check (length(trim(telefono)) > 0),
  clase_id         text references public.clases (id) on delete set null,
  fecha_solicitud  date not null default current_date,
  estado           text not null default 'esperando'
                   check (estado in ('esperando', 'contactado', 'ingreso', 'baja')),
  notas            text not null default '',
  creado_en        timestamptz not null default now()
);

create index if not exists espera_usuario_estado_idx
  on public.lista_espera (usuario_id, estado, fecha_solicitud);
create index if not exists espera_clase_idx on public.lista_espera (clase_id);

alter table public.docentes     enable row level security;
alter table public.lista_espera enable row level security;

create policy "docentes son del dueño" on public.docentes
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create policy "lista de espera es del dueño" on public.lista_espera
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (
    usuario_id = auth.uid()
    and (
      clase_id is null
      or exists (
        select 1 from public.clases c
        where c.id = lista_espera.clase_id and c.usuario_id = auth.uid()
      )
    )
  );
