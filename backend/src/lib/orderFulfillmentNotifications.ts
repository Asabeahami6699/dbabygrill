import { formatPickupLocationLine, resolvePickupBranch } from './pickupBranch';

export type CustomerStatusNotification = {
  title: string;
  message: string;
  type: 'order' | 'payment';
};

export function isPickupOrder(order: {
  pickup_branch_id?: string | null;
  delivery_address?: string | null;
}): boolean {
  if (order.pickup_branch_id) return true;
  const addr = (order.delivery_address || '').trim().toLowerCase();
  return addr === 'pickup' || addr === 'pickup from store';
}

/** Resolve pickup location label for customer-facing copy. */
export async function pickupLocationForOrder(
  companyId: string,
  order: {
    pickup_branch_id?: string | null;
    delivery_address?: string | null;
  }
): Promise<string> {
  if (order.pickup_branch_id) {
    const branch = await resolvePickupBranch(companyId, order.pickup_branch_id);
    if (branch) return formatPickupLocationLine(branch);
  }
  const addr = (order.delivery_address || '').trim();
  if (addr && addr.toLowerCase() !== 'pickup') return addr;
  return 'your selected pickup branch';
}

export function customerStatusNotification(
  status: string,
  orderNumber: string,
  opts: { isPickup: boolean; pickupLocation?: string; total?: number }
): CustomerStatusNotification | null {
  const { isPickup, pickupLocation = 'your selected pickup branch', total = 0 } = opts;

  switch (status) {
    case 'confirmed':
      return {
        title: 'Order Confirmed ✅',
        message: isPickup
          ? `Your pickup order #${orderNumber} has been confirmed and is being prepared.`
          : `Your order #${orderNumber} has been confirmed and is being prepared.`,
        type: 'order',
      };
    case 'preparing':
      return {
        title: 'Order Being Prepared 🍳',
        message: isPickup
          ? `Your pickup order #${orderNumber} is now being prepared.`
          : `Great news! Your order #${orderNumber} is now being prepared by the chef.`,
        type: 'order',
      };
    case 'ready':
      return isPickup
        ? {
            title: 'Order Ready for Pickup 🏪',
            message: `Your order #${orderNumber} is ready! Please collect it from ${pickupLocation}.`,
            type: 'order',
          }
        : {
            title: 'Order Ready for Delivery 🛵',
            message: `Your order #${orderNumber} is ready! A delivery partner will pick it up shortly.`,
            type: 'order',
          };
    case 'delivered':
      return isPickup
        ? {
            title: 'Order Collected! 🎉',
            message: `Your order #${orderNumber} has been collected. Enjoy your meal!`,
            type: 'order',
          }
        : {
            title: 'Order Delivered! 🎉',
            message: `Your order #${orderNumber} has been delivered. Enjoy your meal!`,
            type: 'order',
          };
    case 'cancelled':
      return {
        title: 'Order Cancelled ❌',
        message: `Your order #${orderNumber} has been cancelled.`,
        type: 'order',
      };
    default:
      return null;
  }
}

export function paymentProcessedNotification(
  orderNumber: string,
  total: number,
  isPickup: boolean
): CustomerStatusNotification {
  return {
    title: 'Payment Processed 💰',
    message: isPickup
      ? `Your payment of ₵${total.toFixed(2)} for pickup order #${orderNumber} has been processed successfully.`
      : `Your payment of ₵${total.toFixed(2)} for order #${orderNumber} has been processed successfully.`,
    type: 'payment',
  };
}
