-- ============================================================
-- Public discovery: safe read access for unauthenticated browsers.
--
-- These policies are additive — they OR with existing member policies.
-- Business members retain all existing access.
-- Application code is responsible for selecting only public-safe
-- columns (documented below for each table).
-- ============================================================


-- ---- businesses ----
-- Public fields: id, name, slug, description, phone, email,
--   logo_url, currency_code, country_code, timezone.
-- Private fields (never selected in discovery queries):
--   status, created_at, updated_at, cover_image_url.
create policy "businesses: select public active"
  on public.businesses for select
  to anon, authenticated
  using (status = 'active');


-- ---- products ----
-- Public fields: id, business_id, category_id, name, description,
--   sku, selling_price, is_active.
-- Private fields (never selected in discovery queries):
--   cost_price_default, barcode.
create policy "products: select public active"
  on public.products for select
  to anon, authenticated
  using (is_active = true);


-- ---- product_categories ----
-- Category names and descriptions are not sensitive.
-- Public fields: id, business_id, name.
create policy "product_categories: select public"
  on public.product_categories for select
  to anon, authenticated
  using (true);


-- ---- business_locations ----
-- Only city/state summary is considered public.
-- Private fields (never selected in discovery queries):
--   address_line_1, address_line_2, postal_code, latitude, longitude.
create policy "business_locations: select public"
  on public.business_locations for select
  to anon, authenticated
  using (true);
