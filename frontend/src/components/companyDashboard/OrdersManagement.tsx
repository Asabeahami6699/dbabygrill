import React, { useState } from 'react';
import { Order } from './hooks/useCompanyData';
import { getValidToken } from '../../api/authToken';
import { toast } from 'react-hot-toast';
import { api } from '../../services/apiClient';

interface OrdersManagementProps {
  orders: Order[];
  onUpdateStatus: () => void;
  onViewDetails: (order: Order) => void;
}

type DateRangePreset = 'all' | 'today' | 'week' | 'month' | 'custom';

export default function OrdersManagement({ orders, onUpdateStatus, onViewDetails }: OrdersManagementProps) {
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<DateRangePreset>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Helper: get date range based on preset
  const getDateRange = (): { start: Date | null; end: Date | null } => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    switch (datePreset) {
      case 'today':
        return { start: todayStart, end: todayEnd };
      case 'week': {
        const weekStart = new Date(now);
        const day = now.getDay(); // 0 Sunday, 1 Monday...
        const diffToMonday = day === 0 ? -6 : 1 - day; // Monday as start
        weekStart.setDate(now.getDate() + diffToMonday);
        weekStart.setHours(0, 0, 0, 0);
        return { start: weekStart, end: todayEnd };
      }
      case 'month': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);
        return { start: monthStart, end: todayEnd };
      }
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            start: new Date(customStartDate),
            end: new Date(customEndDate + 'T23:59:59'),
          };
        }
        return { start: null, end: null };
      default:
        return { start: null, end: null };
    }
  };

  const { start: dateStart, end: dateEnd } = getDateRange();

  // Apply both status and date filters
  const filteredOrders = orders.filter(order => {
    // Status filter
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    // Date filter
    if (dateStart && dateEnd) {
      const orderDate = new Date(order.created_at);
      return orderDate >= dateStart && orderDate <= dateEnd;
    }
    return true;
  });

  const getStatusCount = (status: string) => {
    if (status === 'all') return orders.length;
    return orders.filter(o => o.status === status).length;
  };

  const getDateCount = (preset: DateRangePreset) => {
    let start: Date | null = null;
    let end: Date | null = null;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    switch (preset) {
      case 'today': start = todayStart; end = todayEnd; break;
      case 'week': {
        const weekStart = new Date(now);
        const day = now.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        weekStart.setDate(now.getDate() + diffToMonday);
        weekStart.setHours(0, 0, 0, 0);
        start = weekStart; end = todayEnd;
        break;
      }
      case 'month': {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        end = todayEnd;
        break;
      }
      default: return 0;
    }
    if (!start || !end) return 0;
    return orders.filter(o => {
      const d = new Date(o.created_at);
      return d >= start && d <= end;
    }).length;
  };

  const canReachStatus = (currentStatus: string, targetStatus: string): boolean => {
    if (currentStatus === targetStatus) return true;
    if (targetStatus === 'cancelled') return ['pending', 'confirmed', 'preparing'].includes(currentStatus);
    if (targetStatus === 'out_for_delivery') return false;
    const orderedStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];
    const currentIdx = orderedStatuses.indexOf(currentStatus);
    const targetIdx = orderedStatuses.indexOf(targetStatus);
    if (currentIdx === -1 || targetIdx === -1) return false;
    return targetIdx > currentIdx;
  };

  const getAllStatuses = (currentStatus: string) => [
    { value: 'pending', label: 'Pending', disabled: currentStatus !== 'pending' },
    { value: 'confirmed', label: 'Confirmed', disabled: !canReachStatus(currentStatus, 'confirmed') },
    { value: 'preparing', label: 'Preparing', disabled: !canReachStatus(currentStatus, 'preparing') },
    { value: 'ready', label: 'Ready', disabled: !canReachStatus(currentStatus, 'ready') },
    { value: 'out_for_delivery', label: 'Out for Delivery', disabled: true },
    { value: 'delivered', label: 'Delivered', disabled: !canReachStatus(currentStatus, 'delivered') },
    { value: 'cancelled', label: 'Cancelled', disabled: !canReachStatus(currentStatus, 'cancelled') },
  ];

  const handleUpdateOrderStatus = async (orderId: string, status: Order['status']) => {
    if (status === 'out_for_delivery') return;
    setUpdatingOrderId(orderId);
    try {
      const token = await getValidToken();
      await api.patch(`/company/orders/${orderId}/status`, { status }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`Order status updated to ${status.replace(/_/g, ' ')}`);
      onUpdateStatus();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || error?.message || 'Failed to update order status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      preparing: 'bg-purple-100 text-purple-800',
      ready: 'bg-green-100 text-green-800',
      out_for_delivery: 'bg-indigo-100 text-indigo-800',
      delivered: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      preparing: 'Preparing',
      ready: 'Ready',
      out_for_delivery: 'Out for Delivery',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
    };
    return labels[status] || status;
  };

  const getBorderColor = (status: string) => {
    const borders: Record<string, string> = {
      pending: 'border-l-yellow-500',
      confirmed: 'border-l-blue-500',
      preparing: 'border-l-purple-500',
      ready: 'border-l-green-500',
      out_for_delivery: 'border-l-indigo-500',
      delivered: 'border-l-gray-500',
      cancelled: 'border-l-red-500',
    };
    return borders[status] || 'border-l-gray-500';
  };

  const getDateLabel = (dateInput: string) => {
    const date = new Date(dateInput);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (target.getTime() === today.getTime()) return 'Today';
    if (target.getTime() === yesterday.getTime()) return 'Yesterday';
    return date.toLocaleDateString(undefined, {
      weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  // Group filtered orders by date
  const groupedOrders = filteredOrders.reduce((acc, order) => {
    const key = new Date(order.created_at).toDateString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(order);
    return acc;
  }, {} as Record<string, Order[]>);

  const groupKeys = Object.keys(groupedOrders).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  const todayTotal = filteredOrders
    .filter(o => new Date(o.created_at).toDateString() === new Date().toDateString())
    .reduce((sum, o) => sum + (o.total_amount ?? (o as any).total ?? 0), 0);

  const statusTabs = ['all', 'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];
  const datePresets: { value: DateRangePreset; label: string }[] = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <div>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
        <div className="bg-white rounded-lg p-3 border border-gray-100">
          <p className="text-xs text-gray-500">Pending</p>
          <p className="text-lg font-bold text-yellow-700">{getStatusCount('pending')}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-gray-100">
          <p className="text-xs text-gray-500">Preparing</p>
          <p className="text-lg font-bold text-purple-700">{getStatusCount('preparing')}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-gray-100">
          <p className="text-xs text-gray-500">Out for Delivery</p>
          <p className="text-lg font-bold text-indigo-700">{getStatusCount('out_for_delivery')}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-gray-100">
          <p className="text-xs text-gray-500">Today Total (filtered)</p>
          <p className="text-lg font-bold text-orange-700">₵{todayTotal.toFixed(2)}</p>
        </div>
      </div>

      {/* Header + Status Tabs */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Orders</h2>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 sticky top-0 z-10 bg-gray-100/95 backdrop-blur-sm py-2 rounded-lg">
          {statusTabs.map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                statusFilter === f ? 'bg-orange-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'All Orders' : getStatusLabel(f)}
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-xs">{getStatusCount(f)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Date Filter Row */}
      <div className="bg-white rounded-lg shadow-sm p-3 mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Filter by date:</span>
        <div className="flex flex-wrap gap-2">
          {datePresets.map(preset => (
            <button
              key={preset.value}
              onClick={() => {
                setDatePreset(preset.value);
                if (preset.value !== 'custom') {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                datePreset === preset.value
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {preset.label}
              {preset.value !== 'all' && preset.value !== 'custom' && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-xs">
                  {getDateCount(preset.value)}
                </span>
              )}
            </button>
          ))}
        </div>
        {datePreset === 'custom' && (
          <div className="flex items-center gap-2 ml-0 sm:ml-auto">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <span className="text-gray-500">—</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            {(customStartDate || customEndDate) && (
              <button
                onClick={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                  setDatePreset('all');
                }}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Orders Grouped by Date */}
      <div className="space-y-3 sm:space-y-4">
        {groupKeys.map(groupKey => (
          <div key={groupKey} className="space-y-3">
            <div className="sticky top-12 z-[5] bg-gray-100/95 backdrop-blur-sm py-1">
              <h3 className="text-sm font-semibold text-gray-700">
                {getDateLabel(groupedOrders[groupKey][0].created_at)}
              </h3>
            </div>

            {groupedOrders[groupKey].map(order => {
              const statuses = getAllStatuses(order.status);
              const isOutForDelivery = order.status === 'out_for_delivery';

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-xl shadow-sm p-4 border-l-4 transition-all hover:shadow-md ${getBorderColor(order.status)}`}
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">
                        Order #{order.order_number?.slice(0, 8) || order.id.slice(0, 8)}
                      </p>
                      <p className="font-medium text-sm sm:text-base">{order.customer_name}</p>
                      <p className="text-xs text-gray-500">{order.customer_phone}</p>
                    </div>

                    {isOutForDelivery ? (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 self-start">
                        🛵 Out for Delivery
                      </span>
                    ) : (
                      <select
                        value={order.status}
                        onChange={e => handleUpdateOrderStatus(order.id, e.target.value as Order['status'])}
                        disabled={updatingOrderId === order.id}
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)} border-0 cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-orange-500 w-full sm:w-auto`}
                      >
                        {statuses.map(s => (
                          <option key={s.value} value={s.value} disabled={s.disabled}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="mb-3">
                    <p className="text-sm text-gray-600">Items: {order.order_items?.length || 0}</p>
                    <p className="text-sm font-medium">
                      Total: ₵{(order.total_amount ?? (order as any).total)?.toFixed(2)}
                    </p>
                    {order.special_instructions && (
                      <p className="mt-1 text-xs text-orange-700 line-clamp-2">
                        Notes: {order.special_instructions}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap justify-between items-center gap-2 text-xs text-gray-400">
                    <span className="capitalize">{order.payment_method?.replace('_', ' ') || 'Cash'}</span>
                    <span>{new Date(order.created_at).toLocaleString()}</span>
                  </div>

                  <button
                    onClick={() => onViewDetails(order)}
                    className="mt-3 text-orange-600 text-sm hover:text-orange-700 font-medium transition-colors"
                  >
                    View Details →
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-500">No orders match the selected filters</p>
          <p className="text-sm text-gray-400 mt-1">Try changing the status or date range</p>
        </div>
      )}
    </div>
  );
}