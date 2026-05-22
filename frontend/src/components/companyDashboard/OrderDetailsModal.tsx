import React, { useState, useEffect } from 'react';
import { Order } from './hooks/useCompanyData';
import { getValidToken } from '../../api/authToken';
import { toast } from 'react-hot-toast';
import { api } from '../../services/apiClient';

interface OrderDetailsModalProps {
  isOpen: boolean;
  order: Order | null;
  onClose: () => void;
  onUpdateStatus: () => void;
}

interface DeliveryGuy {
  id: string;
  full_name: string;
}

export default function OrderDetailsModal({
  isOpen,
  order,
  onClose,
  onUpdateStatus,
}: OrderDetailsModalProps) {
  const [updating, setUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<Order['status'] | null>(null);

  // ── Delivery guy assignment state ──
  const [deliveryGuys, setDeliveryGuys] = useState<DeliveryGuy[]>([]);
  const [selectedGuyId, setSelectedGuyId] = useState<string>('');
  const [loadingGuys, setLoadingGuys] = useState(false);

  // "Ready" is a two-step action: first the user clicks Ready (pendingReady = true),
  // picks a delivery guy, then confirms. All other statuses update immediately.
  const [pendingReady, setPendingReady] = useState(false);

  // Reset local state whenever the modal opens for a (possibly different) order
  useEffect(() => {
    if (isOpen && order) {
      fetchDeliveryGuys();
      setSelectedGuyId(order.delivery_guy_id || '');
      setPendingReady(false);
      setSelectedStatus(null);
    }
  }, [isOpen, order]);

  const fetchDeliveryGuys = async () => {
    setLoadingGuys(true);
    try {
      const token = await getValidToken();
      if (!token) return;
      const response = await api.get('/company/delivery-guys', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const guys = (response.data || []).filter((g: any) => g.is_active);
      setDeliveryGuys(guys);
    } catch (error) {
      console.error('Failed to fetch delivery guys:', error);
    } finally {
      setLoadingGuys(false);
    }
  };

  const handleUpdateStatus = async (status: Order['status']) => {
    if (!order) return;

    // "Ready" is special — show the delivery guy picker first, confirm second
    if (status === 'ready' && !pendingReady) {
      setPendingReady(true);
      return;
    }

    setUpdating(true);
    setSelectedStatus(status);

    try {
      const token = await getValidToken();
      if (!token) {
        toast.error('Not authenticated. Please sign in again.');
        return;
      }

      const payload: any = { status };
      if (status === 'ready') {
        payload.delivery_guy_id = selectedGuyId || null;
      }

      await api.patch(`/company/orders/${order.id}/status`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success(`Order status updated to ${status.replace(/_/g, ' ')}`);
      onUpdateStatus();
      onClose();
    } catch (error: any) {
      console.error('Error updating order status:', error);
      toast.error(
        error.response?.data?.error ||
          error.message ||
          'Failed to update order status'
      );
    } finally {
      setUpdating(false);
      setSelectedStatus(null);
      setPendingReady(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':          return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':        return 'bg-blue-100 text-blue-800';
      case 'preparing':        return 'bg-orange-100 text-orange-800';
      case 'ready':            return 'bg-purple-100 text-purple-800';
      case 'out_for_delivery': return 'bg-indigo-100 text-indigo-800'; // ✅ NEW
      case 'delivered':        return 'bg-green-100 text-green-800';
      case 'cancelled':        return 'bg-red-100 text-red-800';
      default:                 return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'out_for_delivery': return 'Out for Delivery'; // ✅ NEW
      default: return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
    }
  };

  // ✅ UPDATED: includes out_for_delivery in the flow
  const canReachStatus = (currentStatus: string, targetStatus: string): boolean => {
    if (currentStatus === targetStatus) return true;
    if (targetStatus === 'cancelled') {
      return ['pending', 'confirmed', 'preparing'].includes(currentStatus);
    }
    // out_for_delivery is set by delivery guys — admin cannot manually set it
    if (targetStatus === 'out_for_delivery') return false;

    const orderedStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];
    const currentIdx = orderedStatuses.indexOf(currentStatus);
    const targetIdx = orderedStatuses.indexOf(targetStatus);
    if (currentIdx === -1 || targetIdx === -1) return false;
    return targetIdx > currentIdx;
  };

  if (!isOpen || !order) return null;

  // ✅ All statuses including out_for_delivery shown in the modal
  const allStatuses: Order['status'][] = [
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'out_for_delivery',
    'delivered',
    'cancelled',
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-4 sm:p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">

        {/* ── Header ── */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg sm:text-xl font-bold">Order Details</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <div className="space-y-4">
          {/* ── Order Number ── */}
          <div>
            <p className="text-xs text-gray-500">Order Number</p>
            <p className="font-mono text-sm font-semibold">
              {order.order_number || order.id.slice(0, 8)}
            </p>
          </div>

          {/* ── Customer Info ── */}
          <div>
            <p className="text-xs text-gray-500">Customer</p>
            <p className="font-medium">{order.customer_name}</p>
            <p className="text-sm text-gray-600">{order.customer_phone}</p>
            <p className="text-sm text-gray-600">{order.customer_address}</p>
          </div>

          {/* ── Additional Notes ── */}
          {order.special_instructions && (
            <div className="rounded-lg border border-orange-100 bg-orange-50 p-3">
              <p className="text-xs font-semibold text-orange-700 mb-1">Additional Notes</p>
              <p className="text-sm text-orange-800 whitespace-pre-wrap">{order.special_instructions}</p>
            </div>
          )}

          {/* ── Out for Delivery Banner ── */}
          {order.status === 'out_for_delivery' && (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
              </svg>
              <p className="text-sm text-indigo-700 font-medium">
                🛵 This order is currently out for delivery.
              </p>
            </div>
          )}

          {/* ── Order Items ── */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Items</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {order.order_items?.map((item) => (
                <div key={item.id} className="flex justify-between gap-3 text-sm border-b border-gray-100 pb-2">
                  <div className="flex items-start gap-2 flex-1">
                    <div className="h-10 w-10 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.product_name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[10px] text-gray-400">N/A</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <span className="font-medium">{item.quantity}x </span>
                      <span className="text-gray-700">{item.product_name}</span>
                      {item.special_instructions && (
                        <p className="text-xs text-orange-600 mt-1">Item note: {item.special_instructions}</p>
                      )}
                    </div>
                  </div>
                  <span className="font-medium ml-4">₵{(item.product_price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Totals ── */}
          <div className="border-t pt-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span>
                ₵{order.subtotal?.toFixed(2) || (order.total_amount - order.delivery_fee).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm mt-1">
              <span className="text-gray-600">Delivery Fee</span>
              <span>₵{order.delivery_fee?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between items-center font-bold mt-2 pt-2 border-t">
              <span>Total</span>
              <span className="text-orange-600 text-lg">₵{order.total_amount.toFixed(2)}</span>
            </div>
          </div>

          {/* ── Payment Method ── */}
          <div>
            <p className="text-xs text-gray-500 mb-1">Payment Method</p>
            <p className="text-sm capitalize">
              {order.payment_method?.replace('_', ' ') || 'Cash on Delivery'}
            </p>
          </div>

          {/* ══ ASSIGN DELIVERY GUY ══
               Shows when:
               (a) user clicked Ready and is confirming (pendingReady), OR
               (b) order is already in ready state (allowing reassignment)
          */}
          {(pendingReady || order.status === 'ready') && (
            <div className="rounded-lg border border-purple-100 bg-purple-50 p-3">
              <label className="text-xs font-semibold text-purple-700 mb-2 block">
                Assign Delivery Guy (optional)
              </label>
              {loadingGuys ? (
                <div className="animate-pulse h-9 bg-purple-200 rounded-lg" />
              ) : deliveryGuys.length > 0 ? (
                <select
                  value={selectedGuyId}
                  onChange={(e) => setSelectedGuyId(e.target.value)}
                  className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                >
                  <option value="">Unassigned — any delivery guy can accept</option>
                  {deliveryGuys.map((guy) => (
                    <option key={guy.id} value={guy.id}>
                      {guy.full_name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-amber-600">No active delivery guys available.</p>
              )}

              {/* Confirm / Cancel buttons — only shown when in pendingReady state */}
              {pendingReady && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleUpdateStatus('ready')}
                    disabled={updating}
                    className="flex-1 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {updating ? (
                      <span className="flex items-center justify-center gap-1">
                        <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                        Confirming...
                      </span>
                    ) : (
                      'Confirm — Mark as Ready'
                    )}
                  </button>
                  <button
                    onClick={() => setPendingReady(false)}
                    disabled={updating}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Status Update Buttons ── */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Update Status</p>
            <div className="flex flex-wrap gap-2">
              {allStatuses.map((status) => {
                const isCurrent = order.status === status;
                const isReachable = canReachStatus(order.status, status);
                const isReadyPending = status === 'ready' && pendingReady;
                // out_for_delivery is set by delivery guys only — show as read-only badge
                const isDeliveryGuyOnly = status === 'out_for_delivery';

                return (
                  <button
                    key={status}
                    onClick={() => !isDeliveryGuyOnly && handleUpdateStatus(status)}
                    disabled={updating || !isReachable || isReadyPending || isDeliveryGuyOnly}
                    title={isDeliveryGuyOnly ? 'Set automatically when delivery guy accepts the order' : undefined}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                      isCurrent
                        ? getStatusColor(status) + ' cursor-default ring-2 ring-offset-1 ring-orange-500'
                        : isReadyPending
                        ? 'bg-purple-100 text-purple-700 cursor-default ring-2 ring-offset-1 ring-purple-400'
                        : isDeliveryGuyOnly
                        ? 'bg-indigo-50 text-indigo-400 cursor-not-allowed border border-indigo-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {updating && selectedStatus === status ? (
                      <span className="flex items-center gap-1">
                        <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                        Updating...
                      </span>
                    ) : (
                      getStatusLabel(status)
                    )}
                  </button>
                );
              })}
            </div>
            {pendingReady && (
              <p className="text-xs text-purple-600 mt-2">
                ↑ Choose a delivery guy above, then confirm to mark as ready.
              </p>
            )}
            <p className="text-xs text-gray-400 mt-2">
              * "Out for Delivery" is set automatically when a delivery guy accepts the order.
            </p>
          </div>

          {/* ── Order Timeline ── */}
          {order.created_at && (
            <div className="border-t pt-3">
              <p className="text-xs text-gray-500 mb-2">Order Timeline</p>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Order Placed:</span>
                <span>{new Date(order.created_at).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}