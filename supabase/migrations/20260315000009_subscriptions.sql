-- Subscriptions table: one row per user, tracks monthly access
create table public.subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  granted_at timestamptz not null default now(),
  notes      text,
  unique(user_id)
);

alter table public.subscriptions enable row level security;

-- Users can read their own subscription
create policy "subscriptions: select own"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);

-- Give all existing users a 30-day grace period
insert into public.subscriptions (user_id, expires_at)
select id, now() + interval '30 days'
from public.users
on conflict (user_id) do nothing;
