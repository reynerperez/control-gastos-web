-- ═══════════════════════════════════════════════════════════════════
-- 💳 Fecha de pago fija (día del mes)
--
-- Algunas tarjetas de crédito y departamentales no pagan con días de
-- gracia: tienen un día fijo de pago (por ejemplo, corte 9 y pago 9).
--
-- `due_day` es opcional:
--   • null  → se mantiene la regla actual: corte + grace_days.
--   • 1..31 → la fecha límite es el primer día `due_day` posterior al
--             corte, ajustado al último día del mes si no existe.
--
-- En modo fijo la fecha es exacta: no se recorre a día hábil. Las tarjetas
-- con días de gracia conservan el ajuste CNBV.
-- ═══════════════════════════════════════════════════════════════════

alter table public.payment_methods
  add column if not exists due_day smallint;

alter table public.payment_methods
  drop constraint if exists payment_methods_due_day_check;

alter table public.payment_methods
  add constraint payment_methods_due_day_check
  check (due_day is null or due_day between 1 and 31);

comment on column public.payment_methods.due_day is
  'Día fijo de pago (1-31). Si está definido, la fecha límite es el primer día due_day posterior al corte, sin ajuste a día hábil. Si es null, se usa grace_days/grace_days_type.';
