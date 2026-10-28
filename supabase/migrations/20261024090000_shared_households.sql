-- ═══════════════════════════════════════════════════════════════════
-- 🏠 Espacio compartido (hogar)
--
-- Hasta ahora cada cuenta era un mundo aislado: todas las tablas tenían
-- `user_id` y las políticas RLS solo dejaban ver `auth.uid() = user_id`.
--
-- Este cambio introduce un "hogar" (`households`) con miembros
-- (`household_members`). Todos los datos (movimientos, categorías, medios
-- de pago, presupuestos y compromisos) pertenecen a un hogar y cualquier
-- miembro puede verlos y editarlos.
--
-- Reglas:
--   • Cada usuario nuevo recibe un hogar personal al registrarse.
--   • Para compartir se usa un código de invitación de 8 caracteres.
--   • Al unirse con un código, los datos del hogar personal se MUEVEN al
--     hogar destino (no se pierde nada). Solo se permite si el usuario
--     aún no comparte su hogar con nadie.
--   • `user_id` se conserva como "quién creó el registro"; el acceso se
--     decide por pertenencia al hogar.
--
-- Ejecutar con Supabase CLI:
--   supabase db push
-- o pegando este archivo en el SQL Editor del proyecto.
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- 1. Tablas del hogar
-- ───────────────────────────────────────────────────────────────────

create table if not exists public.households (
  id          uuid                     not null default gen_random_uuid(),
  name        text                     not null default 'Mi espacio',
  invite_code text                     not null,
  created_by  uuid                     not null,
  created_at  timestamp with time zone not null default now(),

  constraint households_pkey primary key (id),
  constraint households_invite_code_key unique (invite_code),
  constraint households_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete cascade
);

alter table public.households enable row level security;

create table if not exists public.household_members (
  household_id uuid                     not null,
  user_id      uuid                     not null,
  role         text                     not null default 'member',
  joined_at    timestamp with time zone not null default now(),

  constraint household_members_pkey primary key (household_id, user_id),
  constraint household_members_role_check check (role in ('owner', 'member')),
  constraint household_members_household_id_fkey
    foreign key (household_id) references public.households(id) on delete cascade,
  constraint household_members_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade
);

create index if not exists household_members_user_idx
  on public.household_members (user_id);

alter table public.household_members enable row level security;

-- ───────────────────────────────────────────────────────────────────
-- 2. Utilidades
-- ───────────────────────────────────────────────────────────────────

-- ¿El usuario autenticado pertenece a este hogar?
-- SECURITY DEFINER para poder consultarse desde las políticas sin que la
-- propia RLS de `household_members` provoque recursión.
create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = p_household_id
      and hm.user_id = auth.uid()
  );
$$;

-- Código de invitación legible (sin caracteres ambiguos: 0/O, 1/I).
create or replace function public.generate_invite_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code     text;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.households where invite_code = code);
  end loop;
  return code;
end;
$$;

-- Crea un hogar personal y agrega al usuario como propietario.
create or replace function public.create_personal_household(
  p_user_id uuid,
  p_name    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_household_id uuid;
begin
  insert into public.households (name, invite_code, created_by)
  values (
    coalesce(nullif(trim(p_name), ''), 'Mi espacio'),
    public.generate_invite_code(),
    p_user_id
  )
  returning id into v_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (v_household_id, p_user_id, 'owner')
  on conflict (household_id, user_id) do nothing;

  return v_household_id;
end;
$$;

-- ───────────────────────────────────────────────────────────────────
-- 3. Alta de usuario: perfil + hogar personal
-- ───────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;

  if not exists (
    select 1 from public.household_members where user_id = new.id
  ) then
    perform public.create_personal_household(
      new.id,
      new.raw_user_meta_data ->> 'full_name'
    );
  end if;

  return new;
end;
$function$;

-- ───────────────────────────────────────────────────────────────────
-- 4. `household_id` en las tablas de datos
-- ───────────────────────────────────────────────────────────────────

alter table public.categories
  add column if not exists household_id uuid;
alter table public.payment_methods
  add column if not exists household_id uuid;
alter table public.transactions
  add column if not exists household_id uuid;
alter table public.budgets
  add column if not exists household_id uuid;
alter table public.recurring_charges
  add column if not exists household_id uuid;

-- Backfill: cada usuario existente conserva sus datos en su propio hogar.
do $$
declare
  u record;
  v_household_id uuid;
begin
  for u in select id, raw_user_meta_data from auth.users loop
    select hm.household_id
      into v_household_id
      from public.household_members hm
     where hm.user_id = u.id
     order by hm.joined_at
     limit 1;

    if v_household_id is null then
      v_household_id := public.create_personal_household(
        u.id,
        u.raw_user_meta_data ->> 'full_name'
      );
    end if;

    update public.categories
       set household_id = v_household_id
     where user_id = u.id and household_id is null;
    update public.payment_methods
       set household_id = v_household_id
     where user_id = u.id and household_id is null;
    update public.transactions
       set household_id = v_household_id
     where user_id = u.id and household_id is null;
    update public.budgets
       set household_id = v_household_id
     where user_id = u.id and household_id is null;
    update public.recurring_charges
       set household_id = v_household_id
     where user_id = u.id and household_id is null;
  end loop;
end;
$$;

alter table public.categories
  alter column household_id set not null;
alter table public.payment_methods
  alter column household_id set not null;
alter table public.transactions
  alter column household_id set not null;
alter table public.budgets
  alter column household_id set not null;
alter table public.recurring_charges
  alter column household_id set not null;

alter table public.categories
  drop constraint if exists categories_household_id_fkey;
alter table public.categories
  add constraint categories_household_id_fkey
  foreign key (household_id) references public.households(id) on delete cascade;
alter table public.payment_methods
  drop constraint if exists payment_methods_household_id_fkey;
alter table public.payment_methods
  add constraint payment_methods_household_id_fkey
  foreign key (household_id) references public.households(id) on delete cascade;
alter table public.transactions
  drop constraint if exists transactions_household_id_fkey;
alter table public.transactions
  add constraint transactions_household_id_fkey
  foreign key (household_id) references public.households(id) on delete cascade;
alter table public.budgets
  drop constraint if exists budgets_household_id_fkey;
alter table public.budgets
  add constraint budgets_household_id_fkey
  foreign key (household_id) references public.households(id) on delete cascade;
alter table public.recurring_charges
  drop constraint if exists recurring_charges_household_id_fkey;
alter table public.recurring_charges
  add constraint recurring_charges_household_id_fkey
  foreign key (household_id) references public.households(id) on delete cascade;

create index if not exists categories_household_idx
  on public.categories (household_id);
create index if not exists payment_methods_household_idx
  on public.payment_methods (household_id);
create index if not exists transactions_household_date_idx
  on public.transactions (household_id, date);
create index if not exists budgets_household_idx
  on public.budgets (household_id);
create index if not exists recurring_charges_household_idx
  on public.recurring_charges (household_id);

-- El presupuesto es único por hogar + categoría + mes.
alter table public.budgets
  drop constraint if exists budgets_user_id_category_id_month_key;
alter table public.budgets
  drop constraint if exists budgets_household_id_category_id_month_key;
alter table public.budgets
  add constraint budgets_household_id_category_id_month_key
  unique (household_id, category_id, month);

-- ───────────────────────────────────────────────────────────────────
-- 4b. Helpers que dependen de `transactions.household_id`
--     (deben crearse DESPUÉS de agregar la columna: una función
--     `language sql` valida su cuerpo al crearse)
-- ───────────────────────────────────────────────────────────────────

-- ¿El usuario autenticado puede acceder a este movimiento (y su desglose)?
create or replace function public.can_access_transaction(p_transaction_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.transactions t
    where t.id = p_transaction_id
      and public.is_household_member(t.household_id)
  );
$$;

-- ───────────────────────────────────────────────────────────────────
-- 5. Políticas RLS del hogar
-- ───────────────────────────────────────────────────────────────────

drop policy if exists "households_select_member" on public.households;
create policy "households_select_member" on public.households
  for select to authenticated
  using (public.is_household_member(id));

drop policy if exists "households_update_member" on public.households;
create policy "households_update_member" on public.households
  for update to authenticated
  using (public.is_household_member(id))
  with check (public.is_household_member(id));

drop policy if exists "household_members_select_member" on public.household_members;
create policy "household_members_select_member" on public.household_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_household_member(household_id));

-- Perfiles de los compañeros de hogar (para mostrar nombres).
drop policy if exists "profiles_select_household" on public.profiles;
create policy "profiles_select_household" on public.profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.household_members hm
      where hm.user_id = profiles.id
        and public.is_household_member(hm.household_id)
    )
  );

-- ── Reemplazo de las políticas "own" por pertenencia al hogar ──

drop policy if exists "categories_select_own" on public.categories;
drop policy if exists "categories_insert_own" on public.categories;
drop policy if exists "categories_update_own" on public.categories;
drop policy if exists "categories_delete_own" on public.categories;

create policy "categories_select_household" on public.categories
  for select to authenticated
  using (public.is_household_member(household_id));
create policy "categories_insert_household" on public.categories
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id));
create policy "categories_update_household" on public.categories
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "categories_delete_household" on public.categories
  for delete to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "payment_methods_select_own" on public.payment_methods;
drop policy if exists "payment_methods_insert_own" on public.payment_methods;
drop policy if exists "payment_methods_update_own" on public.payment_methods;
drop policy if exists "payment_methods_delete_own" on public.payment_methods;

create policy "payment_methods_select_household" on public.payment_methods
  for select to authenticated
  using (public.is_household_member(household_id));
create policy "payment_methods_insert_household" on public.payment_methods
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id));
create policy "payment_methods_update_household" on public.payment_methods
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "payment_methods_delete_household" on public.payment_methods
  for delete to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "transactions_select_own" on public.transactions;
drop policy if exists "transactions_insert_own" on public.transactions;
drop policy if exists "transactions_update_own" on public.transactions;
drop policy if exists "transactions_delete_own" on public.transactions;

create policy "transactions_select_household" on public.transactions
  for select to authenticated
  using (public.is_household_member(household_id));
create policy "transactions_insert_household" on public.transactions
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id));
create policy "transactions_update_household" on public.transactions
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "transactions_delete_household" on public.transactions
  for delete to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "budgets_select_own" on public.budgets;
drop policy if exists "budgets_insert_own" on public.budgets;
drop policy if exists "budgets_update_own" on public.budgets;
drop policy if exists "budgets_delete_own" on public.budgets;

create policy "budgets_select_household" on public.budgets
  for select to authenticated
  using (public.is_household_member(household_id));
create policy "budgets_insert_household" on public.budgets
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id));
create policy "budgets_update_household" on public.budgets
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "budgets_delete_household" on public.budgets
  for delete to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "recurring_charges_select_own" on public.recurring_charges;
drop policy if exists "recurring_charges_insert_own" on public.recurring_charges;
drop policy if exists "recurring_charges_update_own" on public.recurring_charges;
drop policy if exists "recurring_charges_delete_own" on public.recurring_charges;

create policy "recurring_charges_select_household" on public.recurring_charges
  for select to authenticated
  using (public.is_household_member(household_id));
create policy "recurring_charges_insert_household" on public.recurring_charges
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id));
create policy "recurring_charges_update_household" on public.recurring_charges
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "recurring_charges_delete_household" on public.recurring_charges
  for delete to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "transaction_details_select_own" on public.transaction_details;
drop policy if exists "transaction_details_insert_own" on public.transaction_details;
drop policy if exists "transaction_details_update_own" on public.transaction_details;
drop policy if exists "transaction_details_delete_own" on public.transaction_details;

create policy "transaction_details_select_household" on public.transaction_details
  for select to authenticated
  using (public.can_access_transaction(transaction_id));
create policy "transaction_details_insert_household" on public.transaction_details
  for insert to authenticated
  with check (public.can_access_transaction(transaction_id));
create policy "transaction_details_update_household" on public.transaction_details
  for update to authenticated
  using (public.can_access_transaction(transaction_id))
  with check (public.can_access_transaction(transaction_id));
create policy "transaction_details_delete_household" on public.transaction_details
  for delete to authenticated
  using (public.can_access_transaction(transaction_id));

-- ───────────────────────────────────────────────────────────────────
-- 6. RPCs de invitación
-- ───────────────────────────────────────────────────────────────────

/**
 * Une al usuario autenticado al hogar dueño del código.
 * Si el usuario vive solo, mueve todos sus datos al hogar destino.
 */
create or replace function public.join_household(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id      uuid := auth.uid();
  v_target       public.households%rowtype;
  v_current_id   uuid;
  v_member_count int;
  v_new_id       uuid;
  rec            record;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  select *
    into v_target
    from public.households
   where invite_code = upper(trim(p_code));

  if not found then
    raise exception 'Código de invitación inválido.';
  end if;

  if exists (
    select 1 from public.household_members
     where household_id = v_target.id and user_id = v_user_id
  ) then
    return v_target.id;
  end if;

  select household_id
    into v_current_id
    from public.household_members
   where user_id = v_user_id
   order by joined_at
   limit 1;

  if v_current_id is not null then
    select count(*)
      into v_member_count
      from public.household_members
     where household_id = v_current_id;

    if v_member_count > 1 then
      raise exception 'Ya compartes un espacio. Sal de él antes de unirte a otro.';
    end if;

    -- Categorías: si el hogar destino ya tiene una con el mismo nombre y
    -- tipo, se reutiliza (así no se duplican las categorías por defecto).
    -- Antes de borrar la categoría vieja se reapuntan sus referencias.
    for rec in
      select * from public.categories where household_id = v_current_id
    loop
      select c.id
        into v_new_id
        from public.categories c
       where c.household_id = v_target.id
         and lower(c.name) = lower(rec.name)
         and c.type = rec.type
       limit 1;

      if v_new_id is not null then
        update public.transaction_details
           set category_id = v_new_id
         where category_id = rec.id;
        update public.budgets
           set category_id = v_new_id
         where category_id = rec.id;
        update public.recurring_charges
           set category_id = v_new_id
         where category_id = rec.id;
        delete from public.categories where id = rec.id;
      else
        update public.categories
           set household_id = v_target.id
         where id = rec.id;
      end if;
    end loop;

    -- Métodos de pago: misma fusión por nombre (y tipo).
    for rec in
      select * from public.payment_methods where household_id = v_current_id
    loop
      select p.id
        into v_new_id
        from public.payment_methods p
       where p.household_id = v_target.id
         and lower(p.name) = lower(rec.name)
         and p.type = rec.type
       limit 1;

      if v_new_id is not null then
        update public.transactions
           set payment_method_id = v_new_id
         where payment_method_id = rec.id;
        update public.recurring_charges
           set payment_method_id = v_new_id
         where payment_method_id = rec.id;
        delete from public.payment_methods where id = rec.id;
      else
        update public.payment_methods
           set household_id = v_target.id
         where id = rec.id;
      end if;
    end loop;

    update public.transactions
       set household_id = v_target.id
     where household_id = v_current_id;
    update public.recurring_charges
       set household_id = v_target.id
     where household_id = v_current_id;

    -- Presupuestos: si el hogar destino ya presupuestó la misma categoría
    -- y mes, se conserva el del destino para no violar la restricción única.
    delete from public.budgets b
     where b.household_id = v_current_id
       and exists (
         select 1
           from public.budgets t
          where t.household_id = v_target.id
            and t.category_id = b.category_id
            and t.month = b.month
       );

    -- Duplicados internos que pudieron aparecer al fusionar categorías.
    delete from public.budgets b
     using public.budgets d
     where b.household_id = v_current_id
       and d.household_id = v_current_id
       and b.category_id = d.category_id
       and b.month = d.month
       and b.id <> d.id
       and b.created_at < d.created_at;

    update public.budgets
       set household_id = v_target.id
     where household_id = v_current_id;

    -- El hogar personal queda vacío; al borrarlo se borra la membresía.
    delete from public.households where id = v_current_id;
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (v_target.id, v_user_id, 'member');

  return v_target.id;
end;
$$;

/**
 * Saca al usuario del hogar compartido. Los datos permanecen en el hogar
 * (son compartidos) y el usuario recibe un hogar personal nuevo.
 */
create or replace function public.leave_household()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id      uuid := auth.uid();
  v_current_id   uuid;
  v_member_count int;
  v_new_id       uuid;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  select household_id
    into v_current_id
    from public.household_members
   where user_id = v_user_id
   order by joined_at
   limit 1;

  if v_current_id is null then
    raise exception 'No perteneces a ningún espacio.';
  end if;

  select count(*)
    into v_member_count
    from public.household_members
   where household_id = v_current_id;

  if v_member_count <= 1 then
    raise exception 'No compartes tu espacio con nadie.';
  end if;

  delete from public.household_members
   where household_id = v_current_id and user_id = v_user_id;

  v_new_id := public.create_personal_household(v_user_id, 'Mi espacio');
  return v_new_id;
end;
$$;

/** Regenera el código de invitación del hogar actual. */
create or replace function public.regenerate_invite_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_code text;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  select household_id
    into v_household_id
    from public.household_members
   where user_id = v_user_id
   order by joined_at
   limit 1;

  if v_household_id is null then
    raise exception 'No perteneces a ningún espacio.';
  end if;

  v_code := public.generate_invite_code();

  update public.households
     set invite_code = v_code
   where id = v_household_id;

  return v_code;
end;
$$;

-- ───────────────────────────────────────────────────────────────────
-- 7. Permisos
-- ───────────────────────────────────────────────────────────────────

grant select, insert, update, delete on table public.households
  to authenticated;
grant select, insert, update, delete on table public.household_members
  to authenticated;

grant execute on function public.is_household_member(uuid)
  to authenticated;
grant execute on function public.can_access_transaction(uuid)
  to authenticated;
grant execute on function public.join_household(text)
  to authenticated;
grant execute on function public.leave_household()
  to authenticated;
grant execute on function public.regenerate_invite_code()
  to authenticated;

revoke execute on function public.join_household(text) from anon;
revoke execute on function public.leave_household() from anon;
revoke execute on function public.regenerate_invite_code() from anon;

-- Helpers internos: solo los usan el trigger y las RPC SECURITY DEFINER.
revoke execute on function public.generate_invite_code() from public, anon, authenticated;
revoke execute on function public.create_personal_household(uuid, text)
  from public, anon, authenticated;
