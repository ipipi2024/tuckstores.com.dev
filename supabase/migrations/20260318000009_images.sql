-- ─────────────────────────────────────────────────────────────────────────────
-- 20260318000009_images.sql
-- Adds image support: user avatars, business branding, product images
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Users: avatar ─────────────────────────────────────────────────────────────
alter table public.users
  add column if not exists avatar_url  text,
  add column if not exists avatar_path text;

-- ── Businesses: logo, cover photo, catchline ──────────────────────────────────
-- logo_url / cover_image_url already exist in schema; add path cols + catchline
alter table public.businesses
  add column if not exists catchline        text,
  add column if not exists logo_path        text,
  add column if not exists cover_image_path text;

-- ── Product images ────────────────────────────────────────────────────────────
create table if not exists public.product_images (
  id           uuid        primary key default gen_random_uuid(),
  product_id   uuid        not null references public.products(id) on delete cascade,
  storage_path text        not null,
  url          text        not null,
  position     smallint    not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists idx_product_images_product_id
  on public.product_images (product_id);

alter table public.product_images enable row level security;

-- Public read (product images are public)
create policy "product_images_public_read"
  on public.product_images for select
  using (true);

-- Active members of the product's business can insert
create policy "product_images_member_insert"
  on public.product_images for insert
  with check (
    exists (
      select 1
      from   public.products p
      join   public.business_memberships bm on bm.business_id = p.business_id
      where  p.id        = product_images.product_id
        and  bm.user_id  = auth.uid()
        and  bm.status   = 'active'
    )
  );

-- Active members can update (for reordering)
create policy "product_images_member_update"
  on public.product_images for update
  using (
    exists (
      select 1
      from   public.products p
      join   public.business_memberships bm on bm.business_id = p.business_id
      where  p.id        = product_images.product_id
        and  bm.user_id  = auth.uid()
        and  bm.status   = 'active'
    )
  );

-- Active members can delete
create policy "product_images_member_delete"
  on public.product_images for delete
  using (
    exists (
      select 1
      from   public.products p
      join   public.business_memberships bm on bm.business_id = p.business_id
      where  p.id        = product_images.product_id
        and  bm.user_id  = auth.uid()
        and  bm.status   = 'active'
    )
  );

-- ── Storage bucket policies ───────────────────────────────────────────────────
-- These are idempotent (drop + recreate). Assumes the three public buckets
-- user-assets, business-assets, and product-images already exist.

-- ── user-assets ───────────────────────────────────────────────────────────────
drop policy if exists "user_assets_public_read"   on storage.objects;
drop policy if exists "user_assets_auth_write"    on storage.objects;
drop policy if exists "user_assets_auth_update"   on storage.objects;
drop policy if exists "user_assets_auth_delete"   on storage.objects;

create policy "user_assets_public_read"
  on storage.objects for select
  using (bucket_id = 'user-assets');

-- Users may only write inside users/{their-own-id}/
create policy "user_assets_auth_write"
  on storage.objects for insert
  with check (
    bucket_id = 'user-assets'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "user_assets_auth_update"
  on storage.objects for update
  using (
    bucket_id = 'user-assets'
    and auth.uid() is not null
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "user_assets_auth_delete"
  on storage.objects for delete
  using (
    bucket_id = 'user-assets'
    and auth.uid() is not null
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ── business-assets ───────────────────────────────────────────────────────────
drop policy if exists "business_assets_public_read"    on storage.objects;
drop policy if exists "business_assets_member_write"   on storage.objects;
drop policy if exists "business_assets_member_update"  on storage.objects;
drop policy if exists "business_assets_member_delete"  on storage.objects;

create policy "business_assets_public_read"
  on storage.objects for select
  using (bucket_id = 'business-assets');

-- Active members may write inside businesses/{business-id}/
create policy "business_assets_member_write"
  on storage.objects for insert
  with check (
    bucket_id = 'business-assets'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = 'businesses'
    and exists (
      select 1 from public.business_memberships bm
      where  bm.business_id = ((storage.foldername(name))[2])::uuid
        and  bm.user_id     = auth.uid()
        and  bm.status      = 'active'
    )
  );

create policy "business_assets_member_update"
  on storage.objects for update
  using (
    bucket_id = 'business-assets'
    and auth.uid() is not null
    and exists (
      select 1 from public.business_memberships bm
      where  bm.business_id = ((storage.foldername(name))[2])::uuid
        and  bm.user_id     = auth.uid()
        and  bm.status      = 'active'
    )
  );

create policy "business_assets_member_delete"
  on storage.objects for delete
  using (
    bucket_id = 'business-assets'
    and auth.uid() is not null
    and exists (
      select 1 from public.business_memberships bm
      where  bm.business_id = ((storage.foldername(name))[2])::uuid
        and  bm.user_id     = auth.uid()
        and  bm.status      = 'active'
    )
  );

-- ── product-images ────────────────────────────────────────────────────────────
drop policy if exists "product_images_bucket_public_read"    on storage.objects;
drop policy if exists "product_images_bucket_member_write"   on storage.objects;
drop policy if exists "product_images_bucket_member_delete"  on storage.objects;

create policy "product_images_bucket_public_read"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Active members of the product's business may write inside products/{product-id}/
create policy "product_images_bucket_member_write"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = 'products'
    and exists (
      select 1
      from   public.products p
      join   public.business_memberships bm on bm.business_id = p.business_id
      where  p.id        = ((storage.foldername(name))[2])::uuid
        and  bm.user_id  = auth.uid()
        and  bm.status   = 'active'
    )
  );

create policy "product_images_bucket_member_delete"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and auth.uid() is not null
    and exists (
      select 1
      from   public.products p
      join   public.business_memberships bm on bm.business_id = p.business_id
      where  p.id        = ((storage.foldername(name))[2])::uuid
        and  bm.user_id  = auth.uid()
        and  bm.status   = 'active'
    )
  );
