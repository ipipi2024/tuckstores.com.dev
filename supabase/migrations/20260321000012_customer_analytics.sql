-- ============================================================
-- Customer Analytics
-- Date: 2026-03-21
--
-- Changes:
--   1. Add total_spent to business_customers
--   2. Create business_customer_products (per-customer product stats)
--   3. Create upsert_business_customer_product (SECURITY DEFINER)
--   4. Create search_business_customer (SECURITY DEFINER, exact phone/email)
--   5. Replace upsert_business_customer to accept p_total_spent_increment
--   6. Replace create_sale to call product analytics + pass total_spent
-- ============================================================


-- ============================================================
-- SECTION 1: Add total_spent to business_customers
-- ============================================================

alter table public.business_customers
  add column total_spent numeric(12,2) not null default 0;


-- ============================================================
-- SECTION 2: business_customer_products
--
-- Tracks per-customer product purchase history for registered users.
-- Only populated when customer_user_id is set on a sale.
-- Walk-in snapshot-only sales (no user_id) are intentionally excluded —
-- they don't have a stable identity to aggregate against.
-- ============================================================

create table public.business_customer_products (
  id                uuid          primary key default gen_random_uuid(),
  business_id       uuid          not null references public.businesses(id) on delete cascade,
  user_id           uuid          not null references public.users(id)      on delete cascade,
  product_id        uuid          not null references public.products(id)   on delete cascade,

  -- purchase_count: number of sale events where this product appeared
  -- total_spent: sum of line totals (quantity * unit_price - discount) for this product
  purchase_count    integer       not null default 0,
  total_spent       numeric(10,2) not null default 0,
  last_purchased_at timestamptz   not null default now(),

  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now(),

  constraint uq_business_customer_product unique (business_id, user_id, product_id)
);

create index idx_bcp_business_user    on public.business_customer_products(business_id, user_id);
create index idx_bcp_business_product on public.business_customer_products(business_id, product_id);

create trigger business_customer_products_updated_at
  before update on public.business_customer_products
  for each row execute function public.set_updated_at();

-- RLS: business members can read their own business's data.
-- No client-side writes — all writes go through the SECURITY DEFINER RPC below.
alter table public.business_customer_products enable row level security;

create policy "bcp: members select"
  on public.business_customer_products
  for select
  using (public.is_business_member(business_id));

grant select on public.business_customer_products to authenticated;
grant all    on public.business_customer_products to service_role;


-- ============================================================
-- SECTION 3: upsert_business_customer_product (SECURITY DEFINER)
--
-- Increments purchase_count and total_spent for a (business, user, product)
-- triple. Non-fatal: callers should wrap in BEGIN/EXCEPTION.
--
-- Parameters:
--   p_business_id — the business
--   p_user_id     — the platform user (customer); returns immediately if null
--   p_product_id  — the product
--   p_quantity    — units sold in this sale event (always 1 for purchase_count increment)
--   p_line_total  — line total for this product (quantity * unit_price - discount)
--
-- Called from:
--   - create_sale RPC (per item, when p_customer_user_id is not null)
--   - updateOrderStatus server action via admin client (per item, on completion)
-- ============================================================

create or replace function public.upsert_business_customer_product(
  p_business_id uuid,
  p_user_id     uuid,
  p_product_id  uuid,
  p_quantity    int,
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

-- Only callable by service_role (admin client server actions) and from within
-- SECURITY DEFINER RPCs. authenticated clients cannot call this directly.
grant execute on function public.upsert_business_customer_product(uuid, uuid, uuid, int, numeric)
  to service_role;


-- ============================================================
-- SECTION 4: search_business_customer (SECURITY DEFINER)
--
-- Privacy-safe search that lets business members find registered platform
-- users by EXACT phone or email to link them to a POS sale.
--
-- Security model:
--   - Caller must be authenticated and an active member of p_business_id.
--   - Exact match only — not a fuzzy/substring search.
--   - Returns minimal identity: user_id, display_name, email, phone.
--   - is_known_customer = true when the user already has a business_customers row.
--   - Callable by any authenticated user (membership check is enforced inside).
--
-- Why exact match is acceptable:
--   If you know a customer's phone number or email, finding their name on a
--   platform they've registered on is not a meaningful privacy escalation.
--   The business is recording a sale to a person standing in front of them.
-- ============================================================

create or replace function public.search_business_customer(
  p_business_id uuid,
  p_phone       text default null,
  p_email       text default null
)
returns table (
  user_id           uuid,
  display_name      text,
  email             text,
  phone             text,
  is_known_customer boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_business_member(p_business_id) then
    raise exception 'Not a member of this business';
  end if;

  if (p_phone is null or trim(p_phone) = '')
     and (p_email is null or trim(p_email) = '') then
    raise exception 'Provide phone or email to search';
  end if;

  return query
  select
    u.id,
    coalesce(nullif(trim(coalesce(u.full_name, '')), ''), u.email) as display_name,
    u.email,
    u.phone,
    exists (
      select 1 from public.business_customers bc
      where  bc.business_id = p_business_id
        and  bc.user_id     = u.id
    ) as is_known_customer
  from public.users u
  where
    (p_phone is not null and trim(p_phone) <> '' and u.phone = trim(p_phone))
    or
    (p_email is not null and trim(p_email) <> '' and lower(u.email) = lower(trim(p_email)))
  limit 5;
end;
$$;

-- Callable by authenticated users — the function enforces membership itself.
grant execute on function public.search_business_customer(uuid, text, text)
  to authenticated;


-- ============================================================
-- SECTION 5: Replace upsert_business_customer
--
-- Adds p_total_spent_increment (default 0) so callers can track
-- the monetary value of each interaction.
--
-- Backward compatible: existing callers that omit p_total_spent_increment
-- will use the default of 0, which is correct for order-count-only updates.
--
-- We drop the old 5-param function first to avoid ambiguity, then recreate
-- with 6 params (the new param has a default so old named-param callers work).
-- ============================================================

drop function if exists public.upsert_business_customer(uuid, uuid, int, int, int);

create or replace function public.upsert_business_customer(
  p_business_id               uuid,
  p_user_id                   uuid,
  p_order_increment           int     default 0,
  p_completed_order_increment int     default 0,
  p_completed_sale_increment  int     default 0,
  p_total_spent_increment     numeric default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_email     text;
  v_phone     text;
  v_display   text;
begin
  if p_user_id is null then
    return;
  end if;

  select full_name, email, phone
  into   v_full_name, v_email, v_phone
  from   public.users
  where  id = p_user_id;

  if not found then
    return;
  end if;

  v_display := coalesce(nullif(trim(coalesce(v_full_name, '')), ''), v_email);

  insert into public.business_customers (
    business_id, user_id,
    display_name_snapshot, email_snapshot, phone_snapshot,
    first_interaction_at, last_interaction_at,
    order_count, completed_order_count, completed_sale_count, total_spent
  ) values (
    p_business_id, p_user_id,
    v_display, v_email, v_phone,
    now(), now(),
    p_order_increment, p_completed_order_increment, p_completed_sale_increment,
    p_total_spent_increment
  )
  on conflict (business_id, user_id) do update set
    display_name_snapshot  = excluded.display_name_snapshot,
    email_snapshot         = excluded.email_snapshot,
    phone_snapshot         = coalesce(excluded.phone_snapshot, business_customers.phone_snapshot),
    last_interaction_at    = now(),
    order_count            = business_customers.order_count           + p_order_increment,
    completed_order_count  = business_customers.completed_order_count + p_completed_order_increment,
    completed_sale_count   = business_customers.completed_sale_count  + p_completed_sale_increment,
    total_spent            = business_customers.total_spent           + p_total_spent_increment,
    updated_at             = now();
end;
$$;

grant execute on function public.upsert_business_customer(uuid, uuid, int, int, int, numeric)
  to service_role;


-- ============================================================
-- SECTION 6: Replace create_sale
--
-- Adds two behaviours when p_customer_user_id is not null:
--   a) Passes total_spent to upsert_business_customer.
--   b) Calls upsert_business_customer_product for each sale item.
--
-- Both additions are non-fatal (wrapped in BEGIN/EXCEPTION) so a failure
-- in analytics tracking never rolls back a completed sale.
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

  return v_sale_id;
end;
$$;
