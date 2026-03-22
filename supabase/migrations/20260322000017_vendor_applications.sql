-- ============================================================
-- Vendor approval system
-- ============================================================

-- 1. Add vendor approval fields to public.users
alter table public.users
  add column if not exists is_vendor_approved boolean not null default false,
  add column if not exists store_limit        integer not null default 0;

-- 2. vendor_applications — one application per user
create table public.vendor_applications (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.users(id) on delete cascade,
  email       text        not null,
  name        text        not null,
  notes       text,
  status      text        not null default 'pending'
                check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (user_id)
);

create index idx_vendor_applications_status  on public.vendor_applications(status);
create index idx_vendor_applications_user_id on public.vendor_applications(user_id);

alter table public.vendor_applications enable row level security;

-- Users can read their own application
create policy "vendor_applications: select own"
  on public.vendor_applications for select
  using (auth.uid() = user_id);

-- Users can submit their own application (only if they don't already have one)
create policy "vendor_applications: insert own"
  on public.vendor_applications for insert
  with check (auth.uid() = user_id);

-- Service role (used by admin client) bypasses RLS automatically
