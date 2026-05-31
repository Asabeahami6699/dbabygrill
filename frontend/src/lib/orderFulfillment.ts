/** Whether the customer chose pickup instead of delivery. */
export function isPickupOrder(order: {
  pickup_branch_id?: string | null;
  delivery_address?: string | null;
  customer_address?: string | null;
}): boolean {
  if (order.pickup_branch_id) return true;
  const addr = (order.delivery_address || order.customer_address || '').trim().toLowerCase();
  return addr === 'pickup' || addr === 'pickup from store';
}
