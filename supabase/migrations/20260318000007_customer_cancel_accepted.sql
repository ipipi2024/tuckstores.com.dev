drop policy if exists "orders: customer cancel pending" on public.orders;

create policy "orders: customer cancel pending or accepted"
  on public.orders
  for update
  using (
    customer_user_id = auth.uid()
    and status in ('pending', 'accepted')
  )
  with check (
    customer_user_id = auth.uid()
    and status = 'cancelled'
  );
