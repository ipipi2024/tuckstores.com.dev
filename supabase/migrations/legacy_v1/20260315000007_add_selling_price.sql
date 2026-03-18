-- Add selling_price to products for POS use
alter table public.products
  add column selling_price numeric(10, 2) default null;
