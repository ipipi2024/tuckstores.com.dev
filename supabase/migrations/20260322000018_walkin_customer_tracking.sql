-- ============================================================
-- Walk-in customer tracking
-- Date: 2026-03-22
--
-- Previously, business_customers only stored registered platform
-- users (user_id NOT NULL). Walk-in name/phone snapshots were
-- saved on the sales row but never aggregated into the CRM table,
-- so the Customers page and Analytics showed only registered users.
--
-- Changes:
--   1. Make business_customers.user_id nullable
--   2. Replace (business_id, user_id) unique constraint with two
--      partial unique indexes — one for registered, one for walk-ins
--      deduplicated by phone
--   3. Add upsert_walkin_customer (SECURITY DEFINER)
--   4. Replace create_sale to call upsert_walkin_customer when
--      customer_user_id is null but a name or phone was captured
-- ============================================================


-- ============================================================
-- SECTION 1: Make user_id nullable
-- ============================================================

alter table public.business_customers
  alter column user_id drop not null;

-- The FK constraint (references public.users) stays — it still
-- enforces referential integrity for rows where user_id IS NOT NULL.
-- NULL foreign keys are legal in PostgreSQL and mean "no linked user".


-- ============================================================
-- SECTION 2: Replace unique constraint with partial indexes
-- ============================================================

-- Drop the original constraint that required (business_id, user_id) uniqueness.
-- It can no longer serve walk-ins because NULL != NULL in SQL, so multiple
-- walk-in rows would all pass the constraint.
alter table public.business_customers
  drop constraint uq_business_customer;

-- Registered users: one row per (business, user) pair.
create unique index uq_bc_registered
  on public.business_customers(business_id, user_id)
  where user_id is not null;

-- Walk-in customers: deduplicate by phone within a business.
-- A returning walk-in who gives the same phone number will be
-- matched and their stats accumulated rather than creating a duplicate.
-- Walk-ins without a phone cannot be deduplicated and each sale
-- creates a separate row (accepted — they are truly anonymous).
create unique index uq_bc_walkin_phone
  on public.business_customers(business_id, phone_snapshot)
  where user_id is null and phone_snapshot is not null;


-- ============================================================
-- SECTION 3: upsert_walkin_customer (SECURITY DEFINER)
--
-- Records a walk-in customer sale into business_customers.
-- Walk-ins are identified by phone (when available) for dedup;
-- nameless/phoneless calls are silently skipped.
--
-- Parameters:
--   p_business_id              — the business
--   p_name_snapshot            — name entered by cashier (may be null)
--   p_phone_snapshot           — phone entered by cashier (may be null)
--   p_completed_sale_increment — how many sales to add (normally 1)
--   p_total_spent_increment    — sale total to add
--
-- Called from create_sale when p_customer_user_id IS NULL.
-- ============================================================

create or replace function public.upsert_walkin_customer(
  p_business_id              uuid,
  p_name_snapshot            text,
  p_phone_snapshot           text,
  p_completed_sale_increment int     default 0,
  p_total_spent_increment    numeric default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text := nullif(trim(coalesce(p_name_snapshot,  '')), '');
  v_phone text := nullif(trim(coalesce(p_phone_snapshot, '')), '');
begin
  -- Skip truly anonymous sales (no name, no phone)
  if v_name is null and v_phone is null then
    return;
  end if;

  if v_phone is not null then
    -- Deduplicate by phone within this business
    insert into public.business_customers (
      business_id, user_id,
      display_name_snapshot, phone_snapshot,
      first_interaction_at, last_interaction_at,
      completed_sale_count, total_spent
    ) values (
      p_business_id, null,
      v_name, v_phone,
      now(), now(),
      p_completed_sale_increment, p_total_spent_increment
    )
    on conflict (business_id, phone_snapshot)
      where user_id is null and phone_snapshot is not null
    do update set
      display_name_snapshot = coalesce(excluded.display_name_snapshot, business_customers.display_name_snapshot),
      last_interaction_at   = now(),
      completed_sale_count  = business_customers.completed_sale_count + p_completed_sale_increment,
      total_spent           = business_customers.total_spent           + p_total_spent_increment,
      updated_at            = now();
  else
    -- Name only — no dedup possible, insert each time
    insert into public.business_customers (
      business_id, user_id,
      display_name_snapshot,
      first_interaction_at, last_interaction_at,
      completed_sale_count, total_spent
    ) values (
      p_business_id, null,
      v_name,
      now(), now(),
      p_completed_sale_increment, p_total_spent_increment
    );
  end if;
end;
$$;

-- Only callable by service_role / SECURITY DEFINER RPCs (same as upsert_business_customer)
grant execute on function public.upsert_walkin_customer(uuid, text, text, int, numeric)
  to service_role;


-- ============================================================
-- SECTION 4: Replace create_sale
--
-- Identical to the previous version except for one addition at
-- the end: when p_customer_user_id IS NULL but a name or phone
-- was captured, call upsert_walkin_customer so the walk-in
-- appears in the business_customers CRM table.
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

  -- Update business_customers CRM record for walk-in customers
  if p_customer_user_id is null then
    begin
      perform public.upsert_walkin_customer(
        p_business_id,
        p_customer_name_snapshot,
        p_customer_phone_snapshot,
        1,                      -- completed_sale_increment = 1
        v_subtotal - v_discount  -- total_spent_increment = sale total
      );
    exception when others then
      null; -- non-fatal
    end;
  end if;

  return v_sale_id;
end;
$$;
