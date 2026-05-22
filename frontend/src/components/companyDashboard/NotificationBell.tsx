// frontend/src/components/companyDashboard/NotificationBell.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../api/supabase';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/apiClient';

interface AppNotification {
  id: string;
  type: 'order' | 'payment' | 'system' | 'alert';
  title: string;
  message: string;
  read: boolean;
  data?: any;
  created_at: string;
}

interface NotificationBellProps {
  onOpenOrder?: (orderId: string) => void;
}

export default function NotificationBell({ onOpenOrder }: NotificationBellProps) {
  const navigate = useNavigate();
  const { user, isAuthReady } = useAuth();
  const userId = user?.id;

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchInProgress = useRef(false);
  const channelRef = useRef<any>(null);
  const fallbackPollRef = useRef<NodeJS.Timeout | null>(null);
  const subscribedForUserRef = useRef<string | null>(null);

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    if (fetchInProgress.current && silent) return;
    if (!silent) setLoading(true);
    fetchInProgress.current = true;
    try {
      const response = await api.get('/notifications');
      const list = Array.isArray(response.data) ? response.data : [];
      setNotifications(list);
      setUnreadCount(list.filter((n: AppNotification) => !n.read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      if (!silent) toast.error('Failed to load notifications');
    } finally {
      fetchInProgress.current = false;
      if (!silent) setLoading(false);
    }
  }, [userId]);

  const markAsRead = async (notificationId: string) => {
    try {
      await api.patch(`/notifications/${notificationId}/read`);
      // Update local state optimistically
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark as read');
    }
  };

  const handleNotificationClick = async (notification: AppNotification) => {
    await markAsRead(notification.id);
    const orderId = notification.data?.orderId || notification.data?.order_id;
    const reviewId = notification.data?.reviewId;
    const productId = notification.data?.productId;

    if (user?.role === 'delivery_guy') {
      setShowNotifications(false);
      if (orderId && onOpenOrder) onOpenOrder(String(orderId));
      return;
    }

    if (user?.role === 'admin') {
      setShowNotifications(false);
      navigate('/admin/dashboard');
      return;
    }

    if (orderId && onOpenOrder) {
      onOpenOrder(String(orderId));
      setShowNotifications(false);
      return;
    }

    if (orderId) {
      const params = new URLSearchParams();
      params.set('orderId', String(orderId));
      if (reviewId) params.set('reviewId', String(reviewId));
      if (productId) params.set('productId', String(productId));
      navigate(`/orders?${params.toString()}`);
      setShowNotifications(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark notifications as read');
    }
  };

  const deleteNotification = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${notificationId}`);
      const notification = notifications.find((n) => n.id === notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      if (notification && !notification.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  // Re-fetch when tab becomes visible (user returns to page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && userId) {
        fetchNotifications(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [userId, fetchNotifications]);

  // Set up real-time + polling
  useEffect(() => {
    if (!isAuthReady || !userId) return;
    if (subscribedForUserRef.current === userId && channelRef.current) return;

    fetchNotifications(true);

    let isRealtimeHealthy = false;

    const stopFallbackPolling = () => {
      if (fallbackPollRef.current) {
        clearInterval(fallbackPollRef.current);
        fallbackPollRef.current = null;
      }
    };

    const startFallbackPolling = () => {
      if (fallbackPollRef.current) return;
      fallbackPollRef.current = setInterval(() => {
        if (document.visibilityState === 'hidden') return;
        if (!isRealtimeHealthy) fetchNotifications(true);
      }, 15000);
    };

    // Clean up old channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Listen to both INSERT and UPDATE events
    channelRef.current = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as AppNotification;
          setNotifications((prev) => [newNotification, ...prev].slice(0, 50));
          setUnreadCount((prev) => prev + 1);
          if (window.Notification?.permission === 'granted') {
            new window.Notification(newNotification.title, {
              body: newNotification.message,
              icon: '/favicon.ico',
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as AppNotification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n))
          );
          setUnreadCount((prev) => prev + (updated.read ? -1 : 1));
        }
      )
      .subscribe((status) => {
        isRealtimeHealthy = status === 'SUBSCRIBED';
        if (isRealtimeHealthy) stopFallbackPolling();
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') startFallbackPolling();
      });

    subscribedForUserRef.current = userId;
    startFallbackPolling();

    if ('Notification' in window && window.Notification.permission === 'default') {
      window.Notification.requestPermission();
    }

    return () => {
      stopFallbackPolling();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      subscribedForUserRef.current = null;
    };
  }, [isAuthReady, userId, fetchNotifications]);

  const getNotificationIcon = (type: string) => {
    // (keep existing icon logic unchanged)
    switch (type) {
      case 'order':
        return (
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
        );
      case 'payment':
        return (
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case 'alert':
        return (
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  // Display payment method in notification message if present
  const getDisplayMessage = (notification: AppNotification) => {
    let msg = notification.message;
    if (notification.data?.payment_method) {
      const method = notification.data.payment_method === 'mobile_money' ? 'Mobile Money'
                    : notification.data.payment_method === 'card' ? 'Card'
                    : notification.data.payment_method;
      msg = msg.replace('via', `via ${method}`);
    }
    return msg;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="p-2 hover:bg-gray-100 rounded-full relative transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
          <div className="fixed left-2 right-2 top-16 sm:absolute sm:top-auto sm:left-auto sm:right-0 sm:mt-2 sm:w-96 bg-white rounded-lg shadow-xl border z-50 overflow-hidden max-h-[75vh]">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                  >
                    Mark all as read
                  </button>
                )}
                <button
                  onClick={() => fetchNotifications(false)}
                  disabled={loading}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  {loading ? '...' : '⟳'}
                </button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <p className="text-gray-500 text-sm">No notifications</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border-b hover:bg-gray-50 transition-colors cursor-pointer ${!notification.read ? 'bg-orange-50' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex gap-3">
                      {getNotificationIcon(notification.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                          <button
                            onClick={(e) => deleteNotification(notification.id, e)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{getDisplayMessage(notification)}</p>
                        {(notification.data?.orderId || notification.data?.order_id) && (
                          <p className="text-xs text-orange-600 mt-1 font-medium">
                            {user?.role === 'delivery_guy'
                              ? 'View on dashboard'
                              : user?.role === 'admin'
                              ? 'Open admin dashboard'
                              : 'Open in Orders'}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          {new Date(notification.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}