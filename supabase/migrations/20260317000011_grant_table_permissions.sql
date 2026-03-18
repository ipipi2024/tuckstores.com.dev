-- Grant permissions to authenticated role for all tables
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.users to authenticated;
grant select, insert, update on public.subscriptions to authenticated;
grant select, insert, update, delete on public.purchases to authenticated;
grant select, insert, update, delete on public.purchase_items to authenticated;
grant select, insert, update, delete on public.sales to authenticated;
grant select, insert, update, delete on public.sale_items to authenticated;
grant select, insert, update, delete on public.suppliers to authenticated;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.product_categories to authenticated;

-- Grant anon read on subscriptions so middleware can check it
grant select on public.subscriptions to anon;
