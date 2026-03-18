-- ─────────────────────────────────────────────
-- sales
-- ─────────────────────────────────────────────
create table public.sales (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  total_amount numeric(10, 2),
  notes        text,
  created_at   timestamptz not null default now()
);

alter table public.sales enable row level security;

create policy "sales: select own"
  on public.sales for select
  using (auth.uid() = user_id);

create policy "sales: insert own"
  on public.sales for insert
  with check (auth.uid() = user_id);

create policy "sales: update own"
  on public.sales for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "sales: delete own"
  on public.sales for delete
  using (auth.uid() = user_id);


-- ─────────────────────────────────────────────
-- sale_items
-- ─────────────────────────────────────────────
create table public.sale_items (
  id         uuid primary key default gen_random_uuid(),
  sale_id    uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity   int not null check (quantity > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  subtotal   numeric(10, 2) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now()
);

alter table public.sale_items enable row level security;

create policy "sale_items: select own"
  on public.sale_items for select
  using (
    exists (
      select 1 from public.sales s
      where s.id = sale_id and s.user_id = auth.uid()
    )
  );

create policy "sale_items: insert own"
  on public.sale_items for insert
  with check (
    exists (
      select 1 from public.sales s
      where s.id = sale_id and s.user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────
-- create_sale  (atomic RPC)
-- inserts sale + items + negative inventory movements
-- ─────────────────────────────────────────────
create or replace function public.create_sale(
  p_notes text,
  p_items jsonb  -- [{product_id, quantity, unit_price}]
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
  -- insert sale header
  insert into public.sales (user_id, notes)
  values (auth.uid(), p_notes)
  returning id into v_sale_id;

  -- loop through items
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    -- insert sale item
    insert into public.sale_items (sale_id, product_id, quantity, unit_price)
    values (
      v_sale_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::int,
      (v_item->>'unit_price')::numeric
    )
    returning id into v_item_id;

    -- insert inventory movement (stock out — negative quantity)
    insert into public.inventory_movements
      (product_id, quantity, movement_type, user_id, notes)
    values (
      (v_item->>'product_id')::uuid,
      -((v_item->>'quantity')::int),
      'sale',
      auth.uid(),
      'sale ' || v_sale_id
    );

    -- accumulate total
    v_total := v_total + ((v_item->>'quantity')::int * (v_item->>'unit_price')::numeric);
  end loop;

  -- update total_amount
  update public.sales set total_amount = v_total where id = v_sale_id;

  return v_sale_id;
end;
$$;
