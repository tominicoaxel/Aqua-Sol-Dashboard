-- Edad para separar la lista de espera en los cuatro grupos de la pileta.
--
-- La columna queda anulable para conservar los pedidos creados antes de esta
-- migración. La pantalla los muestra como "Edad pendiente" hasta que se editen.

alter table public.lista_espera
  add column if not exists edad smallint;

alter table public.lista_espera
  drop constraint if exists lista_espera_edad_valida;

alter table public.lista_espera
  add constraint lista_espera_edad_valida
  check (edad is null or edad between 6 and 18 or edad > 65);

comment on column public.lista_espera.edad is
  'Edad en años: de 6 a 18 o mayor de 65; nula solo para registros anteriores.';
