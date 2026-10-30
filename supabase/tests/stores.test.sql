-- Stores: default stores, the store of each product, list item snapshots and partial closes per store.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- Product references are deferred to commit; tests roll back, so check them per statement.
set constraints all immediate;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'juani@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'other@example.com');

create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.login(uuid) to authenticated;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select set_config('test.household', (public.create_household(
  'Casa',
  '[{"name": "Lácteos", "products": [{"name": "Leche", "unit": "l", "expected": 8}]},
    {"name": "Mascotas", "store": "Veterinaria", "products": [{"name": "Piedritas", "unit": "kg", "expected": 4}]}]'
)).id::text, true);
select set_config('test.super', (select id::text from public.stores where name = 'Súper'), true);
select set_config('test.vet', (select id::text from public.stores where name = 'Veterinaria'), true);
select set_config('test.chem', (select id::text from public.stores where name = 'Química'), true);
select set_config('test.milk', (select id::text from public.products where name = 'Leche'), true);
select set_config('test.litter', (select id::text from public.products where name = 'Piedritas'), true);

-- Stores and products ----------------------------------------------------------

select results_eq(
  format('select name from public.stores where household_id = %L order by sort_order', current_setting('test.household')),
  $$values ('Súper'::text), ('Veterinaria'), ('Química')$$,
  'a new household starts with Súper, Veterinaria and Química'
);

select results_eq(
  $$select p.name, s.name from public.products p join public.stores s on s.id = p.store_id order by p.name$$,
  $$values ('Leche'::text, 'Súper'::text), ('Piedritas', 'Veterinaria')$$,
  'catalog products start in the store of their section, Súper by default'
);

insert into public.products (household_id, name) values (current_setting('test.household')::uuid, 'Jabón para la ropa');
select set_config('test.soap', (select id::text from public.products where name = 'Jabón para la ropa'), true);
select is(
  (select store_id::text from public.products where id = current_setting('test.soap')::uuid),
  current_setting('test.super'),
  'a product added without a store goes to the first store'
);

select throws_ok(
  format('insert into public.stores (household_id, name) values (%L, %L)', current_setting('test.household'), ' Súper '),
  '23505',
  null,
  'two active stores cannot share a name'
);

select throws_ok(
  format('update public.stores set archived_at = now() where id = %L', current_setting('test.vet')),
  '23503',
  null,
  'a store with products cannot be archived'
);

select lives_ok(
  format('update public.stores set archived_at = now() where id = %L', current_setting('test.chem')),
  'a store without products can be archived'
);

select throws_ok(
  format('update public.products set store_id = %L where id = %L', current_setting('test.chem'), current_setting('test.soap')),
  '23514',
  null,
  'a product cannot move to an archived store'
);

-- List items keep their store ----------------------------------------------------

select set_config('test.list', (public.create_shopping_list(
  current_setting('test.household')::uuid,
  '2026-11-15',
  '[]',
  jsonb_build_array(
    jsonb_build_object('productId', current_setting('test.milk'), 'quantity', 2),
    jsonb_build_object('productId', current_setting('test.litter'), 'quantity', 4),
    jsonb_build_object('productId', current_setting('test.soap'), 'quantity', 1)
  )
)).id::text, true);

update public.products set store_id = current_setting('test.vet')::uuid where id = current_setting('test.soap')::uuid;

select results_eq(
  format(
    'select p.name, s.name from public.list_items li
       join public.products p on p.id = li.product_id
       join public.stores s on s.id = li.store_id
     where li.list_id = %L order by p.name',
    current_setting('test.list')
  ),
  $$values ('Jabón para la ropa'::text, 'Súper'::text), ('Leche', 'Súper'), ('Piedritas', 'Veterinaria')$$,
  'list items keep the store their product had when they were added'
);

select throws_ok(
  format('update public.list_items set store_id = %L where list_id = %L', current_setting('test.vet'), current_setting('test.list')),
  '22023',
  null,
  'a list item cannot change store'
);

-- Partial closes ---------------------------------------------------------------------

select throws_ok(
  format('select public.close_list_store(%L, %L)', current_setting('test.list'), current_setting('test.super')),
  '22023',
  null,
  'a store with pending items cannot be closed'
);

update public.list_items set status = 'in_cart', price = 1000
where list_id = current_setting('test.list')::uuid and product_id = current_setting('test.milk')::uuid;
update public.list_items set status = 'skipped', skip_reason = 'too_expensive'
where list_id = current_setting('test.list')::uuid and product_id = current_setting('test.soap')::uuid;

select isnt(
  (public.close_list_store(current_setting('test.list')::uuid, current_setting('test.super')::uuid)).status,
  'closed',
  'closing one store keeps the list open while another store has items'
);

select throws_ok(
  format(
    'update public.list_items set status = ''pending'', price = null, checked_by = null where list_id = %L and product_id = %L',
    current_setting('test.list'),
    current_setting('test.milk')
  ),
  '22023',
  null,
  'items of a closed store can no longer change'
);

select throws_ok(
  format('select public.close_list_store(%L, %L)', current_setting('test.list'), current_setting('test.super')),
  '22023',
  null,
  'a store cannot be closed twice'
);

select pg_temp.login('00000000-0000-0000-0000-00000000000c');

select is((select count(*)::int from public.stores), 0, 'other households cannot see the stores');

select throws_ok(
  format('select public.close_list_store(%L, %L)', current_setting('test.list'), current_setting('test.vet')),
  'P0002',
  null,
  'a non-member cannot close a store'
);

select pg_temp.login('00000000-0000-0000-0000-00000000000a');

update public.list_items set status = 'in_cart'
where list_id = current_setting('test.list')::uuid and product_id = current_setting('test.litter')::uuid;

select is(
  (public.close_list_store(current_setting('test.list')::uuid, current_setting('test.vet')::uuid)).status,
  'closed',
  'closing the last store with items closes the list'
);

-- A household keeps at least one store -------------------------------------------------

select set_config('test.flat', (public.create_household('Depto')).id::text, true);

select lives_ok(
  format(
    'update public.stores set archived_at = now() where household_id = %L and name in (''Veterinaria'', ''Química'')',
    current_setting('test.flat')
  ),
  'stores can be archived while another one stays active'
);

select throws_ok(
  format('update public.stores set archived_at = now() where household_id = %L and name = ''Súper''', current_setting('test.flat')),
  '23514',
  null,
  'the last active store cannot be archived'
);

-- Deleting a household takes its closed stores with it -----------------------------------

reset role;
set constraints all deferred;

select lives_ok(
  format('delete from public.households where id = %L', current_setting('test.household')),
  'a household whose list has closed stores can be deleted'
);

select * from finish();
rollback;
