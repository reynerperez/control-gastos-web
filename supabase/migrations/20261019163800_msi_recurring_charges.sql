-- ═══════════════════════════════════════════════════════════════════
-- 💳 MSI (Meses Sin Intereses) + compromisos recurrentes
--
-- Regla de diseño: NO se duplican filas por cada mes futuro.
--   • Una compra a MSI sigue siendo UNA fila en `transactions`; el plan
--     (número de parcialidades y fecha del primer corte) se guarda en la
--     misma cabecera. El calendario de parcialidades se deriva en la app.
--   • Los servicios/suscripciones (Luz, Internet, Netflix…) viven en
--     `recurring_charges` y también se proyectan en la app; no generan
--     movimientos automáticos (el usuario registra el pago real).
--
-- Ejecutar con Supabase CLI:
--   supabase db push
-- o pegando este archivo en el SQL Editor del proyecto.
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- 1. Plan de MSI en la cabecera del movimiento
-- ───────────────────────────────────────────────────────────────────

alter table public.transactions
  add column if not exists purchase_type text not null default 'one_time',
  add column if not exists installments_count smallint,
  add column if not exists installments_paid smallint not null default 0,
  -- Fecha de corte del primer estado de cuenta donde aparece la compra.
  -- Se calcula al crear el movimiento para que el calendario no se mueva
  -- si luego cambia el día de corte de la tarjeta o la fecha del registro.
  add column if not exists installments_start_date date,
  -- Cuando se liquida anticipadamente, se deja de proyectar el resto.
  add column if not exists installments_settled_at timestamptz;

alter table public.transactions
  drop constraint if exists transactions_purchase_type_check;

alter table public.transactions
  add constraint transactions_purchase_type_check
  check (purchase_type in ('one_time', 'installments'));

alter table public.transactions
  drop constraint if exists transactions_installments_plan_check;

alter table public.transactions
  add constraint transactions_installments_plan_check
  check (
    (purchase_type = 'one_time' and installments_count is null)
    or
    (purchase_type = 'installments' and installments_count between 2 and 60)
  );

alter table public.transactions
  drop constraint if exists transactions_installments_paid_check;

alter table public.transactions
  add constraint transactions_installments_paid_check
  check (
    installments_paid >= 0
    and (installments_count is null or installments_paid <= installments_count)
  );

alter table public.transactions
  drop constraint if exists transactions_msi_is_expense_check;

alter table public.transactions
  add constraint transactions_msi_is_expense_check
  check (purchase_type = 'one_time' or type = 'expense');

-- Índice parcial: solo las compras que realmente tienen plan activo.
create index if not exists transactions_installments_idx
  on public.transactions (user_id, payment_method_id, installments_start_date)
  where purchase_type = 'installments';

-- ───────────────────────────────────────────────────────────────────
-- 2. Compromisos recurrentes indeterminados
--    (Luz, Internet, agua, renta, suscripciones…)
-- ───────────────────────────────────────────────────────────────────

create table if not exists public.recurring_charges (
  id                uuid                     not null default gen_random_uuid(),
  user_id           uuid                     not null,
  name              text                     not null,
  category_id       uuid,
  payment_method_id uuid,
  -- Monto estimado. Si `is_variable_amount` es true, la UI lo marca como
  -- "estimado" y el usuario puede ajustarlo al registrar el pago real.
  amount            numeric(12,2)            not null,
  is_variable_amount boolean                 not null default false,
  frequency         text                     not null default 'monthly',
  charge_day        smallint                 not null,
  start_date        date                     not null default current_date,
  end_date          date,
  active            boolean                  not null default true,
  note              text,
  created_at        timestamp with time zone not null default now(),
  updated_at        timestamp with time zone not null default now(),

  constraint recurring_charges_pkey primary key (id),
  constraint recurring_charges_amount_check check (amount > 0),
  constraint recurring_charges_charge_day_check check (charge_day between 1 and 31),
  constraint recurring_charges_frequency_check check (frequency in ('monthly', 'yearly')),
  constraint recurring_charges_dates_check check (end_date is null or end_date >= start_date),
  constraint recurring_charges_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade,
  constraint recurring_charges_category_id_fkey
    foreign key (category_id) references public.categories(id) on delete set null,
  constraint recurring_charges_payment_method_id_fkey
    foreign key (payment_method_id) references public.payment_methods(id) on delete set null
);

create index if not exists recurring_charges_user_idx
  on public.recurring_charges (user_id);

create index if not exists recurring_charges_active_idx
  on public.recurring_charges (user_id, active)
  where active = true;

alter table public.recurring_charges enable row level security;

drop policy if exists "recurring_charges_select_own" on public.recurring_charges;
create policy "recurring_charges_select_own" on public.recurring_charges
  for select to public
  using (auth.uid() = user_id);

drop policy if exists "recurring_charges_insert_own" on public.recurring_charges;
create policy "recurring_charges_insert_own" on public.recurring_charges
  for insert to public
  with check (auth.uid() = user_id);

drop policy if exists "recurring_charges_update_own" on public.recurring_charges;
create policy "recurring_charges_update_own" on public.recurring_charges
  for update to public
  using (auth.uid() = user_id);

drop policy if exists "recurring_charges_delete_own" on public.recurring_charges;
create policy "recurring_charges_delete_own" on public.recurring_charges
  for delete to public
  using (auth.uid() = user_id);

-- `updated_at` automático
create or replace function public.touch_recurring_charges_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recurring_charges_touch_updated_at on public.recurring_charges;
create trigger recurring_charges_touch_updated_at
  before update on public.recurring_charges
  for each row
  execute function public.touch_recurring_charges_updated_at();

grant select, insert, update, delete on table public.recurring_charges
  to anon, authenticated;
grant select, insert, update, delete on table public.recurring_charges
  to service_role;

grant execute on function public.touch_recurring_charges_updated_at()
  to anon, authenticated, service_role;
