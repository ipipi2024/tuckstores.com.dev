-- Create users table linked to auth.users
create table public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'owner',
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.users enable row level security;

-- Users can read their own row
create policy "users: select own"
  on public.users
  for select
  using (auth.uid() = id);

-- Users can update their own row
create policy "users: update own"
  on public.users
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Trigger function to auto-populate on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

-- Attach trigger to auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
