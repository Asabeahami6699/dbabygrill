import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../../../api/supabase';
import { api } from '../../../services/apiClient';

export interface DriverLocationState {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  is_online: boolean;
  updated_at: string;
}

interface UseDriverLocationOptions {
  deliveryGuyId: string | null;
  /** When provided (customer view), also polls the backend every 10s as a reliable fallback. */
  orderId?: string | null;
}

export function useDriverLocation({ deliveryGuyId, orderId }: UseDriverLocationOptions) {
  const [location, setLocation] = useState<DriverLocationState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchFromApi = useCallback(async () => {
    if (!orderId) return;
    try {
      const { data } = await api.get<{ location: DriverLocationState | null }>(
        `/orders/${orderId}/driver-location`
      );
      if (data.location) {
        setLocation(data.location);
        setError(null);
      }
    } catch (err) {
      console.error('[useDriverLocation] API poll:', err);
    }
  }, [orderId]);

  // Initial fetch via Supabase (works when RLS allows) or API
  useEffect(() => {
    if (!deliveryGuyId) return;

    supabase
      .from('delivery_locations')
      .select('*')
      .eq('delivery_guy_id', deliveryGuyId)
      .maybeSingle()
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          if (orderId) fetchFromApi();
          return;
        }
        if (data) setLocation(data as DriverLocationState);
      });

    if (orderId) fetchFromApi();
  }, [deliveryGuyId, orderId, fetchFromApi]);

  // API polling fallback for customers
  useEffect(() => {
    if (!orderId || !deliveryGuyId) return;
    pollRef.current = setInterval(fetchFromApi, 10_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [orderId, deliveryGuyId, fetchFromApi]);

  // Supabase Realtime subscription
  useEffect(() => {
    if (!deliveryGuyId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`driver-location-${deliveryGuyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_locations',
          filter: `delivery_guy_id=eq.${deliveryGuyId}`,
        },
        (payload) => {
          setLocation(payload.new as DriverLocationState);
          setError(null);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          setError(null);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnected(false);
          if (!orderId) {
            setError('Lost connection to live tracking.');
          }
        } else if (status === 'CLOSED') {
          setConnected(false);
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setConnected(false);
    };
  }, [deliveryGuyId, orderId]);

  return {
    location,
    isOnline: location?.is_online ?? false,
    connected: connected || !!orderId,
    error,
  };
}
