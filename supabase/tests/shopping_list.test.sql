-- create_shopping_list saves the review and the list atomically.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

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
  '[{"name": "Lácteos", "products": [{"name": "Leche", "unit": "l", "expected": 8}, {"name": "Yogur", "unit": "unit", "expected": 4}]}]'
)).id::text, true);
select set_config('test.milk', (select id::text from public.products where name = 'Leche'), true);
select set_config('test.yogurt', (select id::text from public.products where name = 'Yogur'), true);

select set_config('test.list', (public.create_shopping_list(
  current_setting('test.household')::uuid,
  '2026-11-15',
  jsonb_build_array(
    jsonb_build_object('productId', current_setting('test.milk'), 'quantity', 3),
    jsonb_build_object('productId', current_setting('test.yogurt'), 'quantity', 4)
  ),
  jsonb_build_array(jsonb_build_object('productId', current_setting('test.milk'), 'quantity', 5, 'carriedOver', true))
)).id::text, true);

select is(
  (select period::text from public.shopping_lists where id = current_setting('test.list')::uuid),
  '2026-11-01',
  'the list period is normalized to the first day of the month'
);
select is(
  (select count(*)::int from public.stock_review_items),
  2,
  'the stock review keeps every reviewed product'
);
select results_eq(
  format('select quantity, carried_over, status from public.list_items where list_id = %L', current_setting('test.list')),
  $$values (5.000::numeric(10, 3), true, 'pending'::text)$$,
  'list items are saved as pending with their carry-over flag'
);

select throws_ok(
  format(
    'select public.create_shopping_list(%L, ''2026-11-20'', ''[]'', %L)',
    current_setting('test.household'),
    jsonb_build_array(jsonb_build_object('productId', current_setting('test.milk'), 'quantity', 1))
  ),
  '23505',
  null,
  'a second open list is refused'
);
select is((select count(*)::int from public.stock_reviews), 1, 'a refused list leaves no orphan stock review');

select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select throws_ok(
  format(
    'select public.create_shopping_list(%L, ''2026-11-20'', ''[]'', %L)',
    current_setting('test.household'),
    jsonb_build_array(jsonb_build_object('productId', current_setting('test.milk'), 'quantity', 1))
  ),
  '42501',
  null,
  'a non-member cannot create a list for the household'
);

select * from finish();
rollback;
