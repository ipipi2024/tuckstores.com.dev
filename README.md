# TuckStores

A multi-sided commerce platform for small stores. Businesses manage sales, inventory, staff, and customers. Customers browse stores, place orders, and track receipts. Built with Next.js, Supabase, and Tailwind CSS.

## Architecture Overview

The app has three distinct surfaces:

- **Business dashboard** (`/business/[slug]/`) — owner/staff tools for running the store
- **Customer app** (`/app/`) — customer-facing account, orders, receipts, and messages
- **Public discovery** (`/businesses/`) — publicly browsable store and product listings

## Features

### Business Dashboard

- **POS** — sell products in-person, search by name/SKU, link sales to registered customers, apply discounts, record payment method
- **Products** — create and manage product catalogue with categories, SKU, cost price, selling price, and product images
- **Inventory** — view stock levels, manually adjust quantities
- **Purchases** — record stock purchases from suppliers, track purchase history and spend
- **Suppliers** — manage supplier contacts
- **Orders** — manage online orders placed by customers (accept, mark out-for-delivery, complete, cancel)
- **Sales** — full history of completed sales (POS, manual, and online channels) with itemised receipts
- **Customers** — list of registered platform customers linked to this business, with spend and interaction history; per-customer detail page
- **Analytics** — revenue summaries (today, month, all-time), 30-day sales trend chart, top products, stock alerts, sales channel breakdown, customer insights (guest vs linked, repeat customers), top customers by spend, monthly purchase summary
- **Staff** — invite staff via shareable link, manage roles and remove members
- **Messages** — real-time messaging with individual customers
- **Announcements** — post announcements visible to customers
- **Billing** — view subscription status and expiry
- **Settings** — business name, slug, location (country + city), currency, and other configuration

### Customer App

- **Browse stores** — discover businesses by location, view their products and prices
- **Cart & checkout** — add items to cart, place delivery or pickup orders
- **Orders** — track order status in real time, cancel accepted orders
- **Receipts** — view all receipts from any business, with itemised details
- **Messages** — real-time messaging with businesses
- **Notifications** — in-app and web push notifications for order updates and messages
- **Profile** — manage account details, purchase stats

### Auth & Access

- Email/password signup with OTP email verification (resendable)
- Forgot password / reset password flow
- Role-based staff permissions (`owner`, `manager`, `staff`) enforced on both pages and server actions
- Subscription gating — all business dashboard pages and actions require an active subscription
- Admin email (set via `ADMIN_EMAIL` env var) bypasses subscription checks
- Multi-business support — users can own or be a member of multiple businesses, switch between them at `/business/select`

### Admin

- `/admin` — view all users, grant subscription days

## Tech Stack

- [Next.js](https://nextjs.org) (App Router, Server Actions)
- [Supabase](https://supabase.com) (Auth, PostgreSQL, RLS, Realtime)
- [Tailwind CSS v4](https://tailwindcss.com)
- Web Push API (push notifications via VAPID)

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
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...   # Web Push VAPID public key
VAPID_PRIVATE_KEY=...              # Web Push VAPID private key
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

- All business dashboard pages are protected by `app/business/[slug]/layout.tsx`
- All server actions are protected by `lib/require-subscription.ts`
- Admin email (set via `ADMIN_EMAIL`) bypasses subscription checks entirely
- Users with 7 or fewer days remaining see a warning banner
