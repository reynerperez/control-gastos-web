-- Las tarjetas departamentales conservan su ciclo de pago y sus MSI,
-- pero no participan en las recomendaciones de tarjetas de uso general.
begin;

alter table public.payment_methods
  drop constraint if exists payment_methods_type_check;

alter table public.payment_methods
  add constraint payment_methods_type_check
  check (type in ('debit', 'credit', 'cash', 'departmental'));

-- Reclasificar Liverpool sin cambiar su identificador, compras ni fechas.
update public.payment_methods
set type = 'departmental'
where type = 'credit'
  and btrim(name) ~* '^liverpool([[:space:]]|$)';

commit;
