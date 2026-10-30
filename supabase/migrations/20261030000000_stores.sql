-- Phase 2: where each product is bought.
-- Every household has its own stores. Every product has one store, and every list item keeps
-- the store its product had when the item was added. Each store is closed on its own inside the
-- monthly list, and the list closes when its last store with items is closed.

-- ---------------------------------------------------------------------------
-- Stores
-- ---------------------------------------------------------------------------

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  sort_order integer not null default 0,
  -- Stores are archived instead of deleted, so past trips keep them.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, household_id)
);

create unique index stores_active_name_idx on public.stores (household_id, lower(trim(name)))
  where archived_at is null;

alter table public.stores enable row level security;

create policy "Members manage stores" on public.stores
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create function public.seed_default_stores(p_household_id uuid)
returns void
language sql
set search_path = ''
as $$
  insert into public.stores (household_id, name, sort_order)
  values (p_household_id, 'Súper', 1), (p_household_id, 'Veterinaria', 2), (p_household_id, 'Química', 3);
$$;

-- An active store leaves only when nothing still needs it, and a household keeps at least one.
create function public.guard_store_removal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.archived_at is not null or new.archived_at is null then
      return new;
    end if;
  -- A household being deleted takes its stores with it.
  elsif old.archived_at is not null
    or not exists (select 1 from public.households where id = old.household_id) then
    return old;
  end if;

  if exists (select 1 from public.products where store_id = old.id and archived_at is null) then
    raise exception 'The store still has products' using errcode = '23503';
  end if;
  if exists (
    select 1 from public.list_items li
    join public.shopping_lists sl on sl.id = li.list_id
    where li.store_id = old.id and li.status = 'pending' and sl.status <> 'closed'
  ) then
    raise exception 'The store has pending items in the open list' using errcode = '23503';
  end if;
  if not exists (
    select 1 from public.stores
    where household_id = old.household_id and id <> old.id and archived_at is null
  ) then
    raise exception 'A household needs at least one store' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger stores_guard_removal
  before update of archived_at or delete on public.stores
  for each row execute function public.guard_store_removal();

-- Existing households get the default stores.
select public.seed_default_stores(id) from public.households;

-- ---------------------------------------------------------------------------
-- Store of each product
-- ---------------------------------------------------------------------------

alter table public.products add column store_id uuid;
alter table public.products
  add constraint products_store_fkey foreign key (store_id, household_id) references public.stores (id, household_id);

-- Existing products start in Súper.
update public.products p
set store_id = s.id
from public.stores s
where s.household_id = p.household_id and s.name = 'Súper';

alter table public.products alter column store_id set not null;
create index products_store_idx on public.products (store_id);

-- A product added without a store goes to the household's first active store,
-- and a product never moves to an archived store.
create function public.assign_product_store()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.store_id is null then
    select id into new.store_id from public.stores
    where household_id = new.household_id and archived_at is null
    order by sort_order, created_at
    limit 1;
  elsif exists (select 1 from public.stores where id = new.store_id and archived_at is not null) then
    raise exception 'The store is archived' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger products_assign_store
  before insert or update of store_id on public.products
  for each row execute function public.assign_product_store();

-- ---------------------------------------------------------------------------
-- Store of each list item
-- ---------------------------------------------------------------------------

alter table public.list_items add column store_id uuid;
alter table public.list_items
  add constraint list_items_store_fkey foreign key (store_id, household_id) references public.stores (id, household_id);

-- The backfill also fills closed lists, which are otherwise read-only, without touching updated_at.
alter table public.list_items disable trigger list_items_guard_closed;
alter table public.list_items disable trigger list_items_touch_updated_at;

update public.list_items li
set store_id = p.store_id
from public.products p
where p.id = li.product_id;

alter table public.list_items enable trigger list_items_guard_closed;
alter table public.list_items enable trigger list_items_touch_updated_at;

alter table public.list_items alter column store_id set not null;
create index list_items_store_idx on public.list_items (list_id, store_id);

-- The store is copied from the product when the item is added and never changes afterwards.
-- Named so it runs before the other before-insert triggers that read store_id.
create function public.assign_list_item_store()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.store_id is distinct from old.store_id then
      raise exception 'A list item cannot change store' using errcode = '22023';
    end if;
    return new;
  end if;

  select store_id into new.store_id from public.products
  where id = new.product_id and household_id = new.household_id;
  if new.store_id is null then
    raise exception 'The product does not belong to the household' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger list_items_assign_store
  before insert or update of store_id on public.list_items
  for each row execute function public.assign_list_item_store();

-- ---------------------------------------------------------------------------
-- Partial closes
-- ---------------------------------------------------------------------------

create table public.list_store_closures (
  list_id uuid not null,
  household_id uuid not null,
  store_id uuid not null,
  closed_by uuid references auth.users (id) on delete set null,
  closed_at timestamptz not null default now(),
  primary key (list_id, store_id),
  foreign key (list_id, household_id) references public.shopping_lists (id, household_id) on delete cascade,
  foreign key (store_id, household_id) references public.stores (id, household_id)
);

alter table public.list_store_closures enable row level security;

-- Closures are permanent: there are no update or delete policies.
create policy "Members read store closures" on public.list_store_closures
  for select to authenticated
  using (public.is_household_member(household_id));

create policy "Members close stores" on public.list_store_closures
  for insert to authenticated
  with check (public.is_household_member(household_id));

-- A store closes only on an open list with none of its items pending. "Who closed it" comes from the session.
create function public.guard_list_store_closure()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.closed_by := auth.uid();
  new.closed_at := now();
  -- Waits for item changes in flight, so a pending item can't slip into a closed store.
  perform 1 from public.shopping_lists where id = new.list_id for update;
  if exists (select 1 from public.shopping_lists where id = new.list_id and status = 'closed') then
    raise exception 'The shopping list is already closed' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.list_items
    where list_id = new.list_id and store_id = new.store_id and status = 'pending'
  ) then
    raise exception 'Cannot close the store with pending items' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger list_store_closures_guard
  before insert on public.list_store_closures
  for each row execute function public.guard_list_store_closure();

-- Items of a closed store are settled and can no longer change.
create function public.guard_closed_store_items()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- The list lock orders item changes against store closes.
  perform 1 from public.shopping_lists where id = coalesce(new.list_id, old.list_id) for share;
  -- A list being deleted takes its items with it.
  if not found then
    return coalesce(new, old);
  end if;
  if exists (
    select 1 from public.list_store_closures
    where list_id = coalesce(new.list_id, old.list_id) and store_id = coalesce(new.store_id, old.store_id)
  ) then
    raise exception 'Items of a closed store cannot change' using errcode = '22023';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger list_items_guard_closed_store
  before insert or update or delete on public.list_items
  for each row execute function public.guard_closed_store_items();

-- Closes one store of the list, and the list itself once no store with items is left open.
-- The list row lock serializes members closing different stores at the same time.
create function public.close_list_store(p_list_id uuid, p_store_id uuid)
returns public.shopping_lists
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_list public.shopping_lists;
begin
  select * into target_list from public.shopping_lists where id = p_list_id for update;
  if target_list.id is null then
    raise exception 'Shopping list not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.list_store_closures where list_id = p_list_id and store_id = p_store_id) then
    raise exception 'The store is already closed for this list' using errcode = '22023';
  end if;

  insert into public.list_store_closures (list_id, household_id, store_id)
  values (p_list_id, target_list.household_id, p_store_id);

  if not exists (
    select 1 from public.list_items li
    where li.list_id = p_list_id
      and not exists (
        select 1 from public.list_store_closures c
        where c.list_id = li.list_id and c.store_id = li.store_id
      )
  ) then
    update public.shopping_lists
    set status = 'closed', closed_at = now()
    where id = p_list_id
    returning * into target_list;
  end if;

  return target_list;
end;
$$;

-- ---------------------------------------------------------------------------
-- Households start with the default stores
-- ---------------------------------------------------------------------------

-- p_catalog: [{ "name": text, "store"?: text, "products": [{ "name": text, "unit": text, "expected": number }] }]
-- A section's products go to the store with that name, or to Súper when it is missing or unknown.
create or replace function public.create_household(p_name text, p_catalog jsonb default '[]'::jsonb)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  household public.households;
  section_entry jsonb;
  product_entry jsonb;
  section_id uuid;
  section_store_id uuid;
  default_store_id uuid;
  section_position integer := 0;
begin
  if caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(p_catalog) <> 'array' then
    raise exception 'Catalog must be a JSON array' using errcode = '22023';
  end if;

  insert into public.households (name, invite_code, created_by)
  values (trim(p_name), public.generate_invite_code(), caller)
  returning * into household;

  insert into public.household_members (household_id, user_id, role)
  values (household.id, caller, 'admin');

  perform public.seed_default_stores(household.id);
  select id into default_store_id from public.stores where household_id = household.id and name = 'Súper';

  for section_entry in select * from jsonb_array_elements(p_catalog) loop
    section_position := section_position + 1;
    insert into public.sections (household_id, name, sort_order)
    values (household.id, trim(section_entry ->> 'name'), section_position)
    returning id into section_id;

    section_store_id := null;
    select id into section_store_id from public.stores
    where household_id = household.id and name = trim(section_entry ->> 'store');

    for product_entry in select * from jsonb_array_elements(coalesce(section_entry -> 'products', '[]'::jsonb)) loop
      insert into public.products (household_id, section_id, store_id, name, unit, expected_monthly_consumption)
      values (
        household.id,
        section_id,
        coalesce(section_store_id, default_store_id),
        trim(product_entry ->> 'name'),
        coalesce(product_entry ->> 'unit', 'unit'),
        coalesce((product_entry ->> 'expected')::numeric, 0)
      );
    end loop;
  end loop;

  return household;
end;
$$;

revoke execute on function public.seed_default_stores(uuid) from public, anon, authenticated;
revoke execute on function public.close_list_store(uuid, uuid) from public, anon;
grant execute on function public.close_list_store(uuid, uuid) to authenticated;
