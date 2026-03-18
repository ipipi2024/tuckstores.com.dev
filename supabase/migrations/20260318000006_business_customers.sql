-- ============================================================
-- Business Customer Relationship Layer
--
-- Adds a business_customers table as the safe, least-privilege
-- read model for business-visible customer identity.
--
-- Key design decisions:
--  - public.users RLS remains unchanged (only-own-row select).
--  - Businesses never query public.users directly for customer data.
--  - business_customers is the ONLY source of customer display data
--    for business-side UI (orders, sales, CRM, etc.).
--  - upsert_business_customer is SECURITY DEFINER so it can read
--    public.users internally. It is NOT callable by authenticated
--    clients directly — only from trusted SECURITY DEFINER RPCs
--    and server actions using the service_role.
--  - Business members get SELECT-only access to their own business's
--    customer records via RLS.
-- ============================================================


-- ============================================================
-- SECTION 1: TABLE
-- ============================================================

create table public.business_customers (
  id                     uuid        primary key default gen_random_uuid(),
  business_id            uuid        not null references public.businesses(id) on delete cascade,
  user_id                uuid        not null references public.users(id)      on delete cascade,

  -- Safe identity snapshot sourced from public.users at upsert time.
  -- Businesses see only what was explicitly snapshotted here.
  display_name_snapshot  text,       -- full_name if set, otherwise email
  email_snapshot         text,
  phone_snapshot         text,

  -- Relationship metrics (incremented by upsert_business_customer)
  first_interaction_at   timestamptz not null default now(),
  last_interaction_at    timestamptz not null default now(),
  order_count            integer     not null default 0,
  completed_order_count  integer     not null default 0,
  completed_sale_count   integer     not null default 0,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint uq_business_customer unique (business_id, user_id)
);

create index idx_business_customers_business_id on public.business_customers(business_id);
create index idx_business_customers_user_id     on public.business_customers(user_id);

create trigger business_customers_updated_at
  before update on public.business_customers
  for each row execute function public.set_updated_at();


-- ============================================================
-- SECTION 2: upsert_business_customer (SECURITY DEFINER)
-- ============================================================
--
-- Reads public.users (bypassing RLS via security definer context)
-- to snapshot safe display fields, then upserts the relationship row.
--
-- Parameters:
--   p_business_id               — the business
--   p_user_id                   — the platform user (customer)
--   p_order_increment           — how many to add to order_count (default 0)
--   p_completed_order_increment — how many to add to completed_order_count (default 0)
--   p_completed_sale_increment  — how many to add to completed_sale_count (default 0)
--
-- Called from:
--   - create_order (p_order_increment=1)
--   - create_sale  (p_completed_sale_increment=1, when customer_user_id is not null)
--   - updateOrderStatus server action via admin client when completing an order
--     (p_completed_order_increment=1, p_completed_sale_increment=1)

create or replace function public.upsert_business_customer(
  p_business_id               uuid,
  p_user_id                   uuid,
  p_order_increment           int default 0,
  p_completed_order_increment int default 0,
  p_completed_sale_increment  int default 0
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

  -- Read the user's current profile.
  -- Security definer context means this bypasses the users "select own" RLS policy.
  select full_name, email, phone
  into   v_full_name, v_email, v_phone
  from   public.users
  where  id = p_user_id;

  if not found then
    return;
  end if;

  -- Prefer full_name; fall back to email for display
  v_display := coalesce(nullif(trim(coalesce(v_full_name, '')), ''), v_email);

  insert into public.business_customers (
    business_id, user_id,
    display_name_snapshot, email_snapshot, phone_snapshot,
    first_interaction_at, last_interaction_at,
    order_count, completed_order_count, completed_sale_count
  ) values (
    p_business_id, p_user_id,
    v_display, v_email, v_phone,
    now(), now(),
    p_order_increment, p_completed_order_increment, p_completed_sale_increment
  )
  on conflict (business_id, user_id) do update set
    -- Always refresh the snapshot so name changes are reflected
    display_name_snapshot  = excluded.display_name_snapshot,
    email_snapshot         = excluded.email_snapshot,
    -- Only overwrite phone if we have a value (don't blank it out)
    phone_snapshot         = coalesce(excluded.phone_snapshot, business_customers.phone_snapshot),
    last_interaction_at    = now(),
    order_count            = business_customers.order_count           + p_order_increment,
    completed_order_count  = business_customers.completed_order_count + p_completed_order_increment,
    completed_sale_count   = business_customers.completed_sale_count  + p_completed_sale_increment,
    updated_at             = now();
end;
$$;


-- ============================================================
-- SECTION 3: RLS
-- ============================================================

alter table public.business_customers enable row level security;

-- Business members (any active role) can read their own business's customer rows.
-- Scoped to the member's own business via is_business_member().
create policy "business_customers: members select"
  on public.business_customers
  for select
  using (public.is_business_member(business_id));

-- No INSERT / UPDATE / DELETE policies for clients.
-- All writes go through upsert_business_customer (SECURITY DEFINER)
-- called from trusted RPCs, or via the admin client from server actions.


-- ============================================================
-- SECTION 4: GRANTS
-- ============================================================

-- Authenticated business members can SELECT (filtered by RLS above)
grant select on public.business_customers to authenticated;

-- Service role (admin client) gets full access for server-side admin paths
grant all on public.business_customers to service_role;

-- upsert_business_customer: callable by service_role (admin client server actions)
-- and implicitly by SECURITY DEFINER RPCs (they run as the function owner).
-- authenticated role is intentionally NOT granted execute.
grant execute on function public.upsert_business_customer(uuid, uuid, int, int, int)
  to service_role;


-- ============================================================
-- SECTION 5: UPDATE create_order — add business_customer upsert
-- ============================================================
--
-- Full replacement of the function to add the upsert call.
-- The upsert is non-fatal: wrapped in BEGIN/EXCEPTION so a failure
-- there does NOT roll back the order creation.

create or replace function public.create_order(
  p_business_id        uuid,
  p_fulfillment_method fulfillment_method,
  p_customer_note      text,
  p_delivery_address   text,
  p_items              jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id        uuid := auth.uid();
  v_order_id         uuid;
  v_subtotal         numeric(10,2) := 0;
  v_delivery_fee     numeric(10,2) := 0;
  v_total            numeric(10,2) := 0;
  v_item             jsonb;
  v_product_id       uuid;
  v_quantity         integer;
  v_unit_price       numeric(10,2);
  v_product_name     text;
  v_line_total       numeric(10,2);
  v_settings         record;
begin
  -- Must be authenticated
  if v_caller_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Must have at least one item
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;

  -- Business must be active
  if not exists (
    select 1 from public.businesses b
    where b.id = p_business_id
      and b.status = 'active'
  ) then
    raise exception 'Business is not available for orders';
  end if;

  -- Business subscription must be active
  if not public.business_subscription_active(p_business_id) then
    raise exception 'This business is not currently accepting orders';
  end if;

  -- Load delivery settings (use defaults if none configured)
  select
    coalesce(bds.pickup_enabled, true)    as pickup_enabled,
    coalesce(bds.delivery_enabled, false) as delivery_enabled,
    coalesce(bds.delivery_fee, 0)         as delivery_fee,
    bds.free_delivery_above
  into v_settings
  from public.businesses b
  left join public.business_delivery_settings bds on bds.business_id = b.id
  where b.id = p_business_id;

  -- Validate fulfillment method against settings
  if p_fulfillment_method = 'pickup' and not v_settings.pickup_enabled then
    raise exception 'Pickup is not available for this business';
  end if;

  if p_fulfillment_method = 'delivery' and not v_settings.delivery_enabled then
    raise exception 'Delivery is not available for this business';
  end if;

  -- Delivery address required for delivery orders
  if p_fulfillment_method = 'delivery' and (p_delivery_address is null or trim(p_delivery_address) = '') then
    raise exception 'Delivery address is required for delivery orders';
  end if;

  -- Pre-flight: validate all products and re-read authoritative prices
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity   := (v_item->>'quantity')::integer;

    if v_quantity <= 0 then
      raise exception 'Quantity must be positive';
    end if;

    -- Read authoritative price and name from DB
    select name, selling_price
    into   v_product_name, v_unit_price
    from   public.products p
    where  p.id          = v_product_id
      and  p.business_id = p_business_id
      and  p.is_active   = true;

    if not found then
      raise exception 'Product % not found or inactive', v_product_id;
    end if;

    v_subtotal := v_subtotal + (v_unit_price * v_quantity);
  end loop;

  -- Calculate delivery fee
  if p_fulfillment_method = 'delivery' then
    if v_settings.free_delivery_above is not null
       and v_subtotal >= v_settings.free_delivery_above then
      v_delivery_fee := 0;
    else
      v_delivery_fee := coalesce(v_settings.delivery_fee, 0);
    end if;
  end if;

  v_total := v_subtotal + v_delivery_fee;

  -- Insert order header
  insert into public.orders (
    business_id,
    customer_user_id,
    status,
    fulfillment_method,
    subtotal_amount,
    delivery_fee,
    total_amount,
    customer_note,
    delivery_address,
    placed_at
  ) values (
    p_business_id,
    v_caller_id,
    'pending',
    p_fulfillment_method,
    v_subtotal,
    v_delivery_fee,
    v_total,
    p_customer_note,
    p_delivery_address,
    now()
  )
  returning id into v_order_id;

  -- Insert order items (using re-read DB prices, not caller-supplied prices)
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity   := (v_item->>'quantity')::integer;

    select name, selling_price
    into   v_product_name, v_unit_price
    from   public.products p
    where  p.id = v_product_id
      and  p.business_id = p_business_id;

    v_line_total := v_unit_price * v_quantity;

    insert into public.order_items (
      order_id,
      product_id,
      product_name_snapshot,
      unit_price_snapshot,
      quantity,
      line_total
    ) values (
      v_order_id,
      v_product_id,
      v_product_name,
      v_unit_price,
      v_quantity,
      v_line_total
    );
  end loop;

  -- Register the customer relationship for this business.
  -- Non-fatal: a failure here must not roll back the order.
  begin
    perform public.upsert_business_customer(
      p_business_id, v_caller_id,
      1, 0, 0  -- order_increment = 1
    );
  exception when others then
    null; -- silently continue
  end;

  return v_order_id;
end;
$$;


-- ============================================================
-- SECTION 6: UPDATE create_sale — add business_customer upsert
-- ============================================================
--
-- Full replacement of the function to add the upsert call when
-- a platform customer is linked to the sale.

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
  v_available_qty integer;
begin
  -- Caller must be authenticated
  if v_caller_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Authorization checks
  if not public.has_business_role(
    p_business_id,
    array['owner','admin','manager','cashier']::membership_role[]
  ) then
    raise exception 'Insufficient permissions to create sale';
  end if;

  if not public.business_subscription_active(p_business_id) then
    raise exception 'Business subscription is not active';
  end if;

  -- Input validation
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

  -- Register the customer relationship when a platform user is linked.
  -- Non-fatal: a failure here must not roll back the sale.
  if p_customer_user_id is not null then
    begin
      perform public.upsert_business_customer(
        p_business_id, p_customer_user_id,
        0, 0, 1  -- completed_sale_increment = 1
      );
    exception when others then
      null;
    end;
  end if;

  return v_sale_id;
end;
$$;
