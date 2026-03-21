-- Revise conversations_set_updated_at() to use a true row-difference approach.
--
-- Previous version (allowlist): skipped updated_at bump when status,
-- business_id, and customer_user_id were all unchanged. Fragile — any new
-- content column added later would silently bypass updated_at.
--
-- New version: compares the full row EXCLUDING the three managed/excluded fields
-- (updated_at, customer_last_read_at, business_last_read_at). If the rest of
-- the row is identical, the update is a pure read-tracking write → skip.
-- Any other column change causes the comparison to differ → bump updated_at.
--
-- Full conversations column inventory:
--   id, business_id, customer_user_id, status, created_at  ← compared
--   updated_at                                              ← excluded (managed)
--   customer_last_read_at, business_last_read_at            ← excluded (read-tracking)
--
-- on_message_inserted compatibility:
--   That trigger does: UPDATE conversations SET updated_at = now()
--   Only updated_at changes → compared columns are equal → RETURN NEW early.
--   But NEW.updated_at is already now() from the UPDATE SET clause, so the
--   correct timestamp still gets written to the table. ✓

create or replace function public.conversations_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  -- If every column except updated_at and the read-tracking fields is
  -- unchanged, this is a pure read-tracking write. Leave updated_at alone.
  if row(new.id, new.business_id, new.customer_user_id, new.status, new.created_at)
       is not distinct from
     row(old.id, old.business_id, old.customer_user_id, old.status, old.created_at)
  then
    return new;
  end if;

  new.updated_at = now();
  return new;
end;
$$;
