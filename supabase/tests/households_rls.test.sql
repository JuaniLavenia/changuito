-- Household isolation, invite codes and shopping list integrity.
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

-- Product references are deferred to commit; tests roll back, so check them per statement.
set constraints all immediate;

-- Fixtures ------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'juani@example.com', '{"full_name": "Juani"}'),
  ('00000000-0000-0000-0000-00000000000b', 'dad@example.com', '{"full_name": "Dad"}'),
  ('00000000-0000-0000-0000-00000000000c', 'other@example.com', '{}');

select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'Juani',
  'a profile is created from the Google metadata on sign-up'
);

create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.login(uuid) to authenticated;

-- A creates a household with a picked catalog --------------------------------

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');

select set_config('test.household_a', (public.create_household(
  'Casa',
  '[{"name": "Lácteos", "products": [{"name": "Leche", "unit": "l", "expected": 8}, {"name": "Yogur", "unit": "unit", "expected": 4}]}]'
)).id::text, true);

select is(
  (select role from public.household_members where user_id = auth.uid()),
  'admin',
  'the creator becomes admin'
);
select is((select count(*)::int from public.products), 2, 'the picked catalog is copied into the household');
select is((select count(*)::int from public.sections), 1, 'catalog sections are copied with the products');
select set_config('test.code_a', (select invite_code from public.households), true);
select matches(current_setting('test.code_a'), '^[A-Z2-9]{8}$', 'invite codes are 8 unambiguous characters');

-- B is isolated until joining -------------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-00000000000b');

select is((select count(*)::int from public.households), 0, 'a non-member cannot see the household');
select is((select count(*)::int from public.products), 0, 'a non-member cannot see its products');
select throws_ok(
  format($q$insert into public.products (household_id, name) values (%L, 'Intruso')$q$, current_setting('test.household_a')),
  '42501',
  null,
  'a non-member cannot insert products into the household'
);

select is(
  (public.join_household(lower(current_setting('test.code_a')))).id::text,
  current_setting('test.household_a'),
  'joining with the invite code is case-insensitive'
);
select is((select count(*)::int from public.products), 2, 'a member sees the household products');
select throws_ok(
  format('select public.regenerate_invite_code(%L)', current_setting('test.household_a')),
  '42501',
  null,
  'a plain member cannot regenerate the invite code'
);

-- A regenerates the code; the old one stops working -------------------------

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select isnt(
  public.regenerate_invite_code(current_setting('test.household_a')::uuid),
  current_setting('test.code_a'),
  'the admin gets a new invite code'
);

select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select throws_ok(
  format('select public.join_household(%L)', current_setting('test.code_a')),
  'P0002',
  null,
  'the old invite code no longer works'
);

-- C cannot point its own rows at A's products -------------------------------

select set_config('test.household_c', (public.create_household('Otra casa')).id::text, true);
select set_config('test.list_c', '00000000-0000-0000-0000-0000000000c1', true);
insert into public.shopping_lists (id, household_id, period)
values (current_setting('test.list_c')::uuid, current_setting('test.household_c')::uuid, '2026-11-01');

reset role;
select set_config('test.product_a', (
  select id::text from public.products where household_id = current_setting('test.household_a')::uuid limit 1
), true);
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000c');

select throws_ok(
  format(
    'insert into public.list_items (list_id, household_id, product_id, quantity) values (%L, %L, %L, 1)',
    current_setting('test.list_c'), current_setting('test.household_c'), current_setting('test.product_a')
  ),
  '23503',
  null,
  'a list item cannot reference another household''s product'
);

-- Shopping list rules ---------------------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select set_config('test.list_a', '00000000-0000-0000-0000-0000000000a1', true);
insert into public.shopping_lists (id, household_id, period, status)
values (current_setting('test.list_a')::uuid, current_setting('test.household_a')::uuid, '2026-11-01', 'shopping');
insert into public.list_items (list_id, household_id, product_id, quantity)
values (current_setting('test.list_a')::uuid, current_setting('test.household_a')::uuid, current_setting('test.product_a')::uuid, 2);

select throws_ok(
  format('insert into public.shopping_lists (household_id, period) values (%L, ''2026-12-01'')', current_setting('test.household_a')),
  '23505',
  null,
  'a household can only have one open list'
);
select throws_ok(
  format('select public.close_shopping_list(%L)', current_setting('test.list_a')),
  '22023',
  null,
  'a list with pending items cannot be closed'
);

select throws_ok(
  format('update public.shopping_lists set status = ''closed'', closed_at = now() where id = %L', current_setting('test.list_a')),
  '22023',
  null,
  'closing the list directly is also refused while items are pending'
);

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
update public.list_items set status = 'in_cart', price = 10, checked_by = '00000000-0000-0000-0000-00000000000a'
where list_id = current_setting('test.list_a')::uuid;
select is(
  (select checked_by::text from public.list_items where list_id = current_setting('test.list_a')::uuid),
  '00000000-0000-0000-0000-00000000000b',
  'checked_by is always the user who checked the item'
);

update public.list_items set status = 'skipped', skip_reason = 'too_expensive', price = null, checked_by = null
where list_id = current_setting('test.list_a')::uuid;

select is(
  (public.close_shopping_list(current_setting('test.list_a')::uuid)).status,
  'closed',
  'the list closes once every item is bought or skipped'
);

select throws_ok(
  format('update public.shopping_lists set status = ''shopping'', closed_at = null where id = %L', current_setting('test.list_a')),
  '22023',
  null,
  'a closed list cannot be reopened'
);
select throws_ok(
  format('update public.list_items set quantity = 5 where list_id = %L', current_setting('test.list_a')),
  '22023',
  null,
  'items of a closed list are frozen history'
);
select throws_ok(
  format('delete from public.products where id = %L', current_setting('test.product_a')),
  '23503',
  null,
  'a product used in a past list cannot be deleted (archive it instead)'
);

reset role;
set constraints all deferred;
delete from public.households where id = current_setting('test.household_a')::uuid;
select is(
  (select count(*)::int from public.shopping_lists where household_id = current_setting('test.household_a')::uuid),
  0,
  'deleting a household removes its lists, including closed ones'
);

select * from finish();
rollback;
