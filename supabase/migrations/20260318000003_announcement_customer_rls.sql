-- ============================================================
-- Allow authenticated (non-member) customers to read published,
-- non-expired announcements targeting customers or all audiences.
--
-- Application code is responsible for filtering further to only
-- announcements from businesses the user has a relationship with.
-- This policy simply unlocks the rows; it does not enforce relationship.
-- ============================================================

create policy "business_announcements: select published for authenticated"
  on public.business_announcements for select
  to authenticated
  using (
    audience_type in ('customers', 'all')
    and published_at is not null
    and published_at <= now()
    and (expires_at is null or expires_at > now())
  );
