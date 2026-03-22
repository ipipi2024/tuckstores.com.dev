-- ============================================================
-- Fix create_sale: restore measurement support lost in migration 18
-- Date: 2026-03-22
--
-- Migration 20260322000018_walkin_customer_tracking.sql replaced
-- create_sale using migration 13 as its base, which caused it to
-- lose the measurement-support improvements from migration 15:
--
--   REGRESSION 1: v_quantity reverted to integer
--                 → 0.500 kg gets cast to integer 1
--
--   REGRESSION 2: unit_snapshot omitted from sale_items INSERT
--                 → column defaults to 'unit' for all items
--
--   REGRESSION 3: v_available_qty reverted to integer
--                 → stock comparison uses rounded value
--
-- This migration recreates create_sale with ALL features combined:
--   ✓ numeric(10,3) quantities              (migration 15)
--   ✓ unit products reject fractional qty  (migration 15)
--   ✓ unit_snapshot stored on sale_items   (migration 15)
--   ✓ numeric stock comparison             (migration 15)
--   ✓ cash tendered_amount + change_given  (migration 13)
--   ✓ walk-in CRM upsert_walkin_customer   (migration 18)
--   ✓ per-product customer analytics       (all versions)
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

    -- Look up base_unit to persist as unit_snapshot on the sale item
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

    -- Per-product customer analytics (registered users only)
    if p_customer_user_id is not null then
      begin
        perform public.upsert_business_customer_product(
          p_business_id,
          p_customer_user_id,
          v_product_id,
          v_quantity,
          v_line_total
        );
      exception when others then
        null; -- non-fatal
      end;
    end if;
  end loop;

  -- Insert payments; cash payments persist tendered_amount and change_given
  for v_payment in select * from jsonb_array_elements(p_payments) loop
    v_pay_method := v_payment->>'payment_method';
    v_pay_amount := (v_payment->>'amount')::numeric(10,2);

    if v_pay_method = 'cash' then
      v_tendered := (v_payment->>'tendered_amount')::numeric(10,2);
      insert into public.sale_payments (
        sale_id, payment_method, amount, reference, tendered_amount, change_given
      ) values (
        v_sale_id,
        v_pay_method,
        v_pay_amount,
        v_payment->>'reference',
        v_tendered,
        v_tendered - v_pay_amount
      );
    else
      insert into public.sale_payments (
        sale_id, payment_method, amount, reference
      ) values (
        v_sale_id,
        v_pay_method,
        v_pay_amount,
        v_payment->>'reference'
      );
    end if;
  end loop;

  update public.sales
  set    subtotal_amount = v_subtotal,
         discount_amount = v_discount,
         total_amount    = v_subtotal - v_discount
  where  id = v_sale_id;

  -- CRM update: registered user
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

  -- CRM update: walk-in customer
  if p_customer_user_id is null then
    begin
      perform public.upsert_walkin_customer(
        p_business_id,
        p_customer_name_snapshot,
        p_customer_phone_snapshot,
        1,
        v_subtotal - v_discount
      );
    exception when others then
      null;
    end;
  end if;

  return v_sale_id;
end;
$$;
