-- ─── Varios docentes por clase ──────────────────────────────────────────────
-- Una clase puede quedar a cargo de más de una persona: dos profes y una suplente
-- en el mismo horario es lo normal en los grupos grandes. Hasta acá
-- `clases.docente_id` admitía uno solo, así que asignar a otra persona TRANSFERÍA
-- la clase en vez de sumarla.
--
-- La forma es la misma que `participantes`: una tabla de cruce, sin `usuario_id`
-- propio (la política sale del dueño de la clase, y un `usuario_id` acá sería un
-- dato que puede contradecir al de su clase) y sin ningún contador guardado.

create table if not exists public.clase_docentes (
  clase_id   text not null references public.clases (id) on delete cascade,
  docente_id uuid not null references public.docentes (id) on delete cascade,
  primary key (clase_id, docente_id)
);

-- Para la vuelta del cruce: qué clases tiene a cargo una docente.
create index if not exists clase_docentes_docente_idx on public.clase_docentes (docente_id);

-- Lo que ya estaba asignado pasa tal cual: nadie pierde su clase en la migración.
insert into public.clase_docentes (clase_id, docente_id)
select id, docente_id
from public.clases
where docente_id is not null
on conflict do nothing;

alter table public.clase_docentes enable row level security;

drop policy if exists "docentes de la clase siguen al dueño" on public.clase_docentes;
create policy "docentes de la clase siguen al dueño" on public.clase_docentes
  for all to authenticated
  using (
    exists (
      select 1 from public.clases c
      where c.id = clase_docentes.clase_id and c.usuario_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clases c
      where c.id = clase_docentes.clase_id and c.usuario_id = auth.uid()
    )
    and exists (
      select 1 from public.docentes d
      where d.id = clase_docentes.docente_id and d.usuario_id = auth.uid()
    )
  );

-- La columna vieja se va. Dejarla sería una segunda respuesta a "quién está a
-- cargo de esta clase", y en cuanto una clase tenga dos docentes las dos respuestas
-- dejan de coincidir. `clases.profe` sigue existiendo como respaldo legible de lo
-- que había antes, pero la app ya no lo escribe ni lo lee: el nombre que se muestra
-- se arma desde esta tabla.
alter table public.clases drop column if exists docente_id;
