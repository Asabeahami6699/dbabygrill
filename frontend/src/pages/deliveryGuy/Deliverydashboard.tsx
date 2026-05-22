import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { getValidToken } from '../../api/authToken';
import { api } from '../../services/apiClient';
import DeliveryOrderCard from '../../components/deliveryGuyComponents/DeliveryOrderCard';
import DeliveryStats from '../../components/deliveryGuyComponents/DeliveryStats';
import DeliveryProfile from '../../components/deliveryGuyComponents/DeliveryProfile';
import { useRealtimeDeliveryOrders, type DeliveryOrder } from '../../components/deliveryGuyComponents/hooks/useRealtimeDeliveryOrders';
import { useLiveLocation } from '../../components/deliveryGuyComponents/hooks/useLiveLocation';
import ActivityFeed from '../../components/deliveryGuyComponents/ActivityFeed';
import NotificationBell from '../../components/companyDashboard/NotificationBell';

// REMOVED the local DeliveryOrder interface – using the shared one

export interface DeliveryGuyProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  company_id: string;
  is_active: boolean;
  is_online?: boolean;
  created_at: string;
}

type Tab = 'available' | 'active' | 'completed' | 'activity';

export default function DeliveryDashboard() {
  const { signOut, isAuthReady } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab]           = useState<Tab>('available');
  const [profile, setProfile]               = useState<DeliveryGuyProfile | null>(null);
  const [showProfile, setShowProfile]       = useState(false);
  const [actionLoading, setActionLoading]   = useState<string | null>(null);
  const [signingOut, setSigningOut]         = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);

  const { orders, loading, mode, refetch } = useRealtimeDeliveryOrders(
    profile?.id,
    profile?.company_id
  );

  const availableOrders = orders.filter(
    o => o.status === 'ready' && !o.delivery_guy_id
  );
  const activeOrders = orders.filter(
    o => o.delivery_guy_id === profile?.id &&
      ['ready', 'out_for_delivery'].includes(o.status)
  );
  const completedOrders = orders.filter(
    o => o.delivery_guy_id === profile?.id && o.status === 'delivered'
  );

  const outForDeliveryOrder = activeOrders.find((o) => o.status === 'out_for_delivery');
  const hasOutForDelivery = Boolean(outForDeliveryOrder);

  const { location: liveLocation, error: locationError, permitted } = useLiveLocation({
    deliveryGuyId: profile?.id,
    orderId: outForDeliveryOrder?.id ?? null,
    isTracking:
      (profile?.is_active ?? false) && (isOnline || hasOutForDelivery),
  });

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const token = await getValidToken();
      if (!token) return;
      const { data } = await api.get('/delivery/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile(data);
      setIsOnline(Boolean(data.is_online));
    } catch (err: any) {
      if (err?.response?.status === 401) navigate('/login', { replace: true });
    } finally {
      setProfileLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (isAuthReady) loadProfile();
  }, [isAuthReady, loadProfile]);

  const handleAcceptOrder = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      const token = await getValidToken();
      if (!token) { toast.error('Session expired. Please sign in again.'); return; }
      await api.patch(`/delivery/orders/${orderId}/accept`, null, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Order accepted!');
      setIsOnline(true);
      if (activeTab === 'available') setActiveTab('active');
      await refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to accept order');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkDelivered = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      const token = await getValidToken();
      if (!token) { toast.error('Session expired. Please sign in again.'); return; }
      await api.patch(`/delivery/orders/${orderId}/deliver`, null, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Order marked as delivered!');
      await refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to update order');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleOnline = async () => {
    if (!profile?.is_active) {
      toast.error('Your account is inactive. Contact your manager.');
      return;
    }
    setTogglingOnline(true);
    const next = !isOnline;
    try {
      const token = await getValidToken();
      await api.patch(
        '/delivery/online',
        { is_online: next },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsOnline(next);
      toast.success(next ? 'You are online — GPS tracking enabled' : 'You are offline');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to update status');
    } finally {
      setTogglingOnline(false);
    }
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Sign out error:', err);
      toast.error('Failed to sign out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'available', label: 'Available', count: availableOrders.length },
    { key: 'active',    label: 'My Active', count: activeOrders.length },
    { key: 'completed', label: 'Completed', count: completedOrders.length },
    { key: 'activity',  label: 'Activity',  count: 0 },
  ];

  const currentOrders =
    activeTab === 'available' ? availableOrders :
    activeTab === 'active'    ? activeOrders    :
    activeTab === 'completed' ? completedOrders : [];

  if (!isAuthReady || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-gray-600 text-sm text-center">
          Could not load your delivery profile. Please sign in again.
        </p>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {signingOut ? 'Signing out…' : 'Sign Out'}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm fixed top-0 left-0 right-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">DBaby Grills</h1>
            <p className="text-xs text-gray-500">Delivery Dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button
              type="button"
              onClick={handleToggleOnline}
              disabled={!profile.is_active || togglingOnline}
              className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50 ${
                isOnline || hasOutForDelivery
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : 'bg-gray-100 text-gray-600 border-gray-200'
              }`}
            >
              {togglingOnline
                ? '…'
                : isOnline || hasOutForDelivery
                ? '● Online'
                : '○ Go Online'}
            </button>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${liveLocation ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-xs text-gray-600">
                {liveLocation ? 'GPS live' : 'GPS off'}
              </span>
              <span className="text-[10px] text-gray-400 ml-1">
                {mode === 'realtime' ? 'live' : 'syncing…'}
              </span>
            </div>
            <button
              onClick={() => setShowProfile(true)}
              className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-700 font-bold text-sm"
            >
              {profile.full_name?.[0]?.toUpperCase() || 'D'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-20 pb-6 space-y-4">
        <DeliveryStats
          available={availableOrders.length}
          active={activeOrders.length}
          completed={completedOrders.length}
        />

        <div className="bg-white rounded-xl shadow-sm p-1 flex gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 min-w-0 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === tab.key
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="truncate">{tab.label}</span>
              {tab.count > 0 && tab.key !== 'activity' && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === tab.key ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'activity' && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <ActivityFeed deliveryGuyId={profile.id} />
          </div>
        )}

        {locationError && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-800 text-center">
            {locationError}
            {permitted === false && (
              <p className="text-xs mt-1">Allow location access in your browser settings.</p>
            )}
          </div>
        )}

        {activeTab === 'active' && profile.is_active && !isOnline && !hasOutForDelivery && (
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-sm text-yellow-800 text-center">
            Tap <strong>Go Online</strong> or accept an order to share your live location with customers.
          </div>
        )}

        {activeTab === 'active' && !profile.is_active && (
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-sm text-yellow-800 text-center">
            Your account is inactive. Contact your manager to enable deliveries.
          </div>
        )}

        {activeTab !== 'activity' && (
          <>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600" />
              </div>
            ) : currentOrders.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-10 text-center">
                <div className="text-4xl mb-3">
                  {activeTab === 'available' ? '🛵' : activeTab === 'active' ? '📦' : '✅'}
                </div>
                <p className="text-gray-500 text-sm">
                  {activeTab === 'available'
                    ? 'No orders available right now.'
                    : activeTab === 'active'
                    ? 'No active deliveries.'
                    : 'No completed deliveries in the last 30 days.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentOrders.map(order => (
                  <DeliveryOrderCard
                    key={order.id}
                    order={order}
                    tab={activeTab}
                    actionLoading={actionLoading}
                    onAccept={handleAcceptOrder}
                    onDeliver={handleMarkDelivered}
                    deliveryGuyId={profile.id}
                    isDriverActive={profile.is_active && (isOnline || hasOutForDelivery)}
                    driverLat={liveLocation?.latitude}
                    driverLng={liveLocation?.longitude}
                    driverSpeed={liveLocation?.speed}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showProfile && (
        <DeliveryProfile
          profile={profile}
          onClose={() => setShowProfile(false)}
          onSignOut={handleSignOut}
        />
      )}
    </div>
  );
}