-- ─────────────────────────────────────────────
-- suppliers
-- ─────────────────────────────────────────────
create table public.suppliers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  name       text not null,
  phone      text,
  email      text,
  notes      text,
  created_at timestamptz not null default now()
);

alter table public.suppliers enable row level security;

create policy "suppliers: select own"
  on public.suppliers for select
  using (auth.uid() = user_id);

create policy "suppliers: insert own"
  on public.suppliers for insert
  with check (auth.uid() = user_id);

create policy "suppliers: update own"
  on public.suppliers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "suppliers: delete own"
  on public.suppliers for delete
  using (auth.uid() = user_id);


-- ─────────────────────────────────────────────
-- add supplier_id to purchases (keep supplier_name for legacy rows)
-- ─────────────────────────────────────────────
alter table public.purchases
  add column supplier_id uuid references public.suppliers(id) on delete set null;


-- ─────────────────────────────────────────────
-- replace create_purchase RPC to accept supplier_id
-- ─────────────────────────────────────────────
create or replace function public.create_purchase(
  p_supplier_name text,
  p_purchase_date date,
  p_notes         text,
  p_items         jsonb,
  p_supplier_id   uuid default null
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
  insert into public.purchases (user_id, supplier_name, supplier_id, purchase_date, notes)
  values (auth.uid(), p_supplier_name, p_supplier_id, p_purchase_date, p_notes)
  returning id into v_purchase_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.purchase_items (purchase_id, product_id, quantity, unit_cost)
    values (
      v_purchase_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::int,
      (v_item->>'unit_cost')::numeric
    )
    returning id into v_item_id;

    insert into public.inventory_movements
      (product_id, purchase_item_id, quantity, movement_type, user_id)
    values (
      (v_item->>'product_id')::uuid,
      v_item_id,
      (v_item->>'quantity')::int,
      'purchase',
      auth.uid()
    );

    v_total := v_total + ((v_item->>'quantity')::int * (v_item->>'unit_cost')::numeric);
  end loop;

  update public.purchases set total_amount = v_total where id = v_purchase_id;

  return v_purchase_id;
end;
$$;
