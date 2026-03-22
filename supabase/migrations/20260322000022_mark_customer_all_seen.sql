-- ============================================================
-- Atomic "mark all seen" for customers.
--
-- Combines two previously-separate operations into one function so they
-- share a single Postgres transaction: either both UPDATEs commit or
-- both roll back. Eliminates the partial-success window that existed
-- when the two statements were fired in parallel from the application layer.
--
-- Called by markAllCustomerNotificationsSeen() server action.
-- ============================================================

CREATE OR REPLACE FUNCTION public.mark_customer_all_seen(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.notifications
     SET read_at = now()
   WHERE user_id = p_user_id
     AND read_at IS NULL;

  UPDATE public.orders
     SET customer_seen_status = status
   WHERE customer_user_id = p_user_id
     AND customer_seen_status IS DISTINCT FROM status;
$$;

GRANT EXECUTE ON FUNCTION public.mark_customer_all_seen(uuid) TO authenticated;
