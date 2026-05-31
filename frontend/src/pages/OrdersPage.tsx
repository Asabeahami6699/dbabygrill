import React from 'react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../api/supabase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import RatingModal from '../components/RatingModal';
import { useOrderStore, Order } from '../store/orderStore';
import { api } from '../services/apiClient';
import CustomerOrderLiveMap from '../components/deliveryGuyComponents/CustomerOrderLiveMap';
import { resolveOrderListFilter } from '../lib/orderNavigation';
import 'leaflet/dist/leaflet.css';

export default function OrdersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: orderIdFromPath } = useParams<{ id?: string }>();
  const { user } = useAuth();
  const { orders, isLoading, fetchOrders } = useOrderStore();
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedOrderForRating, setSelectedOrderForRating] = useState<{
    order: Order;
    productId: string;
    productName: string;
  } | null>(null);
  const [reviews, setReviews] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const loadOrders = async () => {
      try {
        await fetchOrders();
      } catch (error: any) {
        console.error('Failed to load orders:', error);
        if (
          error.message?.includes('expired') ||
          error.message?.includes('log in')
        ) {
          toast.error('Session expired. Please log in again.');
          navigate('/login');
        } else {
          toast.error('Failed to load orders');
        }
      }
    };

    loadOrders();
  }, [user, fetchOrders, navigate]);

  useEffect(() => {
    const fetchReviews = async () => {
      const deliveredOrders = orders.filter((order) => order.status === 'delivered');
      if (deliveredOrders.length === 0) return;

      const orderIds = deliveredOrders.map((order) => order.id);
      const { data, error } = await supabase
        .from('order_reviews')
        .select('*')
        .in('order_id', orderIds);

      if (!error && data) {
        const reviewsMap = new Map();
        data.forEach((review) => {
          const key = `${review.order_id}:${review.product_id || 'legacy'}`;
          reviewsMap.set(key, review);
        });
        setReviews(reviewsMap);
      }
    };

    fetchReviews();
  }, [orders]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const orderId = params.get('orderId') || orderIdFromPath;
    if (!orderId) return;

    setSelectedOrder(orderId);
    const reviewId = params.get('reviewId');
    const statusParam = params.get('status');
    setActiveFilter(
      resolveOrderListFilter({
        status: statusParam,
        reviewId,
        orderId,
        orders,
      })
    );

    setTimeout(() => {
      if (reviewId) {
        const target = document.getElementById(`review-response-${reviewId}`);
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      const orderEl = document.getElementById(`order-${orderId}`);
      if (!orderEl && orders.length > 0) {
        const liveFilter = resolveOrderListFilter({ orderId, orders });
        if (liveFilter !== 'all') {
          setActiveFilter(liveFilter);
          setTimeout(() => {
            document.getElementById(`order-${orderId}`)?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
          }, 150);
          return;
        }
      }
      orderEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
  }, [location.search, orderIdFromPath, orders]);

  useEffect(() => {
    const runRatingReminders = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        await api.post('/orders/reviews/reminders/run', {}, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      } catch (error) {
        console.error('Failed to run rating reminders', error);
      }
    };
    runRatingReminders();
  }, []);

  const handleRateOrder = (order: Order, productId: string, productName: string) => {
    setSelectedOrderForRating({ order, productId, productName });
    setShowRatingModal(true);
  };

  const handleReorder = async (_order: Order) => {
    toast.success('Items added to cart');
    navigate('/cart');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':          return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':        return 'bg-blue-100 text-blue-800';
      case 'preparing':        return 'bg-orange-100 text-orange-800';
      case 'ready':            return 'bg-purple-100 text-purple-800';
      case 'out_for_delivery': return 'bg-indigo-100 text-indigo-800';
      case 'delivered':        return 'bg-green-100 text-green-800';
      case 'cancelled':        return 'bg-red-100 text-red-800';
      default:                 return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':          return 'Order Placed';
      case 'confirmed':        return 'Order Confirmed';
      case 'preparing':        return 'Preparing Your Food';
      case 'ready':            return 'Ready for Pickup';
      case 'out_for_delivery': return 'Out for Delivery';
      case 'delivered':        return 'Delivered';
      case 'cancelled':        return 'Cancelled';
      default:                 return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'out_for_delivery':
        return (
          <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
          </svg>
        );
      case 'delivered':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        );
    }
  };

  const getTrackingSteps = (status: string) => {
    const steps = [
      { key: 'pending',          label: 'Order Placed' },
      { key: 'confirmed',        label: 'Order Confirmed' },
      { key: 'preparing',        label: 'Preparing Your Food' },
      { key: 'ready',            label: 'Ready for Pickup' },
      { key: 'out_for_delivery', label: 'Out for Delivery' },
      { key: 'delivered',        label: 'Delivered' },
    ];

    if (status === 'cancelled') return null;

    const currentIdx = steps.findIndex(s => s.key === status);

    return (
      <div className="flex items-center gap-1 overflow-x-auto py-2">
        {steps.map((step, idx) => {
          const isDone    = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center min-w-0 flex-shrink-0">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  isDone    ? 'bg-green-500 text-white' :
                  isCurrent ? 'bg-orange-500 text-white ring-2 ring-orange-300' :
                              'bg-gray-200 text-gray-400'
                }`}>
                  {isDone ? '✓' : idx + 1}
                </div>
                <span className={`text-[9px] mt-1 text-center leading-tight max-w-[52px] ${
                  isCurrent ? 'text-orange-600 font-medium' :
                  isDone    ? 'text-green-600' :
                              'text-gray-400'
                }`}>
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`h-0.5 flex-1 min-w-[8px] mb-4 ${idx < currentIdx ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const filteredOrders = orders.filter((order) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'delivered') return order.status === 'delivered';
    if (activeFilter === 'active') return !['delivered', 'cancelled'].includes(order.status);
    return order.status === activeFilter;
  });

  if (isLoading && orders.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Orders</h1>
          <p className="text-gray-500 mt-1">Track and manage your orders</p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['all', 'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'].map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeFilter === filter
                  ? 'bg-orange-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {filter === 'all' ? 'All Orders' : getStatusLabel(filter)}
            </button>
          ))}
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="text-center py-12">
            <div className="mb-6">
              <svg className="w-24 h-24 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Orders Yet</h2>
            <p className="text-gray-500 mb-6">You haven't placed any orders yet.</p>
            <button
              onClick={() => navigate('/')}
              className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700"
            >
              Browse Restaurants
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const reviewedProductIds = new Set(
                (order.items || [])
                  .filter((item) => reviews.has(`${order.id}:${item.product_id}`))
                  .map((item) => item.product_id)
              );
              const hasAnyReviewed = reviewedProductIds.size > 0;
              const isOutForDelivery = order.status === 'out_for_delivery';

              return (
                <div key={order.id} id={`order-${order.id}`} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Order Header */}
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(order.status)}
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Order #{order.order_number?.slice(0, 8)}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(order.created_at).toLocaleDateString()} •{' '}
                            {new Date(order.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                        <button
                          onClick={() => setSelectedOrder(selectedOrder === order.id ? null : order.id)}
                          className="p-1 hover:bg-gray-100 rounded-lg"
                        >
                          <svg
                            className={`w-5 h-5 text-gray-500 transition-transform ${
                              selectedOrder === order.id ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Tracking timeline */}
                    {order.status !== 'cancelled' && order.status !== 'delivered' && (
                      <div className="mt-3 pt-3 border-t border-gray-50">
                        {getTrackingSteps(order.status)}
                      </div>
                    )}

                    {/* ── Live map banner — visible directly on the card
                         without needing to expand, so customer sees it immediately ── */}
                    {isOutForDelivery && order.delivery_guy_id && (
                      <div className="mt-3 pt-3 border-t border-indigo-50">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                          </span>
                          <p className="text-xs font-semibold text-indigo-700">
                            Your rider is on the way — live location
                          </p>
                        </div>
                        <CustomerOrderLiveMap
                          orderId={order.id}
                          deliveryGuyId={order.delivery_guy_id!}
                          deliveryAddress={order.delivery_address}
                          destinationLat={order.delivery_latitude}
                          destinationLng={order.delivery_longitude}
                          height="260px"
                        />
                      </div>
                    )}
                  </div>

                  {/* Order Summary */}
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {order.company_name || 'Restaurant'}
                      </span>
                      <span className="text-sm font-bold text-orange-600">
                        ₵{order.total.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {order.items?.length || 0} item{order.items?.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {order.payment_method?.replace('_', ' ')} • {order.payment_status}
                    </p>
                    {hasAnyReviewed && (
                      <div className="mt-2 flex items-center gap-1">
                        <span className="text-xs text-gray-500">
                          Rated {reviewedProductIds.size}/{order.items?.length || 0} product
                          {reviewedProductIds.size !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {selectedOrder === order.id && (
                    <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-gray-900">Order Details</h4>
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(null)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Close
                        </button>
                      </div>
                      {/* Delivery Info */}
                      <div className="bg-white rounded-lg p-3 space-y-2">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">Delivery Information</h4>
                        <div className="flex items-start gap-2 text-sm">
                          <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="text-gray-600">{order.delivery_address}</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span className="text-gray-600">{order.customer_phone}</span>
                        </div>
                      </div>

                      {/* Items List */}
                      <div className="bg-white rounded-lg p-3">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">Items</h4>
                        <div className="space-y-2">
                          {order.items?.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <div className="flex-1 flex items-start gap-2">
                                {item.image_url ? (
                                  <img
                                    src={item.image_url}
                                    alt={item.product_name}
                                    className="w-10 h-10 rounded-md object-cover border border-gray-200"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center text-[10px] text-gray-400">
                                    N/A
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <span className="text-gray-900">{item.quantity}x </span>
                                  <span className="text-gray-600">{item.product_name}</span>
                                  {order.status === 'delivered' && (
                                    <div className="mt-1">
                                      {reviews.has(`${order.id}:${item.product_id}`) ? (
                                        <span className="text-xs text-green-600">Rated</span>
                                      ) : (
                                        <button
                                          onClick={() => handleRateOrder(order, item.product_id, item.product_name)}
                                          className="text-xs text-orange-600 hover:text-orange-700"
                                        >
                                          Rate this product
                                        </button>
                                      )}
                                    </div>
                                  )}
                                  {(() => {
                                    const review = reviews.get(`${order.id}:${item.product_id}`);
                                    if (!review?.owner_response) return null;
                                    return (
                                      <div
                                        id={`review-response-${review.id}`}
                                        className="mt-2 rounded-md border border-orange-100 bg-orange-50 px-2 py-1.5"
                                      >
                                        <p className="text-[11px] font-medium text-orange-700">Restaurant response</p>
                                        <p className="text-xs text-orange-800">{review.owner_response}</p>
                                      </div>
                                    );
                                  })()}
                                  {item.special_instructions && (
                                    <div className="text-xs text-orange-600 mt-1 flex items-start gap-1">
                                      <svg className="w-3 h-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                      </svg>
                                      <span>Note: {item.special_instructions}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <span className="text-gray-900 font-medium">
                                ₵{(item.product_price * item.quantity).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                        {order.special_instructions && (
                          <div className="mt-3 pt-2 border-t border-gray-100">
                            <div className="flex items-start gap-1 text-xs text-orange-600">
                              <svg className="w-3 h-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              <span>General instructions: {order.special_instructions}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Price Breakdown */}
                      <div className="bg-white rounded-lg p-3">
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Subtotal</span>
                            <span className="text-gray-900">₵{order.subtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Delivery Fee</span>
                            <span className="text-gray-900">
                              {order.delivery_fee === 0 ? 'Free' : `₵${order.delivery_fee.toFixed(2)}`}
                            </span>
                          </div>
                          <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                            <span>Total</span>
                            <span className="text-orange-600">₵{order.total.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {order.status === 'delivered' && (
                          <div className="flex-1 px-3 py-2 bg-gray-50 text-gray-700 rounded-lg text-xs flex items-center">
                            Rate each product from the items list above.
                          </div>
                        )}
                        <button
                          onClick={() => handleReorder(order)}
                          className="flex-1 px-4 py-2 border border-orange-600 text-orange-600 rounded-lg hover:bg-orange-50 transition-colors text-sm"
                        >
                          Reorder
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(null)}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showRatingModal && selectedOrderForRating && (
        <RatingModal
          isOpen={showRatingModal}
          orderId={selectedOrderForRating.order.id}
          orderNumber={selectedOrderForRating.order.order_number}
          companyName={selectedOrderForRating.order.company_name || 'Restaurant'}
          productId={selectedOrderForRating.productId}
          productName={selectedOrderForRating.productName}
          onClose={() => setShowRatingModal(false)}
          onSuccess={() => {
            setShowRatingModal(false);
            const refresh = async () => {
              try {
                await fetchOrders();
              } catch (err) {
                console.error('Failed to refresh orders after rating:', err);
              }
            };
            refresh();
          }}
        />
      )}
    </div>
  );
}