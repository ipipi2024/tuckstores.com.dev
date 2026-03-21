-- ============================================================
-- Add unit_snapshot to purchase_items + update create_purchase RPC
--
-- purchase_items was missing unit_snapshot (only sale_items got it
-- in 20260322000015_measurement_support.sql). The purchase detail
-- page queries for unit_snapshot, causing a PostgREST error that
-- made every purchase detail page redirect to "Purchase not found".
-- ============================================================


-- Step 1: add unit_snapshot column (existing rows default to 'unit')
alter table public.purchase_items
  add column unit_snapshot text not null default 'unit';


-- Step 2: recreate create_purchase RPC to persist unit_snapshot
--   Based on the version in 20260322000015_measurement_support.sql.
--   Only change: added v_unit_snapshot variable + fetches base_unit
--   from products and stores it in the purchase_items insert.
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
  v_caller_id       uuid := auth.uid();
  v_purchase_id     uuid;
  v_subtotal        numeric(10,2) := 0;
  v_item            jsonb;
  v_product_id      uuid;
  v_product_name    text;
  v_quantity        numeric(10,3);
  v_unit_cost       numeric(10,2);
  v_mtype           text;
  v_unit_snapshot   text;
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

    -- Look up the product's base_unit to store as unit_snapshot
    select coalesce(base_unit, 'unit') into v_unit_snapshot
    from   public.products
    where  id = v_product_id and business_id = p_business_id;

    insert into public.purchase_items (
      purchase_id, product_id, product_name_snapshot,
      quantity, unit_cost, unit_snapshot
    ) values (
      v_purchase_id, v_product_id, v_product_name,
      v_quantity, v_unit_cost, v_unit_snapshot
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
