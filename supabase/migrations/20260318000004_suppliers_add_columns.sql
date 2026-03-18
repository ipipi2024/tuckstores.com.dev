-- Add contact_name and address columns to suppliers table
alter table public.suppliers
  add column if not exists contact_name text,
  add column if not exists address      text;
