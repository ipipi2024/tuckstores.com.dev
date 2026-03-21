-- Add city field to businesses for location-based discovery and filtering
alter table public.businesses
  add column if not exists city text;
