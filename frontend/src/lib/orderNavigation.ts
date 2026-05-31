export const ORDER_LIST_FILTERS = [
  'all',
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
] as const;

export type OrderListFilter = (typeof ORDER_LIST_FILTERS)[number];

const STATUS_FILTERS = new Set<string>(ORDER_LIST_FILTERS.filter((f) => f !== 'all'));

export function isOrderListFilter(value: string): value is OrderListFilter {
  return ORDER_LIST_FILTERS.includes(value as OrderListFilter);
}

/** Map notification payload / URL to the orders page filter tab. */
export function resolveOrderListFilter(opts: {
  status?: string | null;
  reviewId?: string | null;
  orderId?: string | null;
  orders?: { id: string; status: string }[];
}): OrderListFilter {
  if (opts.reviewId) return 'delivered';

  const liveStatus =
    opts.orderId && opts.orders?.length
      ? opts.orders.find((o) => o.id === opts.orderId)?.status
      : undefined;

  const status = liveStatus || opts.status;
  if (status && STATUS_FILTERS.has(status)) {
    return status as OrderListFilter;
  }

  return 'all';
}

/** Fallback for older notifications saved before `data.status` existed. */
export function inferStatusFromNotification(notification: {
  title?: string;
  message?: string;
  data?: { status?: string };
}): string | undefined {
  const explicit = notification.data?.status;
  if (explicit) return explicit;

  const text = `${notification.title || ''} ${notification.message || ''}`.toLowerCase();
  if (text.includes('delivered')) return 'delivered';
  if (text.includes('on the way') || text.includes('on its way')) return 'out_for_delivery';
  if (text.includes('ready for pickup') || text.includes('collect it from')) return 'ready';
  if (text.includes('ready for delivery') || text.includes('order ready')) return 'ready';
  if (text.includes('being prepared') || text.includes('preparing')) return 'preparing';
  if (text.includes('confirmed')) return 'confirmed';
  if (text.includes('cancelled')) return 'all';
  if (text.includes('rate your meal')) return 'delivered';

  return undefined;
}
