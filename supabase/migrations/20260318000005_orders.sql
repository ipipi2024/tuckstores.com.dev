-- ============================================================
-- Orders System
-- Adds: fulfillment_method enum, order_status enum,
--       business_delivery_settings, orders, order_items tables,
--       create_order SECURITY DEFINER RPC, RLS policies, grants.
-- ============================================================


-- ============================================================
-- SECTION 1: ENUMS
-- ============================================================

create type public.order_status as enum (
  'pending',
  'accepted',
  'rejected',
  'preparing',
  'ready',
  'out_for_delivery',
  'completed',
  'cancelled'
);

create type public.fulfillment_method as enum (
  'pickup',
  'delivery'
);


-- ============================================================
-- SECTION 2: SEQUENCE (human-readable order numbers)
-- ============================================================

create sequence if not exists public.order_number_seq start 1000;


-- ============================================================
-- SECTION 3: BUSINESS DELIVERY SETTINGS
-- ============================================================

create table public.business_delivery_settings (
  id                    uuid        primary key default gen_random_uuid(),
  business_id           uuid        not null unique references public.businesses(id) on delete cascade,
  pickup_enabled        boolean     not null default true,
  delivery_enabled      boolean     not null default false,
  -- Flat delivery fee charged on every delivery order (0 = free)
  delivery_fee          numeric(10,2) not null default 0 check (delivery_fee >= 0),
  -- Orders above this threshold get free delivery (null = no threshold)
  free_delivery_above   numeric(10,2)          check (free_delivery_above is null or free_delivery_above >= 0),
  -- Estimated time text shown to customer (e.g. "30–45 min")
  estimated_time_pickup   text,
  estimated_time_delivery text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint at_least_one_method check (pickup_enabled or delivery_enabled)
);

create trigger business_delivery_settings_updated_at
  before update on public.business_delivery_settings
  for each row execute function public.set_updated_at();


-- ============================================================
-- SECTION 4: ORDERS TABLE
-- ============================================================

create table public.orders (
  id                    uuid               primary key default gen_random_uuid(),
  order_number          text               not null unique
                          default ('ORD-' || lpad(nextval('public.order_number_seq')::text, 6, '0')),
  business_id           uuid               not null references public.businesses(id) on delete restrict,
  customer_user_id      uuid               not null references public.users(id) on delete restrict,
  status                public.order_status not null default 'pending',
  fulfillment_method    public.fulfillment_method not null,

  -- Price components (all in business currency)
  subtotal_amount       numeric(10,2)      not null default 0,
  delivery_fee          numeric(10,2)      not null default 0,
  total_amount          numeric(10,2)      not null default 0,

  -- Customer-provided info
  customer_note         text,
  delivery_address      text,               -- required when fulfillment_method = 'delivery'

  -- Business-side notes
  business_note         text,

  -- Timestamps
  placed_at             timestamptz        not null default now(),
  accepted_at           timestamptz,
  rejected_at           timestamptz,
  completed_at          timestamptz,
  cancelled_at          timestamptz,
  created_at            timestamptz        not null default now(),
  updated_at            timestamptz        not null default now()
);

create index idx_orders_business_id        on public.orders(business_id);
create index idx_orders_customer_user_id   on public.orders(customer_user_id);
create index idx_orders_status             on public.orders(status);
create index idx_orders_placed_at          on public.orders(placed_at desc);

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();


-- ============================================================
-- SECTION 5: ORDER ITEMS TABLE
-- ============================================================

create table public.order_items (
  id                    uuid          primary key default gen_random_uuid(),
  order_id              uuid          not null references public.orders(id) on delete cascade,
  product_id            uuid          references public.products(id) on delete set null,
  -- Snapshots at time of order placement (prices re-read from DB by RPC)
  product_name_snapshot text          not null,
  unit_price_snapshot   numeric(10,2) not null,
  quantity              integer       not null check (quantity > 0),
  line_total            numeric(10,2) not null,
  created_at            timestamptz   not null default now()
);

create index idx_order_items_order_id on public.order_items(order_id);


-- ============================================================
-- SECTION 6: RLS POLICIES
-- ============================================================

-- ---- business_delivery_settings ----
alter table public.business_delivery_settings enable row level security;

-- Public can view delivery settings for any active business (needed for checkout page)
create policy "delivery_settings: public read active businesses"
  on public.business_delivery_settings
  for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id
        and b.status = 'active'
    )
  );

-- Admin+ can upsert their business delivery settings
create policy "delivery_settings: admin+ upsert"
  on public.business_delivery_settings
  for all
  using (
    public.has_business_role(
      business_id,
      array['owner','admin']::membership_role[]
    )
  )
  with check (
    public.has_business_role(
      business_id,
      array['owner','admin']::membership_role[]
    )
  );


-- ---- orders ----
alter table public.orders enable row level security;

-- Customers can view their own orders
create policy "orders: customer select own"
  on public.orders
  for select
  using (customer_user_id = auth.uid());

-- Business members (cashier+) can view all orders for their business
create policy "orders: member select"
  on public.orders
  for select
  using (
    public.has_business_role(
      business_id,
      array['owner','admin','manager','cashier']::membership_role[]
    )
  );

-- Customers can cancel their own pending orders
create policy "orders: customer cancel pending"
  on public.orders
  for update
  using (
    customer_user_id = auth.uid()
    and status = 'pending'
  )
  with check (
    customer_user_id = auth.uid()
    and status = 'cancelled'
  );

-- Business members (cashier+) can update order status
create policy "orders: member update status"
  on public.orders
  for update
  using (
    public.has_business_role(
      business_id,
      array['owner','admin','manager','cashier']::membership_role[]
    )
  )
  with check (
    public.has_business_role(
      business_id,
      array['owner','admin','manager','cashier']::membership_role[]
    )
  );


-- ---- order_items ----
alter table public.order_items enable row level security;

-- Customers can view items for their own orders
create policy "order_items: customer select own"
  on public.order_items
  for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.customer_user_id = auth.uid()
    )
  );

-- Business members (cashier+) can view items for their business orders
create policy "order_items: member select"
  on public.order_items
  for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and public.has_business_role(
          o.business_id,
          array['owner','admin','manager','cashier']::membership_role[]
        )
    )
  );


-- ============================================================
-- SECTION 7: create_order RPC (SECURITY DEFINER)
-- ============================================================
--
-- p_items jsonb schema:
--   [{ "product_id": uuid, "quantity": int }]
--
-- The RPC ignores any price supplied by the caller.
-- It re-reads selling_price from public.products at placement time.
--

create or replace function public.create_order(
  p_business_id        uuid,
  p_fulfillment_method fulfillment_method,
  p_customer_note      text,         -- nullable
  p_delivery_address   text,         -- required when fulfillment_method = 'delivery'
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
    coalesce(bds.pickup_enabled, true)   as pickup_enabled,
    coalesce(bds.delivery_enabled, false) as delivery_enabled,
    coalesce(bds.delivery_fee, 0)        as delivery_fee,
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

  return v_order_id;
end;
$$;


-- ============================================================
-- SECTION 8: GRANTS
-- ============================================================

-- anon can read delivery settings (public browsing)
grant select on public.business_delivery_settings to anon, authenticated;

-- authenticated users interact with orders via RPC + direct RLS-controlled queries
grant select, update on public.orders      to authenticated;
grant select           on public.order_items to authenticated;

-- Service role (admin client) gets full access
grant all on public.business_delivery_settings to service_role;
grant all on public.orders                      to service_role;
grant all on public.order_items                 to service_role;

-- RPC callable by authenticated users
grant execute on function public.create_order(uuid, fulfillment_method, text, text, jsonb)
  to authenticated;
