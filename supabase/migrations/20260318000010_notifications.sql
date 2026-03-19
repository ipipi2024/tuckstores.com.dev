-- ── Notifications ────────────────────────────────────────────────────────────
-- Source-of-truth for all in-app and push notifications.
-- INSERT is reserved for trusted server code (admin client).
-- Users may only SELECT their own rows and UPDATE read_at.

create type public.notification_type as enum (
  'new_message',
  'order_placed',
  'order_status_changed'
);

create table public.notifications (
  id         uuid                      primary key default gen_random_uuid(),
  user_id    uuid                      not null references public.users(id) on delete cascade,
  type       public.notification_type  not null,
  title      text                      not null,
  body       text                      not null,
  data       jsonb                     not null default '{}',
  read_at    timestamptz,
  created_at timestamptz               not null default now()
);

create index idx_notifications_user_id_created
  on public.notifications(user_id, created_at desc);


-- ── Push subscriptions ────────────────────────────────────────────────────────
-- One row per browser/device per user. Endpoint is globally unique.
-- Managed by the user via the API routes — no admin-only restriction.

create table public.push_subscriptions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.users(id) on delete cascade,
  endpoint   text        not null unique,
  p256dh     text        not null,
  auth       text        not null,
  created_at timestamptz not null default now()
);

create index idx_push_subscriptions_user_id
  on public.push_subscriptions(user_id);


-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.notifications      enable row level security;
alter table public.push_subscriptions enable row level security;

-- notifications: no client INSERT policy — only admin client writes these
create policy "notifications: select own"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "notifications: update own"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- push_subscriptions: users fully manage their own rows
create policy "push_subscriptions: select own"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "push_subscriptions: insert own"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "push_subscriptions: delete own"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);


-- ── Grants ────────────────────────────────────────────────────────────────────

grant select, update           on public.notifications      to authenticated;
grant select, insert, delete   on public.push_subscriptions to authenticated;


-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Enables live delivery of notifications to connected clients.

alter publication supabase_realtime add table public.notifications;
