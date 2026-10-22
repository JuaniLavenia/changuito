-- Changuito Phase 1 schema: households, catalog, stock reviews, shopping lists.
-- Every household-owned row carries household_id. RLS limits access to members.
-- Composite foreign keys (id, household_id) stop rows from pointing at another household's data.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), ''),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Households and membership
-- ---------------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  invite_code text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_idx on public.household_members (user_id);

-- Security definer so policies can call it without recursing into household_members RLS.
create function public.is_household_member(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household and user_id = auth.uid()
  );
$$;

create function public.is_household_admin(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household and user_id = auth.uid() and role = 'admin'
  );
$$;

-- 8 characters from an alphabet without look-alikes (no 0/O, 1/I/L).
create function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
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

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  sort_order integer not null default 0,
  unique (id, household_id)
);

create index sections_household_idx on public.sections (household_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  section_id uuid,
  name text not null check (length(trim(name)) between 1 and 80),
  unit text not null default 'unit' check (unit in ('unit', 'kg', 'g', 'l', 'ml', 'pack')),
  preferred_brand text check (preferred_brand is null or length(preferred_brand) <= 60),
  expected_monthly_consumption numeric(10, 3) not null default 0 check (expected_monthly_consumption >= 0),
  -- Products used in past lists are archived, not deleted, so history survives.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (section_id, household_id) references public.sections (id, household_id) on delete set null (section_id)
);

create index products_household_idx on public.products (household_id);

-- ---------------------------------------------------------------------------
-- Stock reviews
-- ---------------------------------------------------------------------------

create table public.stock_reviews (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, household_id)
);

create table public.stock_review_items (
  review_id uuid not null,
  household_id uuid not null,
  product_id uuid not null,
  quantity numeric(10, 3) not null check (quantity >= 0),
  primary key (review_id, product_id),
  foreign key (review_id, household_id) references public.stock_reviews (id, household_id) on delete cascade,
  foreign key (product_id, household_id) references public.products (id, household_id) deferrable initially deferred
);

-- ---------------------------------------------------------------------------
-- Shopping lists and items
-- ---------------------------------------------------------------------------

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  period date not null check (extract(day from period) = 1),
  status text not null default 'draft' check (status in ('draft', 'shopping', 'closed')),
  stock_review_id uuid,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (id, household_id),
  foreign key (stock_review_id, household_id) references public.stock_reviews (id, household_id) on delete set null (stock_review_id),
  check ((status = 'closed') = (closed_at is not null))
);

-- At most one open list per household.
create unique index shopping_lists_one_open_idx on public.shopping_lists (household_id) where status <> 'closed';

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null,
  household_id uuid not null,
  product_id uuid not null,
  quantity numeric(10, 3) not null check (quantity > 0),
  status text not null default 'pending' check (status in ('pending', 'in_cart', 'skipped')),
  skip_reason text check (skip_reason in ('unavailable', 'too_expensive')),
  price numeric(12, 2) check (price is null or price >= 0),
  brand text check (brand is null or length(brand) <= 60),
  checked_by uuid references auth.users (id) on delete set null,
  carried_over boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (list_id, product_id),
  foreign key (list_id, household_id) references public.shopping_lists (id, household_id) on delete cascade,
  foreign key (product_id, household_id) references public.products (id, household_id) deferrable initially deferred,
  check ((status = 'skipped') = (skip_reason is not null)),
  check (status = 'in_cart' or (price is null and checked_by is null))
);

create index list_items_household_idx on public.list_items (household_id);

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger list_items_touch_updated_at
  before update on public.list_items
  for each row execute function public.touch_updated_at();

-- "Who checked it" always comes from the session, never from the client payload.
create function public.stamp_checked_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'in_cart' and auth.uid() is not null
    and (tg_op = 'INSERT' or old.status is distinct from 'in_cart' or new.checked_by is distinct from old.checked_by) then
    new.checked_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger list_items_stamp_checked_by
  before insert or update on public.list_items
  for each row execute function public.stamp_checked_by();

-- A list closes only with no pending items, and a closed list stays closed.
create function public.guard_shopping_list_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'closed' and new.status <> 'closed' then
    raise exception 'A closed shopping list cannot be reopened' using errcode = '22023';
  end if;
  if new.status = 'closed' and old.status <> 'closed' and exists (
    select 1 from public.list_items where list_id = new.id and status = 'pending'
  ) then
    raise exception 'Cannot close the list with pending items' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger shopping_lists_guard_status
  before update of status on public.shopping_lists
  for each row execute function public.guard_shopping_list_status();

-- Items of a closed list are history and can no longer change.
create function public.guard_closed_list_items()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target uuid := coalesce(new.list_id, old.list_id);
begin
  if exists (select 1 from public.shopping_lists where id = target and status = 'closed') then
    raise exception 'Items of a closed shopping list cannot change' using errcode = '22023';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger list_items_guard_closed
  before insert or update or delete on public.list_items
  for each row execute function public.guard_closed_list_items();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.sections enable row level security;
alter table public.products enable row level security;
alter table public.stock_reviews enable row level security;
alter table public.stock_review_items enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.list_items enable row level security;

create policy "Read own profile and housemates" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.household_members mine
      join public.household_members theirs on theirs.household_id = mine.household_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );

create policy "Update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Households are created, joined and re-keyed only through the RPCs below.
create policy "Members read their households" on public.households
  for select to authenticated
  using (public.is_household_member(id));

create policy "Members read household membership" on public.household_members
  for select to authenticated
  using (public.is_household_member(household_id));

create policy "Members manage sections" on public.sections
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "Members manage products" on public.products
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "Members manage stock reviews" on public.stock_reviews
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "Members manage stock review items" on public.stock_review_items
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "Members manage shopping lists" on public.shopping_lists
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "Members manage list items" on public.list_items
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Creates the household, makes the caller admin and copies the chosen catalog.
-- p_catalog: [{ "name": text, "products": [{ "name": text, "unit": text, "expected": number }] }]
create function public.create_household(p_name text, p_catalog jsonb default '[]'::jsonb)
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

  for section_entry in select * from jsonb_array_elements(p_catalog) loop
    section_position := section_position + 1;
    insert into public.sections (household_id, name, sort_order)
    values (household.id, trim(section_entry ->> 'name'), section_position)
    returning id into section_id;

    for product_entry in select * from jsonb_array_elements(coalesce(section_entry -> 'products', '[]'::jsonb)) loop
      insert into public.products (household_id, section_id, name, unit, expected_monthly_consumption)
      values (
        household.id,
        section_id,
        trim(product_entry ->> 'name'),
        coalesce(product_entry ->> 'unit', 'unit'),
        coalesce((product_entry ->> 'expected')::numeric, 0)
      );
    end loop;
  end loop;

  return household;
end;
$$;

create function public.join_household(p_invite_code text)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  household public.households;
begin
  if caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into household from public.households
  where invite_code = upper(trim(p_invite_code));

  if household.id is null then
    raise exception 'Invalid invite code' using errcode = 'P0002';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (household.id, caller, 'member')
  on conflict (household_id, user_id) do nothing;

  return household;
end;
$$;

create function public.regenerate_invite_code(p_household_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_code text;
begin
  if not public.is_household_admin(p_household_id) then
    raise exception 'Only the household admin can regenerate the invite code' using errcode = '42501';
  end if;

  new_code := public.generate_invite_code();
  update public.households set invite_code = new_code where id = p_household_id;
  return new_code;
end;
$$;

-- Closes the list only when every item is in the cart or skipped with a reason.
create function public.close_shopping_list(p_list_id uuid)
returns public.shopping_lists
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_list public.shopping_lists;
  pending_count integer;
begin
  select * into target_list from public.shopping_lists where id = p_list_id for update;
  if target_list.id is null then
    raise exception 'Shopping list not found' using errcode = 'P0002';
  end if;
  if target_list.status = 'closed' then
    raise exception 'Shopping list is already closed' using errcode = '22023';
  end if;

  select count(*) into pending_count from public.list_items
  where list_id = p_list_id and status = 'pending';
  if pending_count > 0 then
    raise exception 'Cannot close the list with % pending item(s)', pending_count using errcode = '22023';
  end if;

  update public.shopping_lists
  set status = 'closed', closed_at = now()
  where id = p_list_id
  returning * into target_list;

  return target_list;
end;
$$;

revoke execute on function public.create_household(text, jsonb) from public, anon;
revoke execute on function public.join_household(text) from public, anon;
revoke execute on function public.regenerate_invite_code(uuid) from public, anon;
revoke execute on function public.close_shopping_list(uuid) from public, anon;
revoke execute on function public.generate_invite_code() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.create_household(text, jsonb) to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;
grant execute on function public.close_shopping_list(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: phones in the store see each other's check-offs.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.list_items;
