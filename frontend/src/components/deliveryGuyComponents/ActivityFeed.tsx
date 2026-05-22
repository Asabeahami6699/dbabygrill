import { useEffect, useState } from 'react';
import { getValidToken } from '../../api/authToken';
import { api } from '../../services/apiClient';
import { formatDistanceToNow } from 'date-fns';

interface TrackingEntry {
  id: string;
  order_id: string;
  status: string;
  message: string | null;
  created_at: string;
  order_number?: string;
}




const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  pending:          { color: 'text-gray-600',   bg: 'bg-gray-100',   label: 'Order Received',    icon: '📋' },
  confirmed:        { color: 'text-blue-600',   bg: 'bg-blue-100',   label: 'Confirmed',          icon: '✅' },
  preparing:        { color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Preparing',          icon: '👨‍🍳' },
  ready:            { color: 'text-orange-600', bg: 'bg-orange-100', label: 'Ready for Pickup',   icon: '🍱' },
  out_for_delivery: { color: 'text-indigo-600', bg: 'bg-indigo-100', label: 'Out for Delivery',   icon: '🚴' },
  delivered:        { color: 'text-green-600',  bg: 'bg-green-100',  label: 'Delivered',          icon: '🎉' },
  cancelled:        { color: 'text-red-600',    bg: 'bg-red-100',    label: 'Cancelled',          icon: '❌' },
};

export default function ActivityFeed({ deliveryGuyId }: { deliveryGuyId: string }) {
  const [entries, setEntries] = useState<TrackingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = async () => {
    try {
      const token = await getValidToken();
      const { data } = await api.get('/delivery/activity', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEntries(data || []);
    } catch (err) {
      console.error('[ActivityFeed] fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();
    // Poll every 30 seconds for new activity
    const interval = setInterval(fetchActivity, 30_000);
    return () => clearInterval(interval);
  }, [deliveryGuyId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p className="text-2xl mb-2">📭</p>
        <p className="text-sm">No activity yet today</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
      {entries.map((entry, idx) => {
        const cfg = STATUS_CONFIG[entry.status] ?? {
          color: 'text-gray-600', bg: 'bg-gray-100', label: entry.status, icon: '•',
        };

        return (
          <div key={entry.id} className="flex gap-3 group">
            <div className="flex flex-col items-center">
              <span className={`w-8 h-8 rounded-full ${cfg.bg} flex items-center justify-center text-sm flex-shrink-0`}>
                {cfg.icon}
              </span>
              {idx < entries.length - 1 && (
                <div className="w-px flex-1 bg-gray-200 my-1" />
              )}
            </div>

            <div className="pb-3 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                </span>
              </div>
              {entry.order_number && (
                <p className="text-xs text-gray-500 mt-0.5">#{entry.order_number}</p>
              )}
              {entry.message && (
                <p className="text-xs text-gray-600 mt-0.5 truncate">{entry.message}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}