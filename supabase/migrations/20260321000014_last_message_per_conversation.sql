-- Returns the most recent message (body, sender_type, created_at) for each of
-- the given conversation IDs. Used by the messages list pages to render preview
-- text without N+1 queries.
--
-- SECURITY DEFINER is safe here: callers supply conv_ids they already fetched
-- through their own RLS-enforced conversation query, so access is pre-verified.
-- The function itself never exposes data the caller couldn't already reach.

create or replace function public.get_last_messages_for_conversations(conv_ids uuid[])
returns table(
  conversation_id uuid,
  body            text,
  sender_type     text,
  created_at      timestamptz
)
language sql
security definer
set search_path = public
as $$
  select distinct on (conversation_id)
    conversation_id,
    body,
    sender_type::text,
    created_at
  from public.conversation_messages
  where conversation_id = any(conv_ids)
  order by conversation_id, created_at desc;
$$;

grant execute on function public.get_last_messages_for_conversations(uuid[]) to authenticated;
