-- ─────────────────────────────────────────────
-- customers
-- ─────────────────────────────────────────────
create table public.customers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  name       text not null,
  phone      text,
  email      text,
  notes      text,
  created_at timestamptz not null default now()
);

alter table public.customers enable row level security;

create policy "customers: select own"
  on public.customers for select
  using (auth.uid() = user_id);

create policy "customers: insert own"
  on public.customers for insert
  with check (auth.uid() = user_id);

create policy "customers: update own"
  on public.customers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "customers: delete own"
  on public.customers for delete
  using (auth.uid() = user_id);


-- ─────────────────────────────────────────────
-- add optional customer_id to sales
-- ─────────────────────────────────────────────
alter table public.sales
  add column customer_id uuid references public.customers(id) on delete set null;


-- ─────────────────────────────────────────────
-- replace create_sale RPC to accept customer_id
-- ─────────────────────────────────────────────
create or replace function public.create_sale(
  p_notes       text,
  p_items       jsonb,  -- [{product_id, quantity, unit_price}]
  p_customer_id uuid default null
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_sale_id uuid;
  v_total   numeric(10,2) := 0;
  v_item    jsonb;
  v_item_id uuid;
begin
  insert into public.sales (user_id, notes, customer_id)
  values (auth.uid(), p_notes, p_customer_id)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.sale_items (sale_id, product_id, quantity, unit_price)
    values (
      v_sale_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::int,
      (v_item->>'unit_price')::numeric
    )
    returning id into v_item_id;

    insert into public.inventory_movements
      (product_id, quantity, movement_type, user_id, notes)
    values (
      (v_item->>'product_id')::uuid,
      -((v_item->>'quantity')::int),
      'sale',
      auth.uid(),
      'sale ' || v_sale_id
    );

    v_total := v_total + ((v_item->>'quantity')::int * (v_item->>'unit_price')::numeric);
  end loop;

  update public.sales set total_amount = v_total where id = v_sale_id;

  return v_sale_id;
end;
$$;
