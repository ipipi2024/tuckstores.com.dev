-- ============================================================
-- Measurement support: weight and volume products
-- Date: 2026-03-22
--
-- Section 1: Add measurement_type + base_unit to products
--            with cross-column CHECK constraint
-- Section 2: sale_items.quantity integer → numeric(10,3)
--            add unit_snapshot, recreate generated subtotal
-- Section 3: purchase_items.quantity integer → numeric(10,3)
--            recreate generated subtotal
-- Section 4: inventory_movements.quantity integer → numeric(10,3)
-- Section 5: Recreate product_stock view (remove ::integer cast)
-- Section 6: upsert_business_customer_product signature int → numeric
-- Section 7: create_purchase RPC — numeric quantity + unit guard
-- Section 8: create_sale RPC — numeric quantity + unit guard + unit_snapshot
-- ============================================================


-- ============================================================
-- SECTION 1: Add measurement columns to products
-- ============================================================

alter table public.products
  add column measurement_type text not null default 'unit'
    check (measurement_type in ('unit', 'weight', 'volume')),
  add column base_unit text not null default 'unit'
    check (base_unit in ('unit', 'kg', 'L')),
  add constraint products_base_unit_matches_measurement_type check (
    (measurement_type = 'unit'   and base_unit = 'unit') or
    (measurement_type = 'weight' and base_unit = 'kg')   or
    (measurement_type = 'volume' and base_unit = 'L')
  );


-- ============================================================
-- SECTION 2: sale_items — quantity to numeric(10,3) + unit_snapshot
--
-- Order matters:
--   1. Drop generated subtotal (depends on quantity column type)
--   2. Drop check constraint by PostgreSQL auto-name
--   3. Alter quantity type
--   4. Re-add check + new unit_snapshot column
--   5. Recreate generated subtotal
-- ============================================================

alter table public.sale_items drop column subtotal;

alter table public.sale_items
  drop constraint if exists sale_items_quantity_check;

alter table public.sale_items
  alter column quantity type numeric(10,3)
    using quantity::numeric(10,3),
  add constraint sale_items_quantity_check check (quantity > 0),
  add column unit_snapshot text not null default 'unit';

alter table public.sale_items
  add column subtotal numeric(10,2)
    generated always as ((quantity * unit_price) - discount_amount) stored;


-- ============================================================
-- SECTION 3: purchase_items — quantity to numeric(10,3)
--
-- Same generated-column drop/recreate pattern as sale_items.
-- ============================================================

alter table public.purchase_items drop column subtotal;

alter table public.purchase_items
  drop constraint if exists purchase_items_quantity_check;

alter table public.purchase_items
  alter column quantity type numeric(10,3)
    using quantity::numeric(10,3),
  add constraint purchase_items_quantity_check check (quantity > 0);

alter table public.purchase_items
  add column subtotal numeric(10,2)
    generated always as (quantity * unit_cost) stored;


-- ============================================================
-- SECTION 4 + 5: inventory_movements.quantity → numeric(10,3)
--                and recreate product_stock view
--
-- product_stock is a view over inventory_movements.quantity.
-- PostgreSQL will refuse ALTER COLUMN TYPE while a dependent
-- view exists, so we must:
--   1. Drop the view first
--   2. Alter the column type
--   3. Recreate the view (without the old ::integer cast)
--   4. Re-apply the grant
-- ============================================================

-- Step 1: drop the dependent view
drop view if exists public.product_stock;

-- Step 2: alter the column (no dependent objects remain)
alter table public.inventory_movements
  alter column quantity type numeric(10,3)
    using quantity::numeric(10,3);

-- Step 3: recreate the view without the ::integer cast so
-- decimal stock quantities are preserved
create view public.product_stock as
select
  im.business_id,
  im.location_id,
  im.product_id,
  sum(im.quantity) as stock_quantity
from public.inventory_movements im
group by
  im.business_id,
  im.location_id,
  im.product_id;

-- Step 4: restore the grant
grant select on public.product_stock to authenticated;


-- ============================================================
-- SECTION 6: upsert_business_customer_product
--
-- Change p_quantity from int to numeric so create_sale can pass
-- numeric(10,3) values without a type mismatch at call site.
-- The parameter is not used in the function body (only p_line_total
-- is used), so the behavioural change is zero.
-- PostgreSQL will implicitly cast integer to numeric, so existing
-- callers (e.g. updateOrderStatus via service_role) continue to work.
-- ============================================================

drop function if exists public.upsert_business_customer_product(uuid, uuid, uuid, int, numeric);

create or replace function public.upsert_business_customer_product(
  p_business_id uuid,
  p_user_id     uuid,
  p_product_id  uuid,
  p_quantity    numeric,
  p_line_total  numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_product_id is null then
    return;
  end if;

  insert into public.business_customer_products (
    business_id, user_id, product_id,
    purchase_count, total_spent, last_purchased_at
  ) values (
    p_business_id, p_user_id, p_product_id,
    1, p_line_total, now()
  )
  on conflict (business_id, user_id, product_id) do update set
    purchase_count    = business_customer_products.purchase_count + 1,
    total_spent       = business_customer_products.total_spent    + p_line_total,
    last_purchased_at = now(),
    updated_at        = now();
end;
$$;

grant execute on function public.upsert_business_customer_product(uuid, uuid, uuid, numeric, numeric)
  to service_role;


-- ============================================================
-- SECTION 7: create_purchase RPC
--
-- Base: original in 20260318000000_v2_schema.sql (never replaced).
-- Changes from original:
--   - v_quantity: integer → numeric(10,3)
--   - Added v_mtype text for fractional guard
--   - Cast: ::integer → round(::numeric, 3)
--   - Unit products must receive whole-number quantities
-- All other logic preserved exactly.
-- ============================================================

create or replace function public.create_purchase(
  p_business_id   uuid,
  p_location_id   uuid,
  p_supplier_id   uuid,
  p_purchase_date date,
  p_notes         text,
  p_items         jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id     uuid := auth.uid();
  v_purchase_id   uuid;
  v_subtotal      numeric(10,2) := 0;
  v_item          jsonb;
  v_product_id    uuid;
  v_product_name  text;
  v_quantity      numeric(10,3);
  v_unit_cost     numeric(10,2);
  v_mtype         text;
begin
  if v_caller_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.has_business_role(
    p_business_id,
    array['owner','admin','manager','inventory_clerk']::membership_role[]
  ) then
    raise exception 'Insufficient permissions to create purchase';
  end if;

  if not public.business_subscription_active(p_business_id) then
    raise exception 'Business subscription is not active';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Purchase must contain at least one item';
  end if;

  -- Pre-validation: validate all items before any writes
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity   := round((v_item->>'quantity')::numeric, 3);
    v_unit_cost  := (v_item->>'unit_cost')::numeric(10,2);

    if v_quantity <= 0 then
      raise exception 'Quantity must be positive for product %', v_product_id;
    end if;

    if v_unit_cost < 0 then
      raise exception 'Unit cost cannot be negative for product %', v_product_id;
    end if;

    if not exists (
      select 1 from public.products p
      where  p.id          = v_product_id
        and  p.business_id = p_business_id
    ) then
      raise exception 'Product % does not belong to business %',
        v_product_id, p_business_id;
    end if;

    -- Unit products must be received in whole-number quantities
    select measurement_type into v_mtype
    from   public.products
    where  id = v_product_id and business_id = p_business_id;

    if v_mtype = 'unit' and v_quantity <> floor(v_quantity) then
      raise exception
        'Product % is sold by unit and requires a whole number quantity (got %)',
        v_product_id, v_quantity;
    end if;
  end loop;

  -- All validations passed — begin writes

  insert into public.purchases (
    business_id, location_id, supplier_id, status,
    purchase_date, subtotal_amount, tax_amount, total_amount,
    notes, recorded_by_user_id
  ) values (
    p_business_id, p_location_id, p_supplier_id, 'received',
    p_purchase_date, 0, 0, 0,
    p_notes, v_caller_id
  )
  returning id into v_purchase_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id   := (v_item->>'product_id')::uuid;
    v_product_name := v_item->>'product_name';
    v_quantity     := round((v_item->>'quantity')::numeric, 3);
    v_unit_cost    := (v_item->>'unit_cost')::numeric(10,2);

    insert into public.purchase_items (
      purchase_id, product_id, product_name_snapshot, quantity, unit_cost
    ) values (
      v_purchase_id, v_product_id, v_product_name, v_quantity, v_unit_cost
    );

    insert into public.inventory_movements (
      business_id, location_id, product_id, quantity,
      movement_type, reference_type, reference_id,
      performed_by_user_id
    ) values (
      p_business_id, p_location_id, v_product_id, v_quantity,
      'purchase', 'purchase', v_purchase_id,
      v_caller_id
    );

    v_subtotal := v_subtotal + (v_quantity * v_unit_cost);
  end loop;

  update public.purchases
  set    subtotal_amount = v_subtotal,
         total_amount    = v_subtotal
  where  id = v_purchase_id;

  return v_purchase_id;
end;
$$;


-- ============================================================
-- SECTION 8: create_sale RPC
--
-- Base: 20260321000013_cash_tendered.sql (latest active version).
-- Changes from base:
--   - v_quantity: integer → numeric(10,3)
--   - v_available_qty: integer → numeric(10,3)
--   - Added v_mtype text, v_base_unit text
--   - Quantity cast: ::integer → round(::numeric, 3)
--   - Stock sum cast: ::integer → ::numeric(10,3)
--   - Pre-flight: unit products reject fractional quantities
--   - Write loop: looks up base_unit and persists as unit_snapshot
--     in sale_items insert
-- All other logic (cash tendering pre-flight, CRM update) preserved
-- exactly from base version.
-- ============================================================

create or replace function public.create_sale(
  p_business_id             uuid,
  p_location_id             uuid,
  p_customer_user_id        uuid,
  p_customer_name_snapshot  text,
  p_customer_phone_snapshot text,
  p_sale_channel            sale_channel,
  p_notes                   text,
  p_items                   jsonb,
  p_payments                jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id     uuid := auth.uid();
  v_sale_id       uuid;
  v_subtotal      numeric(10,2) := 0;
  v_discount      numeric(10,2) := 0;
  v_item          jsonb;
  v_payment       jsonb;
  v_product_id    uuid;
  v_product_name  text;
  v_quantity      numeric(10,3);
  v_unit_price    numeric(10,2);
  v_item_discount numeric(10,2);
  v_line_total    numeric(10,2);
  v_available_qty numeric(10,3);
  v_pay_method    text;
  v_pay_amount    numeric(10,2);
  v_tendered      numeric(10,2);
  v_mtype         text;
  v_base_unit     text;
begin
  if v_caller_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.has_business_role(
    p_business_id,
    array['owner','admin','manager','cashier']::membership_role[]
  ) then
    raise exception 'Insufficient permissions to create sale';
  end if;

  if not public.business_subscription_active(p_business_id) then
    raise exception 'Business subscription is not active';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Sale must contain at least one item';
  end if;

  if p_payments is null or jsonb_array_length(p_payments) = 0 then
    raise exception 'Sale must contain at least one payment';
  end if;

  -- Pre-flight: validate all products and stock BEFORE any writes
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity   := round((v_item->>'quantity')::numeric, 3);

    if v_quantity <= 0 then
      raise exception 'Quantity must be positive for product %', v_product_id;
    end if;

    if not exists (
      select 1 from public.products p
      where  p.id          = v_product_id
        and  p.business_id = p_business_id
        and  p.is_active   = true
    ) then
      raise exception 'Product % not found or inactive in business %',
        v_product_id, p_business_id;
    end if;

    -- Unit products require whole-number quantities
    select measurement_type into v_mtype
    from   public.products
    where  id = v_product_id and business_id = p_business_id;

    if v_mtype = 'unit' and v_quantity <> floor(v_quantity) then
      raise exception
        'Product % is sold by unit and requires a whole number quantity (got %)',
        v_product_id, v_quantity;
    end if;

    select coalesce(sum(im.quantity), 0)::numeric(10,3)
    into   v_available_qty
    from   public.inventory_movements im
    where  im.business_id = p_business_id
      and  im.product_id  = v_product_id
      and  (
        p_location_id is null
        or im.location_id = p_location_id
        or im.location_id is null
      );

    if v_available_qty < v_quantity then
      raise exception
        'Insufficient stock for product %: available %, requested %',
        v_product_id, v_available_qty, v_quantity;
    end if;
  end loop;

  -- Pre-flight: validate cash tendering
  for v_payment in select * from jsonb_array_elements(p_payments) loop
    v_pay_method := v_payment->>'payment_method';
    v_pay_amount := (v_payment->>'amount')::numeric(10,2);

    if v_pay_method = 'cash' then
      if (v_payment->>'tendered_amount') is null then
        raise exception 'Cash payment requires tendered_amount';
      end if;

      v_tendered := (v_payment->>'tendered_amount')::numeric(10,2);

      if v_tendered < v_pay_amount then
        raise exception 'Cash tendered (%) is less than payment amount (%)',
          v_tendered, v_pay_amount;
      end if;
    end if;
  end loop;

  -- All validations passed — begin writes

  insert into public.sales (
    business_id, location_id,
    customer_user_id, customer_name_snapshot, customer_phone_snapshot,
    sale_channel, status,
    subtotal_amount, discount_amount, tax_amount, total_amount,
    notes, recorded_by_user_id
  ) values (
    p_business_id, p_location_id,
    p_customer_user_id, p_customer_name_snapshot, p_customer_phone_snapshot,
    p_sale_channel, 'completed',
    0, 0, 0, 0,
    p_notes, v_caller_id
  )
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id    := (v_item->>'product_id')::uuid;
    v_product_name  := v_item->>'product_name';
    v_quantity      := round((v_item->>'quantity')::numeric, 3);
    v_unit_price    := (v_item->>'unit_price')::numeric(10,2);
    v_item_discount := coalesce((v_item->>'discount_amount')::numeric(10,2), 0);
    v_line_total    := (v_quantity * v_unit_price) - v_item_discount;

    -- Look up base_unit for historical snapshot
    select base_unit into v_base_unit
    from   public.products
    where  id = v_product_id and business_id = p_business_id;

    insert into public.sale_items (
      sale_id, product_id, product_name_snapshot,
      quantity, unit_price, discount_amount, unit_snapshot
    ) values (
      v_sale_id, v_product_id, v_product_name,
      v_quantity, v_unit_price, v_item_discount,
      coalesce(v_base_unit, 'unit')
    );

    insert into public.inventory_movements (
      business_id, location_id, product_id, quantity,
      movement_type, reference_type, reference_id,
      performed_by_user_id
    ) values (
      p_business_id, p_location_id, v_product_id, -v_quantity,
      'sale', 'sale', v_sale_id,
      v_caller_id
    );

    v_subtotal := v_subtotal + (v_quantity * v_unit_price);
    v_discount := v_discount + v_item_discount;
  end loop;

  for v_payment in select * from jsonb_array_elements(p_payments) loop
    insert into public.sale_payments (
      sale_id, payment_method, amount, reference
    ) values (
      v_sale_id,
      v_payment->>'payment_method',
      (v_payment->>'amount')::numeric(10,2),
      v_payment->>'reference'
    );
  end loop;

  update public.sales
  set    subtotal_amount = v_subtotal,
         discount_amount = v_discount,
         total_amount    = v_subtotal - v_discount
  where  id = v_sale_id;

  if p_customer_user_id is not null then
    begin
      perform public.upsert_business_customer(
        p_business_id,
        p_customer_user_id,
        0, 0, 1,
        v_subtotal - v_discount
      );
    exception when others then
      null;
    end;
  end if;

  return v_sale_id;
end;
$$;
