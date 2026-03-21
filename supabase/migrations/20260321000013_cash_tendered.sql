-- ============================================================
-- Cash tendered + change tracking for POS payments
-- Date: 2026-03-21
--
-- Changes:
--   1. Add tendered_amount and change_given to sale_payments
--      (nullable; only set for cash payments)
--   2. Replace create_sale to:
--        a. Validate tendered_amount >= amount for cash payments
--        b. Persist tendered_amount and change_given on cash payments
--
-- p_payments jsonb schema (extended):
--   [{ "payment_method": text, "amount": numeric, "reference": text|null,
--      "tendered_amount": numeric|null }]
-- Non-cash entries may omit tendered_amount — both columns stay null.
-- ============================================================


-- ============================================================
-- SECTION 1: Add columns to sale_payments
-- ============================================================

alter table public.sale_payments
  add column tendered_amount numeric(10,2),  -- null for non-cash
  add column change_given    numeric(10,2);  -- null for non-cash


-- ============================================================
-- SECTION 2: Replace create_sale
--
-- All existing behaviour preserved. Two additions for cash payments:
--   - Pre-flight: raise if tendered_amount is missing or < amount
--   - Persist: insert tendered_amount and change_given (computed server-side)
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
  v_quantity      integer;
  v_unit_price    numeric(10,2);
  v_item_discount numeric(10,2);
  v_line_total    numeric(10,2);
  v_available_qty integer;
  v_pay_method    text;
  v_pay_amount    numeric(10,2);
  v_tendered      numeric(10,2);
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
    v_quantity   := (v_item->>'quantity')::integer;

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

    select coalesce(sum(im.quantity), 0)::integer
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
    v_quantity      := (v_item->>'quantity')::integer;
    v_unit_price    := (v_item->>'unit_price')::numeric(10,2);
    v_item_discount := coalesce((v_item->>'discount_amount')::numeric(10,2), 0);
    v_line_total    := (v_quantity * v_unit_price) - v_item_discount;

    insert into public.sale_items (
      sale_id, product_id, product_name_snapshot,
      quantity, unit_price, discount_amount
    ) values (
      v_sale_id, v_product_id, v_product_name,
      v_quantity, v_unit_price, v_item_discount
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

    -- Per-product customer analytics for registered users
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

  -- Update business_customers CRM record for registered users
  if p_customer_user_id is not null then
    begin
      perform public.upsert_business_customer(
        p_business_id,
        p_customer_user_id,
        0, 0, 1,               -- completed_sale_increment = 1
        v_subtotal - v_discount -- total_spent_increment = sale total
      );
    exception when others then
      null; -- non-fatal
    end;
  end if;

  return v_sale_id;
end;
$$;
