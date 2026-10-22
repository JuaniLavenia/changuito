-- Saves a stock review and the shopping list built from it in one transaction.
-- Security invoker: RLS still decides whether the caller belongs to the household.
-- p_stock: [{ "productId": uuid, "quantity": number }]
-- p_items: [{ "productId": uuid, "quantity": number, "carriedOver": boolean }]
create function public.create_shopping_list(
  p_household_id uuid,
  p_period date,
  p_stock jsonb,
  p_items jsonb
)
returns public.shopping_lists
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_review_id uuid;
  v_list public.shopping_lists;
begin
  if jsonb_typeof(p_stock) <> 'array' or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Stock and items must be JSON arrays' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'A shopping list needs at least one item' using errcode = '22023';
  end if;

  insert into public.stock_reviews (household_id)
  values (p_household_id)
  returning id into v_review_id;

  insert into public.stock_review_items (review_id, household_id, product_id, quantity)
  select v_review_id, p_household_id, (entry ->> 'productId')::uuid, (entry ->> 'quantity')::numeric
  from jsonb_array_elements(p_stock) as entry;

  insert into public.shopping_lists (household_id, period, stock_review_id)
  values (p_household_id, date_trunc('month', p_period)::date, v_review_id)
  returning * into v_list;

  insert into public.list_items (list_id, household_id, product_id, quantity, carried_over)
  select
    v_list.id,
    p_household_id,
    (entry ->> 'productId')::uuid,
    (entry ->> 'quantity')::numeric,
    coalesce((entry ->> 'carriedOver')::boolean, false)
  from jsonb_array_elements(p_items) as entry;

  return v_list;
end;
$$;

revoke execute on function public.create_shopping_list(uuid, date, jsonb, jsonb) from public, anon;
grant execute on function public.create_shopping_list(uuid, date, jsonb, jsonb) to authenticated;
