// frontend/src/components/deliveryGuyComponents/hooks/useRealtimeDeliveryOrders.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../../../api/supabase';
import { api } from '../../../services/apiClient';
import { getValidToken } from '../../../api/authToken';

export interface DeliveryOrder {
  id: string;
  order_number: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  special_instructions: string | null;
  payment_method: string;
  payment_status: string;
  delivery_guy_id: string | null;
  estimated_delivery_time: string | null;
  pickup_time: string | null;
  created_at: string;
  company_id: string;
  companies?: { name: string; location: string; phone: string } | null;
  order_items: {
    product_name: string;
    quantity: number;
    product_price: number;
    special_instructions: string | null;
  }[];
}

type Mode = 'realtime' | 'polling';

const POLL_FAST_MS = 8_000;
const POLL_BACKUP_MS = 18_000;
const DEBOUNCE_MS = 400;

export function useRealtimeDeliveryOrders(
  deliveryGuyId: string | null | undefined,
  companyId: string | null | undefined
) {
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('polling');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const isMounted = useRef(true);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fastPollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const backupPollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribedKeyRef = useRef<string | null>(null);

  const deliveryGuyIdRef = useRef(deliveryGuyId);
  const companyIdRef = useRef(companyId);
  useEffect(() => {
    deliveryGuyIdRef.current = deliveryGuyId;
    companyIdRef.current = companyId;
  }, [deliveryGuyId, companyId]);

  const fetchOrders = useCallback(async () => {
    const id = deliveryGuyIdRef.current;
    if (!id) return;
    try {
      const token = await getValidToken();
      const { data } = await api.get('/delivery/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!isMounted.current) return;

      const allOrders: DeliveryOrder[] = [
        ...(data.available ?? []),
        ...(data.active ?? []),
        ...(data.completed ?? []),
      ];

      const seen = new Set<string>();
      const unique = allOrders.filter((o) => {
        if (seen.has(o.id)) return false;
        seen.add(o.id);
        return true;
      });

      setOrders(unique);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('[useRealtimeDeliveryOrders] fetch error:', err);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  const debouncedFetch = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchOrders();
      debounceTimer.current = null;
    }, DEBOUNCE_MS);
  }, [fetchOrders]);

  const stopFastPolling = useCallback(() => {
    if (fastPollTimer.current) {
      clearInterval(fastPollTimer.current);
      fastPollTimer.current = null;
    }
  }, []);

  const startFastPolling = useCallback(() => {
    if (fastPollTimer.current) return;
    fastPollTimer.current = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      fetchOrders();
    }, POLL_FAST_MS);
  }, [fetchOrders]);

  const stopBackupPolling = useCallback(() => {
    if (backupPollTimer.current) {
      clearInterval(backupPollTimer.current);
      backupPollTimer.current = null;
    }
  }, []);

  const startBackupPolling = useCallback(() => {
    if (backupPollTimer.current) return;
    backupPollTimer.current = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      fetchOrders();
    }, POLL_BACKUP_MS);
  }, [fetchOrders]);

  useEffect(() => {
    if (!deliveryGuyId || !companyId) {
      setLoading(false);
      setOrders([]);
      return;
    }

    const subscribeKey = `${deliveryGuyId}:${companyId}`;
    if (subscribedKeyRef.current === subscribeKey && channelRef.current) {
      return;
    }

    isMounted.current = true;
    subscribedKeyRef.current = subscribeKey;

    setLoading(true);
    fetchOrders();
    setMode('polling');
    startFastPolling();
    startBackupPolling();

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`delivery-orders-${deliveryGuyId}-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `company_id=eq.${companyId}`,
        },
        () => debouncedFetch()
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `company_id=eq.${companyId}`,
        },
        () => debouncedFetch()
      )
      .subscribe((status) => {
        if (!isMounted.current) return;
        if (status === 'SUBSCRIBED') {
          setMode('realtime');
          stopFastPolling();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setMode('polling');
          startFastPolling();
        }
      });

    channelRef.current = channel;

    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchOrders();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      isMounted.current = false;
      subscribedKeyRef.current = null;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      stopFastPolling();
      stopBackupPolling();
      document.removeEventListener('visibilitychange', onVisible);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [
    deliveryGuyId,
    companyId,
    fetchOrders,
    debouncedFetch,
    startFastPolling,
    stopFastPolling,
    startBackupPolling,
    stopBackupPolling,
  ]);

  return { orders, loading, mode, lastUpdate, refetch: fetchOrders };
}
