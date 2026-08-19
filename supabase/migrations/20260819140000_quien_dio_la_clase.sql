-- ─── Quién dio la clase cada fecha ──────────────────────────────────────────
-- `clase_docentes` dice quién está A CARGO de un horario: es fijo, vale todas las
-- semanas. Esto es otra cosa: quién la dio REALMENTE un día puntual. Cuando la
-- titular falta y la cubre una suplente, el horario no cambia — lo que cambia es
-- ese martes.
--
-- Sin esta tabla, cubrir una clase obligaba a elegir entre dos mentiras: reasignar
-- el horario (y perder que la titular sigue siendo la titular) o no registrar nada
-- (y perder quién trabajó ese día, que es justo lo que hay que poder mirar después).
--
-- La forma es la de `asistencias`, por el mismo motivo: cuelga de (clase, fecha).
--
-- NO se guarda una fila por clase dictada normalmente. Sin filas para una fecha, la
-- dio quien está a cargo — que es el caso de casi todos los días del año. Las filas
-- aparecen cuando hay algo que contar: una suplencia, dos docentes, un cambio.
create table if not exists public.clases_dictadas (
  clase_id   text not null references public.clases (id) on delete cascade,
  fecha      date not null,
  docente_id uuid not null references public.docentes (id) on delete cascade,
  primary key (clase_id, fecha, docente_id)
);

create index if not exists clases_dictadas_clase_fecha_idx
  on public.clases_dictadas (clase_id, fecha desc);
create index if not exists clases_dictadas_docente_idx
  on public.clases_dictadas (docente_id, fecha desc);

alter table public.clases_dictadas enable row level security;

drop policy if exists "lo dictado sigue al dueño de la clase" on public.clases_dictadas;
create policy "lo dictado sigue al dueño de la clase" on public.clases_dictadas
  for all to authenticated
  using (
    exists (
      select 1 from public.clases c
      where c.id = clases_dictadas.clase_id and c.usuario_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clases c
      where c.id = clases_dictadas.clase_id and c.usuario_id = auth.uid()
    )
    and exists (
      select 1 from public.docentes d
      where d.id = clases_dictadas.docente_id and d.usuario_id = auth.uid()
    )
  );
