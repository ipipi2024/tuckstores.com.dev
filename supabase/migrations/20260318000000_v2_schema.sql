-- ============================================================
-- TuckStores v2 Schema
-- Single canonical migration replacing all legacy v1 migrations.
-- Clean rebuild: multi-tenant, business_id tenancy, membership-based
-- authorization, atomic RPCs, location-aware stock.
-- Date: 2026-03-18
-- ============================================================


-- ============================================================
-- SECTION 1: EXTENSIONS
-- ============================================================

create extension if not exists "pgcrypto";


-- ============================================================
-- SECTION 2: ENUMS
-- ============================================================

create type user_status as enum (
  'active',
  'suspended'
);

create type business_status as enum (
  'active',
  'inactive',
  'suspended'
);

create type membership_role as enum (
  'owner',
  'admin',
  'manager',
  'cashier',
  'inventory_clerk',
  'staff'
);

create type membership_status as enum (
  'invited',
  'active',
  'suspended',
  'revoked'
);

create type subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'expired',
  'cancelled'
);

create type purchase_status as enum (
  'draft',
  'received',
  'cancelled'
);

create type sale_channel as enum (
  'pos',
  'manual',
  'online'
);

create type sale_status as enum (
  'completed',
  'cancelled',
  'refunded',
  'partially_refunded'
);

create type inventory_movement_type as enum (
  'purchase',
  'sale',
  'return_in',
  'return_out',
  'adjustment_in',
  'adjustment_out',
  'transfer_in',
  'transfer_out'
);

create type sender_type as enum (
  'customer',
  'business_member',
  'system'
);

create type message_type as enum (
  'text',
  'system'
);


-- ============================================================
-- SECTION 3: SHARED TRIGGER FUNCTION (updated_at)
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================
-- SECTION 4: CORE IDENTITY & TENANT TABLES
-- ============================================================

-- 4.1  users — platform identities, one row per auth.users entry
create table public.users (
  id          uuid        primary key references auth.users(id) on delete cascade,
  email       text        not null,
  phone       text,
  full_name   text,
  avatar_url  text,
  status      user_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- Auto-create a public.users row whenever a new auth.users row is inserted.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 4.2  businesses — independent tenant entities
create table public.businesses (
  id               uuid            primary key default gen_random_uuid(),
  name             text            not null,
  slug             text            not null unique,
  description      text,
  phone            text,
  email            text,
  logo_url         text,
  cover_image_url  text,
  status           business_status not null default 'active',
  currency_code    text            not null default 'USD',
  country_code     text            not null default 'US',
  timezone         text            not null default 'UTC',
  created_at       timestamptz     not null default now(),
  updated_at       timestamptz     not null default now()
);

create index idx_businesses_slug on public.businesses(slug);

create trigger businesses_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();


-- 4.3  business_locations — physical locations belonging to a business
create table public.business_locations (
  id             uuid        primary key default gen_random_uuid(),
  business_id    uuid        not null references public.businesses(id) on delete cascade,
  name           text        not null,
  address_line_1 text,
  address_line_2 text,
  city           text,
  state_region   text,
  postal_code    text,
  country_code   text,
  latitude       numeric(9,6),
  longitude      numeric(9,6),
  is_primary     boolean     not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_business_locations_business_id on public.business_locations(business_id);

create trigger business_locations_updated_at
  before update on public.business_locations
  for each row execute function public.set_updated_at();


-- 4.4  business_memberships — user ↔ business relationship with role
create table public.business_memberships (
  id                 uuid              primary key default gen_random_uuid(),
  business_id        uuid              not null references public.businesses(id) on delete cascade,
  user_id            uuid              not null references public.users(id) on delete cascade,
  role               membership_role   not null default 'staff',
  status             membership_status not null default 'active',
  invited_by_user_id uuid              references public.users(id) on delete set null,
  joined_at          timestamptz,
  created_at         timestamptz       not null default now(),
  updated_at         timestamptz       not null default now(),
  unique(business_id, user_id)
);

create index idx_business_memberships_business_id on public.business_memberships(business_id);
create index idx_business_memberships_user_id     on public.business_memberships(user_id);

create trigger business_memberships_updated_at
  before update on public.business_memberships
  for each row execute function public.set_updated_at();


-- 4.5  business_invitations — email-based invitation tokens
create table public.business_invitations (
  id                 uuid            primary key default gen_random_uuid(),
  business_id        uuid            not null references public.businesses(id) on delete cascade,
  email              text            not null,
  role               membership_role not null default 'staff',
  invited_by_user_id uuid            not null references public.users(id) on delete cascade,
  token              text            not null unique default encode(gen_random_bytes(32), 'hex'),
  status             text            not null default 'pending'
                       check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at         timestamptz     not null default (now() + interval '7 days'),
  created_at         timestamptz     not null default now(),
  updated_at         timestamptz     not null default now()
);

create index idx_business_invitations_business_id on public.business_invitations(business_id);
create index idx_business_invitations_token       on public.business_invitations(token);
create index idx_business_invitations_email       on public.business_invitations(email);

create trigger business_invitations_updated_at
  before update on public.business_invitations
  for each row execute function public.set_updated_at();


-- ============================================================
-- SECTION 5: SUBSCRIPTION TABLES
-- ============================================================

-- 5.1  subscription_plans — plan catalogue (seeded below)
create table public.subscription_plans (
  id             uuid        primary key default gen_random_uuid(),
  code           text        not null unique,
  name           text        not null,
  monthly_price  numeric(10,2),
  yearly_price   numeric(10,2),
  max_members    integer,       -- null = unlimited
  max_locations  integer,       -- null = unlimited
  features_json  jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger subscription_plans_updated_at
  before update on public.subscription_plans
  for each row execute function public.set_updated_at();


-- 5.2  business_subscriptions — exactly one subscription per business
create table public.business_subscriptions (
  id             uuid                primary key default gen_random_uuid(),
  business_id    uuid                not null unique references public.businesses(id) on delete cascade,
  plan_id        uuid                not null references public.subscription_plans(id),
  status         subscription_status not null default 'trialing',
  starts_at      timestamptz,
  expires_at     timestamptz,
  trial_ends_at  timestamptz,
  billing_cycle  text                check (billing_cycle in ('monthly', 'yearly')),
  created_at     timestamptz         not null default now(),
  updated_at     timestamptz         not null default now()
);

create index idx_business_subscriptions_business_id on public.business_subscriptions(business_id);

create trigger business_subscriptions_updated_at
  before update on public.business_subscriptions
  for each row execute function public.set_updated_at();


-- ============================================================
-- SECTION 6: BUSINESS OPERATIONAL TABLES
-- ============================================================

-- 6.1  product_categories — per-business category tree (flat for now)
create table public.product_categories (
  id          uuid        primary key default gen_random_uuid(),
  business_id uuid        not null references public.businesses(id) on delete cascade,
  name        text        not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(business_id, name)
);

create index idx_product_categories_business_id on public.product_categories(business_id);

create trigger product_categories_updated_at
  before update on public.product_categories
  for each row execute function public.set_updated_at();


-- 6.2  products
create table public.products (
  id                 uuid        primary key default gen_random_uuid(),
  business_id        uuid        not null references public.businesses(id) on delete cascade,
  category_id        uuid        references public.product_categories(id) on delete set null,
  name               text        not null,
  description        text,
  sku                text,
  barcode            text,
  selling_price      numeric(10,2),
  cost_price_default numeric(10,2),
  is_active          boolean     not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_products_business_id  on public.products(business_id);
create index idx_products_category_id  on public.products(category_id);
create index idx_products_sku          on public.products(business_id, sku)     where sku     is not null;
create index idx_products_barcode      on public.products(business_id, barcode) where barcode is not null;

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();


-- 6.3  suppliers
create table public.suppliers (
  id          uuid        primary key default gen_random_uuid(),
  business_id uuid        not null references public.businesses(id) on delete cascade,
  name        text        not null,
  phone       text,
  email       text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_suppliers_business_id on public.suppliers(business_id);

create trigger suppliers_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();


-- 6.4  purchases — stock order header
create table public.purchases (
  id                  uuid            primary key default gen_random_uuid(),
  business_id         uuid            not null references public.businesses(id) on delete cascade,
  location_id         uuid            references public.business_locations(id) on delete set null,
  supplier_id         uuid            references public.suppliers(id) on delete set null,
  status              purchase_status not null default 'received',
  purchase_date       date            not null default current_date,
  subtotal_amount     numeric(10,2)   not null default 0,
  tax_amount          numeric(10,2)   not null default 0,
  total_amount        numeric(10,2)   not null default 0,
  notes               text,
  recorded_by_user_id uuid            not null references public.users(id) on delete restrict,
  created_at          timestamptz     not null default now(),
  updated_at          timestamptz     not null default now()
);

create index idx_purchases_business_id   on public.purchases(business_id);
create index idx_purchases_supplier_id   on public.purchases(supplier_id);
create index idx_purchases_purchase_date on public.purchases(business_id, purchase_date desc);

create trigger purchases_updated_at
  before update on public.purchases
  for each row execute function public.set_updated_at();


-- 6.5  purchase_items — line items for a purchase
create table public.purchase_items (
  id                    uuid        primary key default gen_random_uuid(),
  purchase_id           uuid        not null references public.purchases(id) on delete cascade,
  product_id            uuid        not null references public.products(id) on delete restrict,
  product_name_snapshot text        not null,
  quantity              integer     not null check (quantity > 0),
  unit_cost             numeric(10,2) not null check (unit_cost >= 0),
  subtotal              numeric(10,2) not null generated always as (quantity * unit_cost) stored,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_purchase_items_purchase_id on public.purchase_items(purchase_id);
create index idx_purchase_items_product_id  on public.purchase_items(product_id);

create trigger purchase_items_updated_at
  before update on public.purchase_items
  for each row execute function public.set_updated_at();


-- 6.6  sales — transaction header
--   customer_user_id: platform user (authenticated customer) — nullable
--   customer_*_snapshot: for guest/walk-in sales or history stability
create table public.sales (
  id                      uuid         primary key default gen_random_uuid(),
  business_id             uuid         not null references public.businesses(id) on delete cascade,
  location_id             uuid         references public.business_locations(id) on delete set null,
  customer_user_id        uuid         references public.users(id) on delete set null,
  sale_channel            sale_channel not null default 'pos',
  status                  sale_status  not null default 'completed',
  subtotal_amount         numeric(10,2) not null default 0,
  discount_amount         numeric(10,2) not null default 0,
  tax_amount              numeric(10,2) not null default 0,
  total_amount            numeric(10,2) not null default 0,
  notes                   text,
  customer_name_snapshot  text,   -- guest or snapshot of user name at time of sale
  customer_phone_snapshot text,   -- guest or snapshot of user phone at time of sale
  recorded_by_user_id     uuid         not null references public.users(id) on delete restrict,
  created_at              timestamptz  not null default now(),
  updated_at              timestamptz  not null default now()
);

create index idx_sales_business_id      on public.sales(business_id);
create index idx_sales_created_at       on public.sales(business_id, created_at desc);
create index idx_sales_status           on public.sales(business_id, status);
create index idx_sales_customer_user_id on public.sales(customer_user_id) where customer_user_id is not null;

create trigger sales_updated_at
  before update on public.sales
  for each row execute function public.set_updated_at();


-- 6.7  sale_items — line items for a sale
create table public.sale_items (
  id                    uuid        primary key default gen_random_uuid(),
  sale_id               uuid        not null references public.sales(id) on delete cascade,
  product_id            uuid        not null references public.products(id) on delete restrict,
  product_name_snapshot text        not null,
  quantity              integer     not null check (quantity > 0),
  unit_price            numeric(10,2) not null check (unit_price >= 0),
  discount_amount       numeric(10,2) not null default 0 check (discount_amount >= 0),
  subtotal              numeric(10,2) not null
    generated always as ((quantity * unit_price) - discount_amount) stored,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_sale_items_sale_id    on public.sale_items(sale_id);
create index idx_sale_items_product_id on public.sale_items(product_id);

create trigger sale_items_updated_at
  before update on public.sale_items
  for each row execute function public.set_updated_at();


-- 6.8  sale_payments — one or more payments per sale (split payment support)
create table public.sale_payments (
  id             uuid        primary key default gen_random_uuid(),
  sale_id        uuid        not null references public.sales(id) on delete cascade,
  payment_method text        not null,
  amount         numeric(10,2) not null check (amount > 0),
  reference      text,
  paid_at        timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_sale_payments_sale_id on public.sale_payments(sale_id);

create trigger sale_payments_updated_at
  before update on public.sale_payments
  for each row execute function public.set_updated_at();


-- 6.9  inventory_movements — immutable audit trail of all stock changes
--   positive quantity = stock in  (purchase, return_in, adjustment_in, transfer_in)
--   negative quantity = stock out (sale, return_out, adjustment_out, transfer_out)
--   location_id null = no specific location (business-wide movement)
create table public.inventory_movements (
  id                   uuid                    primary key default gen_random_uuid(),
  business_id          uuid                    not null references public.businesses(id) on delete cascade,
  location_id          uuid                    references public.business_locations(id) on delete set null,
  product_id           uuid                    not null references public.products(id) on delete restrict,
  quantity             integer                 not null,  -- sign carries direction
  movement_type        inventory_movement_type not null,
  reference_type       text,   -- 'purchase' | 'sale' | 'adjustment' | null
  reference_id         uuid,   -- loose FK to purchase.id or sale.id
  performed_by_user_id uuid                    not null references public.users(id) on delete restrict,
  notes                text,
  created_at           timestamptz             not null default now()
  -- intentionally no updated_at: movements are immutable records
);

create index idx_inventory_movements_business_product
  on public.inventory_movements(business_id, product_id);
create index idx_inventory_movements_business_location
  on public.inventory_movements(business_id, location_id);
create index idx_inventory_movements_reference
  on public.inventory_movements(reference_type, reference_id)
  where reference_id is not null;


-- ============================================================
-- SECTION 7: OPTIONAL TABLES
-- ============================================================

-- 7.1  audit_logs — platform/business event log
create table public.audit_logs (
  id            uuid        primary key default gen_random_uuid(),
  business_id   uuid        references public.businesses(id) on delete set null,
  actor_user_id uuid        references public.users(id) on delete set null,
  action        text        not null,
  target_type   text,
  target_id     uuid,
  metadata_json jsonb,
  created_at    timestamptz not null default now()
);

create index idx_audit_logs_business_id  on public.audit_logs(business_id);
create index idx_audit_logs_actor        on public.audit_logs(actor_user_id);
create index idx_audit_logs_created_at   on public.audit_logs(business_id, created_at desc);


-- 7.2  conversations — one thread per (business, customer) pair
create table public.conversations (
  id               uuid        primary key default gen_random_uuid(),
  business_id      uuid        not null references public.businesses(id) on delete cascade,
  customer_user_id uuid        not null references public.users(id) on delete cascade,
  status           text        not null default 'open'
                     check (status in ('open', 'closed', 'archived')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique(business_id, customer_user_id)
);

create index idx_conversations_business_id      on public.conversations(business_id);
create index idx_conversations_customer_user_id on public.conversations(customer_user_id);

create trigger conversations_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();


-- 7.3  conversation_messages — individual messages in a thread
create table public.conversation_messages (
  id              uuid         primary key default gen_random_uuid(),
  conversation_id uuid         not null references public.conversations(id) on delete cascade,
  sender_user_id  uuid         references public.users(id) on delete set null,
  sender_type     sender_type  not null,
  message_type    message_type not null default 'text',
  body            text         not null,
  created_at      timestamptz  not null default now()
  -- no updated_at: messages are immutable
);

create index idx_conversation_messages_conversation_id
  on public.conversation_messages(conversation_id);


-- 7.4  business_announcements — broadcasts from business to members or customers
create table public.business_announcements (
  id                 uuid        primary key default gen_random_uuid(),
  business_id        uuid        not null references public.businesses(id) on delete cascade,
  title              text        not null,
  body               text        not null,
  audience_type      text        not null default 'members'
                       check (audience_type in ('members', 'customers', 'all')),
  created_by_user_id uuid        not null references public.users(id) on delete restrict,
  published_at       timestamptz,
  expires_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_business_announcements_business_id
  on public.business_announcements(business_id);

create trigger business_announcements_updated_at
  before update on public.business_announcements
  for each row execute function public.set_updated_at();


-- ============================================================
-- SECTION 8: VIEWS
-- ============================================================

-- product_stock: current stock levels aggregated from inventory_movements.
-- Groups by (business_id, location_id, product_id).
-- location_id IS NULL rows represent movements not tied to a specific location
-- (i.e. business-wide stock). Application must handle both cases when querying.
create or replace view public.product_stock as
select
  im.business_id,
  im.location_id,
  im.product_id,
  sum(im.quantity)::integer as stock_quantity
from public.inventory_movements im
group by
  im.business_id,
  im.location_id,
  im.product_id;


-- ============================================================
-- SECTION 9: AUTHORIZATION HELPER FUNCTIONS
-- ============================================================
-- All three helpers are SECURITY DEFINER so they can read
-- business_memberships and business_subscriptions without the
-- caller needing direct table grants for policy evaluation.
-- They still enforce auth.uid() internally so they cannot be
-- abused to check membership on behalf of another user.

-- 9.1  is_business_member — true if the current user has an active membership
create or replace function public.is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from   public.business_memberships bm
    where  bm.business_id = p_business_id
      and  bm.user_id     = auth.uid()
      and  bm.status      = 'active'
  );
$$;


-- 9.2  has_business_role — true if current user has an active membership
--      with one of the specified roles
create or replace function public.has_business_role(
  p_business_id uuid,
  p_roles       membership_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from   public.business_memberships bm
    where  bm.business_id = p_business_id
      and  bm.user_id     = auth.uid()
      and  bm.status      = 'active'
      and  bm.role        = any(p_roles)
  );
$$;


-- 9.3  business_subscription_active — true if the business has a current
--      active or trialing subscription that has not yet expired
create or replace function public.business_subscription_active(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from   public.business_subscriptions bs
    where  bs.business_id = p_business_id
      and  bs.status      in ('active', 'trialing')
      and  (bs.expires_at     is null or bs.expires_at     > now())
      and  (bs.trial_ends_at  is null or bs.trial_ends_at  > now())
  );
$$;


-- ============================================================
-- SECTION 10: ATOMIC RPC FUNCTIONS
-- ============================================================
-- Both RPCs run as SECURITY DEFINER so they can bypass the per-table
-- INSERT policies that would otherwise block inventory_movements inserts
-- mid-transaction. They perform their own membership + role + subscription
-- checks at the top, so they are not a security bypass — they are the
-- authoritative check for these operations.

-- 10.1  create_purchase
--   Atomically inserts: purchase header + purchase_items + inventory_movements.
--   p_items jsonb schema:
--     [{ "product_id": uuid, "product_name": text, "quantity": int, "unit_cost": numeric }]
create or replace function public.create_purchase(
  p_business_id         uuid,
  p_location_id         uuid,          -- nullable
  p_supplier_id         uuid,          -- nullable
  p_purchase_date       date,
  p_notes               text,          -- nullable
  p_recorded_by_user_id uuid,
  p_items               jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase_id   uuid;
  v_subtotal      numeric(10,2) := 0;
  v_item          jsonb;
  v_product_id    uuid;
  v_product_name  text;
  v_quantity      integer;
  v_unit_cost     numeric(10,2);
  v_item_subtotal numeric(10,2);
begin
  -- Authorization checks
  if not public.has_business_role(
    p_business_id,
    array['owner','admin','manager','inventory_clerk']::membership_role[]
  ) then
    raise exception 'Insufficient permissions to create purchase';
  end if;

  if not public.business_subscription_active(p_business_id) then
    raise exception 'Business subscription is not active';
  end if;

  -- Input validation
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Purchase must contain at least one item';
  end if;

  -- Insert purchase header (totals filled in after items)
  insert into public.purchases (
    business_id, location_id, supplier_id, status,
    purchase_date, subtotal_amount, tax_amount, total_amount,
    notes, recorded_by_user_id
  ) values (
    p_business_id, p_location_id, p_supplier_id, 'received',
    p_purchase_date, 0, 0, 0,
    p_notes, p_recorded_by_user_id
  )
  returning id into v_purchase_id;

  -- Process each line item
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id   := (v_item->>'product_id')::uuid;
    v_product_name := v_item->>'product_name';
    v_quantity     := (v_item->>'quantity')::integer;
    v_unit_cost    := (v_item->>'unit_cost')::numeric(10,2);
    v_item_subtotal := v_quantity * v_unit_cost;

    -- Validate product belongs to this business
    if not exists (
      select 1 from public.products p
      where  p.id          = v_product_id
        and  p.business_id = p_business_id
    ) then
      raise exception 'Product % does not belong to business %',
        v_product_id, p_business_id;
    end if;

    -- Validate quantity
    if v_quantity <= 0 then
      raise exception 'Quantity must be positive for product %', v_product_id;
    end if;

    -- Insert purchase item
    insert into public.purchase_items (
      purchase_id, product_id, product_name_snapshot, quantity, unit_cost
    ) values (
      v_purchase_id, v_product_id, v_product_name, v_quantity, v_unit_cost
    );

    -- Insert inventory movement (positive = stock in)
    insert into public.inventory_movements (
      business_id, location_id, product_id, quantity,
      movement_type, reference_type, reference_id,
      performed_by_user_id
    ) values (
      p_business_id, p_location_id, v_product_id, v_quantity,
      'purchase', 'purchase', v_purchase_id,
      p_recorded_by_user_id
    );

    v_subtotal := v_subtotal + v_item_subtotal;
  end loop;

  -- Update purchase totals (no tax in MVP)
  update public.purchases
  set    subtotal_amount = v_subtotal,
         total_amount    = v_subtotal
  where  id = v_purchase_id;

  return v_purchase_id;
end;
$$;


-- 10.2  create_sale
--   Atomically inserts: sale header + sale_items + sale_payments
--   + inventory_movements (negative qty).
--   Validates stock levels before committing.
--
--   p_items jsonb schema:
--     [{ "product_id": uuid, "product_name": text, "quantity": int,
--        "unit_price": numeric, "discount_amount": numeric }]
--   p_payments jsonb schema:
--     [{ "payment_method": text, "amount": numeric, "reference": text|null }]
create or replace function public.create_sale(
  p_business_id             uuid,
  p_location_id             uuid,          -- nullable
  p_customer_user_id        uuid,          -- nullable (platform user)
  p_customer_name_snapshot  text,          -- nullable (guest / history snapshot)
  p_customer_phone_snapshot text,          -- nullable
  p_sale_channel            sale_channel,
  p_notes                   text,          -- nullable
  p_recorded_by_user_id     uuid,
  p_items                   jsonb,
  p_payments                jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
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

    -- Product must belong to this business and be active
    if not exists (
      select 1 from public.products p
      where  p.id          = v_product_id
        and  p.business_id = p_business_id
        and  p.is_active   = true
    ) then
      raise exception 'Product % not found or inactive in business %',
        v_product_id, p_business_id;
    end if;

    if v_quantity <= 0 then
      raise exception 'Quantity must be positive for product %', v_product_id;
    end if;

    -- Stock check: sum movements for this business+product.
    -- When a location is specified we check location-scoped stock first;
    -- if no location-scoped movements exist we fall back to null-location stock.
    -- This covers the common single-location setup where movements have no location.
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

  -- Insert sale header (totals filled in after items)
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
    p_notes, p_recorded_by_user_id
  )
  returning id into v_sale_id;

  -- Insert sale items and corresponding inventory movements
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

    -- Inventory movement (negative = stock out)
    insert into public.inventory_movements (
      business_id, location_id, product_id, quantity,
      movement_type, reference_type, reference_id,
      performed_by_user_id
    ) values (
      p_business_id, p_location_id, v_product_id, -v_quantity,
      'sale', 'sale', v_sale_id,
      p_recorded_by_user_id
    );

    v_subtotal := v_subtotal + (v_quantity * v_unit_price);
    v_discount := v_discount + v_item_discount;
  end loop;

  -- Insert payments
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

  -- Update sale totals (no tax in MVP)
  update public.sales
  set    subtotal_amount = v_subtotal,
         discount_amount = v_discount,
         total_amount    = v_subtotal - v_discount
  where  id = v_sale_id;

  return v_sale_id;
end;
$$;


-- ============================================================
-- SECTION 11: ROW LEVEL SECURITY
-- ============================================================

alter table public.users                   enable row level security;
alter table public.businesses              enable row level security;
alter table public.business_locations      enable row level security;
alter table public.business_memberships    enable row level security;
alter table public.business_invitations    enable row level security;
alter table public.subscription_plans      enable row level security;
alter table public.business_subscriptions  enable row level security;
alter table public.product_categories      enable row level security;
alter table public.products                enable row level security;
alter table public.suppliers               enable row level security;
alter table public.purchases               enable row level security;
alter table public.purchase_items          enable row level security;
alter table public.sales                   enable row level security;
alter table public.sale_items              enable row level security;
alter table public.sale_payments           enable row level security;
alter table public.inventory_movements     enable row level security;
alter table public.audit_logs              enable row level security;
alter table public.conversations           enable row level security;
alter table public.conversation_messages   enable row level security;
alter table public.business_announcements  enable row level security;


-- ---- users ----
create policy "users: select own"
  on public.users for select
  using (auth.uid() = id);

create policy "users: update own"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- ---- businesses ----
-- Insert is handled by the create_business server action using the admin client
-- (service role) to avoid bootstrapping RLS deadlock when the first membership
-- row doesn't exist yet.
create policy "businesses: select for active members"
  on public.businesses for select
  using (public.is_business_member(id));

create policy "businesses: update for owner or admin"
  on public.businesses for update
  using (public.has_business_role(id, array['owner','admin']::membership_role[]))
  with check (public.has_business_role(id, array['owner','admin']::membership_role[]));


-- ---- business_locations ----
create policy "business_locations: select for active members"
  on public.business_locations for select
  using (public.is_business_member(business_id));

create policy "business_locations: insert for owner or admin"
  on public.business_locations for insert
  with check (public.has_business_role(business_id, array['owner','admin']::membership_role[]));

create policy "business_locations: update for owner or admin"
  on public.business_locations for update
  using (public.has_business_role(business_id, array['owner','admin']::membership_role[]))
  with check (public.has_business_role(business_id, array['owner','admin']::membership_role[]));

create policy "business_locations: delete for owner or admin"
  on public.business_locations for delete
  using (public.has_business_role(business_id, array['owner','admin']::membership_role[]));


-- ---- business_memberships ----
create policy "business_memberships: select for active members"
  on public.business_memberships for select
  using (public.is_business_member(business_id));

create policy "business_memberships: insert for owner or admin"
  on public.business_memberships for insert
  with check (public.has_business_role(business_id, array['owner','admin']::membership_role[]));

create policy "business_memberships: update for owner or admin"
  on public.business_memberships for update
  using (public.has_business_role(business_id, array['owner','admin']::membership_role[]))
  with check (public.has_business_role(business_id, array['owner','admin']::membership_role[]));

create policy "business_memberships: delete for owner or admin"
  on public.business_memberships for delete
  using (public.has_business_role(business_id, array['owner','admin']::membership_role[]));


-- ---- business_invitations ----
create policy "business_invitations: select for owner or admin"
  on public.business_invitations for select
  using (public.has_business_role(business_id, array['owner','admin']::membership_role[]));

create policy "business_invitations: insert for owner or admin"
  on public.business_invitations for insert
  with check (public.has_business_role(business_id, array['owner','admin']::membership_role[]));

create policy "business_invitations: update for owner or admin"
  on public.business_invitations for update
  using (public.has_business_role(business_id, array['owner','admin']::membership_role[]))
  with check (public.has_business_role(business_id, array['owner','admin']::membership_role[]));

create policy "business_invitations: delete for owner or admin"
  on public.business_invitations for delete
  using (public.has_business_role(business_id, array['owner','admin']::membership_role[]));


-- ---- subscription_plans ----
-- Publicly readable; write access is service role only (no insert/update policy for authenticated)
create policy "subscription_plans: public read"
  on public.subscription_plans for select
  using (true);


-- ---- business_subscriptions ----
-- Active members can read their own business's subscription.
-- Writes are service role only (billing, admin panel).
create policy "business_subscriptions: select for active members"
  on public.business_subscriptions for select
  using (public.is_business_member(business_id));


-- ---- product_categories ----
create policy "product_categories: select for active members"
  on public.product_categories for select
  using (public.is_business_member(business_id));

create policy "product_categories: insert for manager or above"
  on public.product_categories for insert
  with check (public.has_business_role(business_id, array['owner','admin','manager']::membership_role[]));

create policy "product_categories: update for manager or above"
  on public.product_categories for update
  using (public.has_business_role(business_id, array['owner','admin','manager']::membership_role[]))
  with check (public.has_business_role(business_id, array['owner','admin','manager']::membership_role[]));

create policy "product_categories: delete for manager or above"
  on public.product_categories for delete
  using (public.has_business_role(business_id, array['owner','admin','manager']::membership_role[]));


-- ---- products ----
create policy "products: select for active members"
  on public.products for select
  using (public.is_business_member(business_id));

create policy "products: insert for manager or above"
  on public.products for insert
  with check (public.has_business_role(business_id, array['owner','admin','manager']::membership_role[]));

create policy "products: update for manager or above"
  on public.products for update
  using (public.has_business_role(business_id, array['owner','admin','manager']::membership_role[]))
  with check (public.has_business_role(business_id, array['owner','admin','manager']::membership_role[]));

create policy "products: delete for admin or above"
  on public.products for delete
  using (public.has_business_role(business_id, array['owner','admin']::membership_role[]));


-- ---- suppliers ----
create policy "suppliers: select for active members"
  on public.suppliers for select
  using (public.is_business_member(business_id));

create policy "suppliers: insert for inventory_clerk or above"
  on public.suppliers for insert
  with check (public.has_business_role(business_id,
    array['owner','admin','manager','inventory_clerk']::membership_role[]));

create policy "suppliers: update for manager or above"
  on public.suppliers for update
  using (public.has_business_role(business_id, array['owner','admin','manager']::membership_role[]))
  with check (public.has_business_role(business_id, array['owner','admin','manager']::membership_role[]));

create policy "suppliers: delete for admin or above"
  on public.suppliers for delete
  using (public.has_business_role(business_id, array['owner','admin']::membership_role[]));


-- ---- purchases ----
create policy "purchases: select for active members"
  on public.purchases for select
  using (public.is_business_member(business_id));

create policy "purchases: insert for inventory_clerk or above"
  on public.purchases for insert
  with check (public.has_business_role(business_id,
    array['owner','admin','manager','inventory_clerk']::membership_role[]));

create policy "purchases: update for manager or above"
  on public.purchases for update
  using (public.has_business_role(business_id, array['owner','admin','manager']::membership_role[]))
  with check (public.has_business_role(business_id, array['owner','admin','manager']::membership_role[]));

create policy "purchases: delete for admin or above"
  on public.purchases for delete
  using (public.has_business_role(business_id, array['owner','admin']::membership_role[]));


-- ---- purchase_items ----
-- Access derived from parent purchase's business membership
create policy "purchase_items: select via purchase"
  on public.purchase_items for select
  using (
    exists (
      select 1 from public.purchases pu
      where  pu.id = purchase_id
        and  public.is_business_member(pu.business_id)
    )
  );

create policy "purchase_items: insert via purchase"
  on public.purchase_items for insert
  with check (
    exists (
      select 1 from public.purchases pu
      where  pu.id = purchase_id
        and  public.has_business_role(pu.business_id,
               array['owner','admin','manager','inventory_clerk']::membership_role[])
    )
  );


-- ---- sales ----
-- Business members and the linked customer can read a sale.
create policy "sales: select for active members"
  on public.sales for select
  using (public.is_business_member(business_id));

create policy "sales: select own as customer"
  on public.sales for select
  using (auth.uid() = customer_user_id);

create policy "sales: insert for cashier or above"
  on public.sales for insert
  with check (public.has_business_role(business_id,
    array['owner','admin','manager','cashier']::membership_role[]));

create policy "sales: update for manager or above"
  on public.sales for update
  using (public.has_business_role(business_id, array['owner','admin','manager']::membership_role[]))
  with check (public.has_business_role(business_id, array['owner','admin','manager']::membership_role[]));


-- ---- sale_items ----
create policy "sale_items: select via sale"
  on public.sale_items for select
  using (
    exists (
      select 1 from public.sales s
      where  s.id = sale_id
        and  (
          public.is_business_member(s.business_id)
          or auth.uid() = s.customer_user_id
        )
    )
  );

create policy "sale_items: insert via sale"
  on public.sale_items for insert
  with check (
    exists (
      select 1 from public.sales s
      where  s.id = sale_id
        and  public.has_business_role(s.business_id,
               array['owner','admin','manager','cashier']::membership_role[])
    )
  );


-- ---- sale_payments ----
create policy "sale_payments: select via sale"
  on public.sale_payments for select
  using (
    exists (
      select 1 from public.sales s
      where  s.id = sale_id
        and  (
          public.is_business_member(s.business_id)
          or auth.uid() = s.customer_user_id
        )
    )
  );

create policy "sale_payments: insert via sale"
  on public.sale_payments for insert
  with check (
    exists (
      select 1 from public.sales s
      where  s.id = sale_id
        and  public.has_business_role(s.business_id,
               array['owner','admin','manager','cashier']::membership_role[])
    )
  );


-- ---- inventory_movements ----
-- Reads: any active member.
-- Direct writes: manager+ only (for manual adjustments).
-- purchase/sale movements go through the SECURITY DEFINER RPCs above,
-- which bypass this policy. This policy covers manual adjustment inserts
-- done directly (e.g. from an inventory adjustment UI action).
create policy "inventory_movements: select for active members"
  on public.inventory_movements for select
  using (public.is_business_member(business_id));

create policy "inventory_movements: insert for manager or above"
  on public.inventory_movements for insert
  with check (public.has_business_role(business_id,
    array['owner','admin','manager']::membership_role[]));

-- No update or delete policies — inventory movements are immutable.


-- ---- audit_logs ----
create policy "audit_logs: select for owner or admin"
  on public.audit_logs for select
  using (
    business_id is not null
    and public.has_business_role(business_id, array['owner','admin']::membership_role[])
  );

-- Inserts are service role only.


-- ---- conversations ----
create policy "conversations: select for member or customer"
  on public.conversations for select
  using (
    public.is_business_member(business_id)
    or auth.uid() = customer_user_id
  );

create policy "conversations: insert for member or customer"
  on public.conversations for insert
  with check (
    public.is_business_member(business_id)
    or auth.uid() = customer_user_id
  );

create policy "conversations: update for member"
  on public.conversations for update
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));


-- ---- conversation_messages ----
create policy "conversation_messages: select via conversation"
  on public.conversation_messages for select
  using (
    exists (
      select 1 from public.conversations c
      where  c.id = conversation_id
        and  (
          public.is_business_member(c.business_id)
          or auth.uid() = c.customer_user_id
        )
    )
  );

create policy "conversation_messages: insert via conversation"
  on public.conversation_messages for insert
  with check (
    exists (
      select 1 from public.conversations c
      where  c.id = conversation_id
        and  (
          public.is_business_member(c.business_id)
          or auth.uid() = c.customer_user_id
        )
    )
  );


-- ---- business_announcements ----
create policy "business_announcements: select for active members"
  on public.business_announcements for select
  using (public.is_business_member(business_id));

create policy "business_announcements: insert for admin or above"
  on public.business_announcements for insert
  with check (public.has_business_role(business_id, array['owner','admin']::membership_role[]));

create policy "business_announcements: update for admin or above"
  on public.business_announcements for update
  using (public.has_business_role(business_id, array['owner','admin']::membership_role[]))
  with check (public.has_business_role(business_id, array['owner','admin']::membership_role[]));

create policy "business_announcements: delete for admin or above"
  on public.business_announcements for delete
  using (public.has_business_role(business_id, array['owner','admin']::membership_role[]));


-- ============================================================
-- SECTION 12: GRANTS
-- ============================================================

grant usage on schema public to authenticated, anon;

-- Helper functions callable by authenticated users
grant execute on function public.is_business_member(uuid)
  to authenticated;
grant execute on function public.has_business_role(uuid, membership_role[])
  to authenticated;
grant execute on function public.business_subscription_active(uuid)
  to authenticated;

-- Atomic RPCs callable by authenticated users
-- (internal permission checks enforce membership + role + subscription)
grant execute on function public.create_purchase(uuid, uuid, uuid, date, text, uuid, jsonb)
  to authenticated;
grant execute on function public.create_sale(uuid, uuid, uuid, text, text, sale_channel, text, uuid, jsonb, jsonb)
  to authenticated;

-- Table grants (RLS enforces actual row visibility; grants enable schema access)
grant select, insert, update                    on public.users                  to authenticated;
grant select, insert, update                    on public.businesses             to authenticated;
grant select, insert, update, delete            on public.business_locations     to authenticated;
grant select, insert, update, delete            on public.business_memberships   to authenticated;
grant select, insert, update, delete            on public.business_invitations   to authenticated;
grant select                                    on public.subscription_plans     to authenticated, anon;
grant select                                    on public.business_subscriptions to authenticated;
grant select, insert, update, delete            on public.product_categories     to authenticated;
grant select, insert, update, delete            on public.products               to authenticated;
grant select, insert, update, delete            on public.suppliers              to authenticated;
grant select, insert, update, delete            on public.purchases              to authenticated;
grant select, insert, update                    on public.purchase_items         to authenticated;
grant select, insert, update                    on public.sales                  to authenticated;
grant select, insert                            on public.sale_items             to authenticated;
grant select, insert                            on public.sale_payments          to authenticated;
grant select, insert                            on public.inventory_movements    to authenticated;
grant select                                    on public.audit_logs             to authenticated;
grant select, insert, update                    on public.conversations          to authenticated;
grant select, insert                            on public.conversation_messages  to authenticated;
grant select, insert, update, delete            on public.business_announcements to authenticated;

-- View grant
grant select on public.product_stock to authenticated;


-- ============================================================
-- SECTION 13: SEED DATA
-- ============================================================

insert into public.subscription_plans
  (code, name, monthly_price, yearly_price, max_members, max_locations, features_json)
values
  (
    'free_trial',
    'Free Trial',
    null,
    null,
    3,
    1,
    '{
      "pos": true,
      "products": true,
      "purchases": true,
      "analytics": false,
      "staff": false,
      "multi_location": false
    }'::jsonb
  ),
  (
    'basic',
    'Basic',
    9.99,
    99.99,
    5,
    1,
    '{
      "pos": true,
      "products": true,
      "purchases": true,
      "analytics": true,
      "staff": true,
      "multi_location": false
    }'::jsonb
  ),
  (
    'pro',
    'Pro',
    29.99,
    299.99,
    null,
    null,
    '{
      "pos": true,
      "products": true,
      "purchases": true,
      "analytics": true,
      "staff": true,
      "multi_location": true,
      "api_access": true
    }'::jsonb
  );
