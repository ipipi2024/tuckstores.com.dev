-- ============================================================
-- Bump conversation.updated_at whenever a message is inserted.
--
-- Uses SECURITY DEFINER so the update succeeds regardless of the
-- inserting user's role. Customers cannot update conversations
-- via RLS ("update for member" policy), but the updated_at
-- timestamp must stay current for conversation-list ordering to
-- work correctly for both sides.
-- ============================================================

create or replace function public.update_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger on_message_inserted
  after insert on public.conversation_messages
  for each row execute function public.update_conversation_on_message();
