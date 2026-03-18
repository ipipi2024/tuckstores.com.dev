-- Track when a customer last read a conversation for unread badge counting
alter table public.conversations
  add column customer_last_read_at timestamptz;

-- Enable Realtime on conversation_messages so the browser can subscribe
alter publication supabase_realtime add table public.conversation_messages;
