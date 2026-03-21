-- ============================================================
-- Fix: unread badge never clears for customers.
--
-- Root cause: the generic set_updated_at() trigger fires on
-- every UPDATE to conversations — including the mark-as-read
-- write (customer_last_read_at). Because updated_at is set to
-- Postgres now() inside the trigger, and customer_last_read_at
-- is set from JS time (captured before the round-trip), the DB
-- timestamp always lands slightly ahead:
--
--   updated_at (DB now)  >  customer_last_read_at (JS time)
--   → badge logic sees "unread" immediately after marking read
--
-- Fix: replace the generic trigger on conversations with a
-- smarter function that skips updated_at when only read-tracking
-- columns (customer_last_read_at, business_last_read_at) changed.
-- All real content changes (status, participants) still bump it.
-- ============================================================

create or replace function public.conversations_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  -- If none of the meaningful content columns changed, this is a
  -- read-tracking-only update. Skip bumping updated_at so the badge
  -- logic (updated_at > customer_last_read_at) clears correctly.
  if (
    new.status           is not distinct from old.status           and
    new.business_id      is not distinct from old.business_id      and
    new.customer_user_id is not distinct from old.customer_user_id
  ) then
    return new;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

-- Swap the generic trigger for the conversation-specific one.
-- All other tables keep using set_updated_at() unchanged.
drop trigger if exists conversations_updated_at on public.conversations;

create trigger conversations_updated_at
  before update on public.conversations
  for each row execute function public.conversations_set_updated_at();
