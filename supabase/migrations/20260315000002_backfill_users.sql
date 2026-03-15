-- Backfill existing auth users who predate the trigger
insert into public.users (id, email)
select id, email from auth.users
on conflict (id) do nothing;
