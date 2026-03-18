-- ─────────────────────────────────────────────
-- purchases
-- ─────────────────────────────────────────────
create table public.purchases (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  supplier_name text,
  purchase_date date not null default current_date,
  notes         text,
  total_amount  numeric(10, 2),
  created_at    timestamptz not null default now()
);

alter table public.purchases enable row level security;

create policy "purchases: select own"
  on public.purchases for select
  using (auth.uid() = user_id);

create policy "purchases: insert own"
  on public.purchases for insert
  with check (auth.uid() = user_id);

create policy "purchases: update own"
  on public.purchases for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "purchases: delete own"
  on public.purchases for delete
  using (auth.uid() = user_id);


-- ─────────────────────────────────────────────
-- purchase_items
-- ─────────────────────────────────────────────
create table public.purchase_items (
  id          uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id  uuid not null references public.products(id),
  quantity    int not null check (quantity > 0),
  unit_cost   numeric(10, 2) not null check (unit_cost >= 0),
  subtotal    numeric(10, 2) generated always as (quantity * unit_cost) stored,
  created_at  timestamptz not null default now()
);

alter table public.purchase_items enable row level security;

create policy "purchase_items: select own"
  on public.purchase_items for select
  using (
    exists (
      select 1 from public.purchases p
      where p.id = purchase_id and p.user_id = auth.uid()
    )
  );

create policy "purchase_items: insert own"
  on public.purchase_items for insert
  with check (
    exists (
      select 1 from public.purchases p
      where p.id = purchase_id and p.user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────
-- inventory_movements
-- ─────────────────────────────────────────────
create table public.inventory_movements (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references public.products(id),
  purchase_item_id uuid references public.purchase_items(id) on delete set null,
  quantity         int not null,  -- positive = stock in, negative = stock out
  movement_type    text not null check (movement_type in ('purchase', 'sale', 'return', 'adjustment')),
  user_id          uuid not null references public.users(id),
  notes            text,
  created_at       timestamptz not null default now()
);

alter table public.inventory_movements enable row level security;

create policy "inventory_movements: select own"
  on public.inventory_movements for select
  using (auth.uid() = user_id);

create policy "inventory_movements: insert own"
  on public.inventory_movements for insert
  with check (auth.uid() = user_id);


-- ─────────────────────────────────────────────
-- product_stock view  (current stock per product)
-- ─────────────────────────────────────────────
create view public.product_stock as
  select
    product_id,
    sum(quantity) as stock_quantity
  from public.inventory_movements
  group by product_id;


-- ─────────────────────────────────────────────
-- create_purchase  (atomic RPC)
-- inserts purchase + items + movements in one transaction
-- ─────────────────────────────────────────────
create or replace function public.create_purchase(
  p_supplier_name text,
  p_purchase_date date,
  p_notes         text,
  p_items         jsonb  -- [{product_id, quantity, unit_cost}]
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_purchase_id uuid;
  v_total       numeric(10,2) := 0;
  v_item        jsonb;
  v_item_id     uuid;
begin
  -- insert purchase header
  insert into public.purchases (user_id, supplier_name, purchase_date, notes)
  values (auth.uid(), p_supplier_name, p_purchase_date, p_notes)
  returning id into v_purchase_id;

  -- loop through items
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    -- insert purchase item
    insert into public.purchase_items (purchase_id, product_id, quantity, unit_cost)
    values (
      v_purchase_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::int,
      (v_item->>'unit_cost')::numeric
    )
    returning id into v_item_id;

    -- insert inventory movement (stock in)
    insert into public.inventory_movements
      (product_id, purchase_item_id, quantity, movement_type, user_id)
    values (
      (v_item->>'product_id')::uuid,
      v_item_id,
      (v_item->>'quantity')::int,
      'purchase',
      auth.uid()
    );

    -- accumulate total
    v_total := v_total + ((v_item->>'quantity')::int * (v_item->>'unit_cost')::numeric);
  end loop;

  -- update total_amount on purchase
  update public.purchases set total_amount = v_total where id = v_purchase_id;

  return v_purchase_id;
end;
$$;
