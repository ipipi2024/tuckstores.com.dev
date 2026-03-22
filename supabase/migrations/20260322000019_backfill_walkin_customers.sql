-- ============================================================
-- Backfill walk-in customers from historical sales
-- Date: 2026-03-22
--
-- Migration 20260322000018 added upsert_walkin_customer and
-- updated create_sale to call it going forward. But sales that
-- were recorded BEFORE that migration only have name/phone on
-- the sales row — they were never inserted into business_customers.
--
-- This migration replays those historical sales through
-- upsert_walkin_customer so they appear in the Customers page,
-- Analytics, and the POS "Find existing customer" dropdown.
--
-- Safe to run multiple times — upsert_walkin_customer deduplicates
-- by phone, so re-running will only update counters, not duplicate rows.
-- ============================================================

do $$
declare
  v_sale record;
begin
  for v_sale in
    select
      business_id,
      customer_name_snapshot,
      customer_phone_snapshot,
      coalesce(total_amount, 0) as total_amount
    from public.sales
    where status             = 'completed'
      and customer_user_id  is null
      and (
        (customer_name_snapshot  is not null and trim(customer_name_snapshot)  <> '')
        or
        (customer_phone_snapshot is not null and trim(customer_phone_snapshot) <> '')
      )
    order by created_at
  loop
    begin
      perform public.upsert_walkin_customer(
        v_sale.business_id,
        v_sale.customer_name_snapshot,
        v_sale.customer_phone_snapshot,
        1,
        v_sale.total_amount
      );
    exception when others then
      null; -- skip any individual failure, continue backfill
    end;
  end loop;
end;
$$;
