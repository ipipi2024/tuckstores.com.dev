# TuckStores

A point-of-sale and inventory management web app for small stores. Built with Next.js, Supabase, and Tailwind CSS.

## Features

- **POS / Sales** — sell products, track stock, link sales to customers
- **Purchases** — record stock purchases from suppliers
- **Inventory** — view current stock levels
- **Products** — manage product catalogue with categories and selling prices
- **Customers & Suppliers** — manage contacts
- **Analytics** — sales and pricing reports
- **Subscriptions** — monthly access control managed by the admin
- **Email verification** — OTP code sent on signup, resendable if expired

## Tech Stack

- [Next.js 16](https://nextjs.org) (App Router, Server Actions)
- [Supabase](https://supabase.com) (Auth, PostgreSQL, RLS)
- [Tailwind CSS v4](https://tailwindcss.com)

## Getting Started

### 1. Clone and install

```bash
npm install
```

### 2. Set up environment variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
SUPABASE_SECRET_KEY=eyJ...   # service_role JWT from Supabase dashboard → Project Settings → API
ADMIN_EMAIL=your@email.com
```

> **Important:** `SUPABASE_SECRET_KEY` must be the `service_role` JWT (starts with `eyJ`), not the `sb_secret_` format key.

### 3. Apply database migrations

Run each file in `supabase/migrations/` in order against your Supabase project using the SQL Editor, or via the Supabase CLI:

```bash
supabase db push
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database Notes

### Table permissions

Tables are created via SQL migrations which do **not** auto-grant permissions (unlike the Supabase dashboard UI). The migration `20260317000011_grant_table_permissions.sql` handles all required grants. If you add a new table via migration, remember to add:

```sql
grant select, insert, update, delete on public.your_table to authenticated;
```

### Admin RLS policies

The admin page (`/admin`) uses the regular authenticated Supabase client. Two RLS policies allow the admin email to read all users and manage all subscriptions:

```sql
-- Run once, replacing the email with your ADMIN_EMAIL
create policy "users: admin select all"
  on public.users for select
  using (auth.email() = 'your@email.com');

create policy "subscriptions: admin all"
  on public.subscriptions for all
  using (auth.email() = 'your@email.com')
  with check (auth.email() = 'your@email.com');
```

## Admin Workflow

1. User signs up → verifies email via OTP code → lands on `/subscribe`
2. Go to `/admin` → find the user → click **+30 days** to grant access
3. User can now access the full dashboard

## Subscription Logic

- All dashboard pages are protected by `app/dashboard/layout.tsx`
- All server actions are protected by `lib/require-subscription.ts`
- Admin email (set via `ADMIN_EMAIL`) bypasses subscription checks entirely
- Users with 7 or fewer days remaining see a warning banner
