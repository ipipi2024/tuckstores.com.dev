-- ============================================================
-- Track which order status the customer has last seen
-- Badge shows count of orders where status != customer_seen_status
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN customer_seen_status public.order_status NOT NULL DEFAULT 'pending';

-- Backfill: mark all existing orders as seen so no spurious badges appear
UPDATE public.orders SET customer_seen_status = status;

-- Function: mark all of a customer's orders as seen (called when they visit /app/orders)
CREATE OR REPLACE FUNCTION public.mark_customer_orders_seen(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.orders
     SET customer_seen_status = status
   WHERE customer_user_id = p_user_id
     AND customer_seen_status IS DISTINCT FROM status;
$$;

-- Function: count orders with an unseen status change (used for nav badge)
CREATE OR REPLACE FUNCTION public.count_customer_unseen_orders(p_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.orders
  WHERE customer_user_id = p_user_id
    AND customer_seen_status IS DISTINCT FROM status;
$$;

GRANT EXECUTE ON FUNCTION public.mark_customer_orders_seen(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_customer_unseen_orders(uuid) TO authenticated;
