-- ═══════════════════════════════════════════════════════════════════
-- 💳 Fecha de pago derivada + calendario bancario de México
--
-- La fecha límite de pago NO es un día fijo del mes. Lo estático es:
--   • día de corte (no se mueve)
--   • días de gracia (naturales o hábiles)
--
-- `due_day` se elimina después de hacer el backfill. La fecha de pago se
-- calcula con `grace_days`; la web ya no guarda un día fijo de pago.
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- 1. Configuración de gracia por tarjeta
-- ───────────────────────────────────────────────────────────────────

alter table public.payment_methods
  add column if not exists cardholder_name text,
  add column if not exists grace_days smallint,
  add column if not exists grace_days_type text not null default 'natural';

-- Backfill: conservar el comportamiento actual lo más posible.
-- Se toma el próximo corte y se calculan los días naturales hasta el
-- antiguo `due_day`. Si no hay datos, se usa 20.
do $$
declare
  r record;
  v_base date := date_trunc('month', current_date)::date;
  v_closing_date date;
  v_due_date date;
  v_closing_day int;
  v_last_day int;
  v_computed int;
begin
  for r in
    select pm.id, pm.closing_day, pm.due_day
    from public.payment_methods pm
    where pm.type = 'credit'
      and pm.closing_day is not null
      and pm.due_day is not null
      and pm.grace_days is null
  loop
    v_last_day := extract(day from (v_base + interval '1 month - 1 day'))::int;
    v_closing_day := least(greatest(r.closing_day, 1), v_last_day);
    v_closing_date := v_base + (v_closing_day - 1);

    if extract(day from current_date)::int > v_closing_day then
      v_closing_date := (v_base + interval '1 month')::date;
      v_last_day := extract(day from (v_closing_date + interval '1 month - 1 day'))::int;
      v_closing_date := v_closing_date
        + (least(greatest(r.closing_day, 1), v_last_day) - 1);
    end if;

    if r.due_day > extract(day from v_closing_date)::int then
      v_last_day := extract(day from (date_trunc('month', v_closing_date) + interval '1 month - 1 day'))::int;
      v_due_date := date_trunc('month', v_closing_date)::date
        + (least(greatest(r.due_day, 1), v_last_day) - 1);
    else
      v_last_day := extract(day from (date_trunc('month', v_closing_date) + interval '2 month - 1 day'))::int;
      v_due_date := (date_trunc('month', v_closing_date) + interval '1 month')::date
        + (least(greatest(r.due_day, 1), v_last_day) - 1);
    end if;

    v_computed := v_due_date - v_closing_date;
    update public.payment_methods
      set grace_days = greatest(0, least(60, v_computed)),
          grace_days_type = coalesce(grace_days_type, 'natural')
      where id = r.id;
  end loop;
end $$;

update public.payment_methods
  set grace_days = 20
  where grace_days is null;

update public.payment_methods
  set grace_days_type = 'natural'
  where grace_days_type is null;

alter table public.payment_methods
  alter column grace_days set default 20,
  alter column grace_days set not null;

alter table public.payment_methods
  drop constraint if exists payment_methods_grace_days_check;

alter table public.payment_methods
  add constraint payment_methods_grace_days_check
  check (grace_days between 0 and 60);

alter table public.payment_methods
  drop constraint if exists payment_methods_grace_days_type_check;

alter table public.payment_methods
  add constraint payment_methods_grace_days_type_check
  check (grace_days_type in ('natural', 'business'));

comment on column public.payment_methods.due_day is
  'Deprecado. La web calcula la fecha de pago con grace_days/grace_days_type.';

-- La fecha de pago ya no se guarda: se deriva del corte + días de gracia.
alter table public.payment_methods
  drop column if exists due_day;

-- ───────────────────────────────────────────────────────────────────
-- 2. Calendario global de días inhábiles bancarios (México)
-- ───────────────────────────────────────────────────────────────────

create table if not exists public.holidays (
  id           uuid                     not null default gen_random_uuid(),
  country_code text                     not null default 'MX',
  holiday_date date                     not null,
  name         text                     not null,
  source       text                     not null default 'CNBV',
  created_at   timestamp with time zone not null default now(),
  constraint holidays_pkey primary key (id),
  constraint holidays_country_date_key unique (country_code, holiday_date)
);

create index if not exists holidays_country_date_idx
  on public.holidays (country_code, holiday_date);

alter table public.holidays enable row level security;

drop policy if exists "holidays_select_all" on public.holidays;
create policy "holidays_select_all" on public.holidays
  for select to public
  using (true);

grant select on table public.holidays to anon, authenticated;
grant all on table public.holidays to service_role;

-- Calendario CNBV. 2026 es el oficial publicado; los demás años se
-- generan con las mismas reglas y se pueden corregir manualmente si la
-- CNBV publica cierres extraordinarios.
insert into public.holidays (country_code, holiday_date, name, source) values
  ('MX', '2024-01-01', 'Año Nuevo', 'calculated'),
  ('MX', '2024-02-05', 'Día de la Constitución', 'calculated'),
  ('MX', '2024-03-18', 'Natalicio de Benito Juárez', 'calculated'),
  ('MX', '2024-03-28', 'Jueves Santo', 'calculated'),
  ('MX', '2024-03-29', 'Viernes Santo', 'calculated'),
  ('MX', '2024-05-01', 'Día del Trabajo', 'calculated'),
  ('MX', '2024-09-16', 'Día de la Independencia', 'calculated'),
  ('MX', '2024-11-02', 'Día de Muertos', 'calculated'),
  ('MX', '2024-11-18', 'Revolución Mexicana', 'calculated'),
  ('MX', '2024-12-12', 'Día de la Virgen de Guadalupe', 'calculated'),
  ('MX', '2024-12-25', 'Navidad', 'calculated'),
  ('MX', '2025-01-01', 'Año Nuevo', 'calculated'),
  ('MX', '2025-02-03', 'Día de la Constitución', 'calculated'),
  ('MX', '2025-03-17', 'Natalicio de Benito Juárez', 'calculated'),
  ('MX', '2025-04-17', 'Jueves Santo', 'calculated'),
  ('MX', '2025-04-18', 'Viernes Santo', 'calculated'),
  ('MX', '2025-05-01', 'Día del Trabajo', 'calculated'),
  ('MX', '2025-09-16', 'Día de la Independencia', 'calculated'),
  ('MX', '2025-11-02', 'Día de Muertos', 'calculated'),
  ('MX', '2025-11-17', 'Revolución Mexicana', 'calculated'),
  ('MX', '2025-12-12', 'Día de la Virgen de Guadalupe', 'calculated'),
  ('MX', '2025-12-25', 'Navidad', 'calculated'),
  ('MX', '2026-01-01', 'Año Nuevo', 'CNBV'),
  ('MX', '2026-02-02', 'Día de la Constitución', 'CNBV'),
  ('MX', '2026-03-16', 'Natalicio de Benito Juárez', 'CNBV'),
  ('MX', '2026-04-02', 'Jueves Santo', 'CNBV'),
  ('MX', '2026-04-03', 'Viernes Santo', 'CNBV'),
  ('MX', '2026-05-01', 'Día del Trabajo', 'CNBV'),
  ('MX', '2026-09-16', 'Día de la Independencia', 'CNBV'),
  ('MX', '2026-11-02', 'Día de Muertos', 'CNBV'),
  ('MX', '2026-11-16', 'Revolución Mexicana', 'CNBV'),
  ('MX', '2026-12-12', 'Día de la Virgen de Guadalupe', 'CNBV'),
  ('MX', '2026-12-25', 'Navidad', 'CNBV'),
  ('MX', '2027-01-01', 'Año Nuevo', 'calculated'),
  ('MX', '2027-02-01', 'Día de la Constitución', 'calculated'),
  ('MX', '2027-03-15', 'Natalicio de Benito Juárez', 'calculated'),
  ('MX', '2027-03-25', 'Jueves Santo', 'calculated'),
  ('MX', '2027-03-26', 'Viernes Santo', 'calculated'),
  ('MX', '2027-05-01', 'Día del Trabajo', 'calculated'),
  ('MX', '2027-09-16', 'Día de la Independencia', 'calculated'),
  ('MX', '2027-11-02', 'Día de Muertos', 'calculated'),
  ('MX', '2027-11-15', 'Revolución Mexicana', 'calculated'),
  ('MX', '2027-12-12', 'Día de la Virgen de Guadalupe', 'calculated'),
  ('MX', '2027-12-25', 'Navidad', 'calculated'),
  ('MX', '2028-01-01', 'Año Nuevo', 'calculated'),
  ('MX', '2028-02-07', 'Día de la Constitución', 'calculated'),
  ('MX', '2028-03-20', 'Natalicio de Benito Juárez', 'calculated'),
  ('MX', '2028-04-13', 'Jueves Santo', 'calculated'),
  ('MX', '2028-04-14', 'Viernes Santo', 'calculated'),
  ('MX', '2028-05-01', 'Día del Trabajo', 'calculated'),
  ('MX', '2028-09-16', 'Día de la Independencia', 'calculated'),
  ('MX', '2028-11-02', 'Día de Muertos', 'calculated'),
  ('MX', '2028-11-20', 'Revolución Mexicana', 'calculated'),
  ('MX', '2028-12-12', 'Día de la Virgen de Guadalupe', 'calculated'),
  ('MX', '2028-12-25', 'Navidad', 'calculated'),
  ('MX', '2029-01-01', 'Año Nuevo', 'calculated'),
  ('MX', '2029-02-05', 'Día de la Constitución', 'calculated'),
  ('MX', '2029-03-19', 'Natalicio de Benito Juárez', 'calculated'),
  ('MX', '2029-03-29', 'Jueves Santo', 'calculated'),
  ('MX', '2029-03-30', 'Viernes Santo', 'calculated'),
  ('MX', '2029-05-01', 'Día del Trabajo', 'calculated'),
  ('MX', '2029-09-16', 'Día de la Independencia', 'calculated'),
  ('MX', '2029-11-02', 'Día de Muertos', 'calculated'),
  ('MX', '2029-11-19', 'Revolución Mexicana', 'calculated'),
  ('MX', '2029-12-12', 'Día de la Virgen de Guadalupe', 'calculated'),
  ('MX', '2029-12-25', 'Navidad', 'calculated'),
  ('MX', '2030-01-01', 'Año Nuevo', 'calculated'),
  ('MX', '2030-02-04', 'Día de la Constitución', 'calculated'),
  ('MX', '2030-03-18', 'Natalicio de Benito Juárez', 'calculated'),
  ('MX', '2030-04-18', 'Jueves Santo', 'calculated'),
  ('MX', '2030-04-19', 'Viernes Santo', 'calculated'),
  ('MX', '2030-05-01', 'Día del Trabajo', 'calculated'),
  ('MX', '2030-09-16', 'Día de la Independencia', 'calculated'),
  ('MX', '2030-11-02', 'Día de Muertos', 'calculated'),
  ('MX', '2030-11-18', 'Revolución Mexicana', 'calculated'),
  ('MX', '2030-12-12', 'Día de la Virgen de Guadalupe', 'calculated'),
  ('MX', '2030-12-25', 'Navidad', 'calculated')
on conflict (country_code, holiday_date) do update
  set name = excluded.name,
      source = excluded.source;
