-- Create products table
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

-- Enable RLS
alter table public.products enable row level security;

-- Users can read their own products
create policy "products: select own"
  on public.products
  for select
  using (auth.uid() = user_id);

-- Users can insert their own products
create policy "products: insert own"
  on public.products
  for insert
  with check (auth.uid() = user_id);

-- Users can update their own products
create policy "products: update own"
  on public.products
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own products
create policy "products: delete own"
  on public.products
  for delete
  using (auth.uid() = user_id);
