import { useState, useEffect } from 'react';
import DeliveryMap from './DeliveryMap';
import type { DeliveryOrder } from './hooks/useRealtimeDeliveryOrders'; // changed import

interface Props {
  order:          DeliveryOrder;
  tab:            'available' | 'active' | 'completed' | 'activity';
  actionLoading:  string | null;
  onAccept:       (id: string) => void;
  onDeliver:      (id: string) => void;
  deliveryGuyId?: string;
  isDriverActive?: boolean;
  driverLat?:     number | null;
  driverLng?:     number | null;
  driverSpeed?:   number | null;
}

export default function DeliveryOrderCard({
  order,
  tab,
  actionLoading,
  onAccept,
  onDeliver,
  deliveryGuyId,
  isDriverActive = false,
  driverLat,
  driverLng,
  driverSpeed,
}: Props) {
  const [showMap, setShowMap] = useState(false);

  useEffect(() => () => setShowMap(false), [order.id]);

  const isLoading   = actionLoading === order.id;
  const isCashOrder = order.payment_method === 'cash' && order.payment_status === 'pending';

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {isCashOrder && tab !== 'completed' && (
        <div className="bg-yellow-50 border-b border-yellow-100 px-4 py-2.5 flex items-center gap-2">
          <span className="text-base">💵</span>
          <p className="text-xs font-semibold text-yellow-800">
            Collect ₵{Number(order.total).toFixed(2)} cash on delivery
          </p>
        </div>
      )}

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-gray-900">#{order.order_number}</p>
            <p className="text-xs text-gray-500 mt-0.5">{order.customer_name}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <div className="flex items-start gap-2">
          <span className="text-base mt-0.5 shrink-0">📍</span>
          <p className="text-sm text-gray-700 leading-snug">{order.delivery_address}</p>
        </div>

        <a href={`tel:${order.customer_phone}`} className="flex items-center gap-2 text-sm text-orange-600 font-medium">
          <span>📞</span>
          <span>{order.customer_phone}</span>
        </a>

        <div className="bg-gray-50 rounded-lg px-3 py-2 space-y-1">
          {order.order_items.map((item, idx) => (
            <div key={`${order.id}-${idx}`} className="flex justify-between text-xs text-gray-600">
              <span>{item.quantity}× {item.product_name}</span>
              <span>₵{(item.product_price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          <span className="text-sm font-bold text-gray-900">₵{Number(order.total).toFixed(2)}</span>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
              {order.payment_method === 'mobile_money' ? '📱 MoMo'
                : order.payment_method === 'cash'      ? '💵 Cash'
                : order.payment_method === 'card'      ? '💳 Card'
                : order.payment_method}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              order.payment_status === 'paid'    ? 'bg-green-100 text-green-700'
              : order.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-700'
              : 'bg-red-100 text-red-700'
            }`}>
              {order.payment_status === 'paid' ? '✓ Paid'
                : order.payment_status === 'pending' ? 'Collect on delivery'
                : 'Payment failed'}
            </span>
          </div>
        </div>

        {order.estimated_delivery_time && (
          <p className="text-xs text-gray-400">
            Est. delivery:{' '}
            {new Date(order.estimated_delivery_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          {tab === 'active' && deliveryGuyId && isDriverActive && (
            <button
              onClick={() => setShowMap(v => !v)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all flex items-center justify-center gap-1.5 ${
                showMap
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-green-700 border-green-200 hover:border-green-400'
              }`}
            >
              {showMap ? '🗺️ Hide Map' : '🗺️ Show Location'}
            </button>
          )}

          {tab === 'active' && !isDriverActive && (
            <div className="flex-1 py-2 rounded-lg text-xs font-medium text-center bg-gray-50 text-gray-400 border border-gray-200">
              Go online to track location
            </div>
          )}

          {tab === 'available' && (
            <button
              onClick={() => onAccept(order.id)}
              disabled={isLoading}
              className="flex-1 py-2 bg-orange-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-orange-700 transition-colors"
            >
              {isLoading ? 'Accepting…' : 'Accept Order'}
            </button>
          )}

          {tab === 'active' && (
            <button
              onClick={() => onDeliver(order.id)}
              disabled={isLoading}
              className="flex-1 py-2 bg-green-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-green-700 transition-colors"
            >
              {isLoading ? 'Updating…' : '✓ Mark Delivered'}
            </button>
          )}

          {tab === 'completed' && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium text-center hover:bg-gray-200 transition-colors"
            >
              🗺️ View Address
            </a>
          )}
        </div>
      </div>

      {tab === 'active' && showMap && deliveryGuyId && (
        <div className="border-t border-gray-100">
          <DeliveryMap
            driverLat={driverLat}
            driverLng={driverLng}
            driverSpeed={driverSpeed}
            driverName="You"
            isOnline={isDriverActive}
            deliveryAddress={order.delivery_address}
            destinationLabel={order.customer_name}
            height="260px"
            className="rounded-none"
          />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:          'bg-gray-100 text-gray-600',
    confirmed:        'bg-blue-100 text-blue-700',
    preparing:        'bg-purple-100 text-purple-700',
    ready:            'bg-blue-100 text-blue-700',
    assigned:         'bg-indigo-100 text-indigo-700',
    out_for_delivery: 'bg-orange-100 text-orange-700',
    delivered:        'bg-green-100 text-green-700',
    cancelled:        'bg-red-100 text-red-700',
  };
  const labels: Record<string, string> = {
    pending:          'Pending',
    confirmed:        'Confirmed',
    preparing:        'Preparing',
    ready:            'Ready',
    assigned:         'Assigned',
    out_for_delivery: 'On the way',
    delivered:        'Delivered',
    cancelled:        'Cancelled',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[status] ?? status}
    </span>
  );
}