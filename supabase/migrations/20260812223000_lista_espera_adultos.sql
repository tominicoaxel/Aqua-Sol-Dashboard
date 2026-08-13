-- Incorpora a las personas de 19 a 65 años al grupo Adultos.

alter table public.lista_espera
  drop constraint if exists lista_espera_edad_valida;

alter table public.lista_espera
  add constraint lista_espera_edad_valida
  check (edad is null or edad >= 6);

comment on column public.lista_espera.edad is
  'Edad en años: desde los 6 años; nula solo para registros anteriores.';
