-- ─────────────────────────────────────────────
-- product_categories
-- ─────────────────────────────────────────────
create table public.product_categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.product_categories enable row level security;

create policy "product_categories: select own"
  on public.product_categories for select
  using (auth.uid() = user_id);

create policy "product_categories: insert own"
  on public.product_categories for insert
  with check (auth.uid() = user_id);

create policy "product_categories: update own"
  on public.product_categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "product_categories: delete own"
  on public.product_categories for delete
  using (auth.uid() = user_id);


-- ─────────────────────────────────────────────
-- add optional category_id to products
-- ─────────────────────────────────────────────
alter table public.products
  add column category_id uuid references public.product_categories(id) on delete set null;
