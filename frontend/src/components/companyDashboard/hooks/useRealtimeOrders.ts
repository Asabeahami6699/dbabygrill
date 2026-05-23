// frontend/src/pages/company/hooks/useRealtimeOrders.ts
import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '../../../api/supabase';
import { toast } from 'react-hot-toast';

type RealtimeMode = 'connecting' | 'realtime' | 'polling';

export function useRealtimeOrders(
  companyId: string | undefined,
  onOrderUpdate: () => void
): RealtimeMode {
  const onOrderUpdateRef = useRef(onOrderUpdate);
  const channelRef = useRef<any>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [mode, setMode] = useState<RealtimeMode>('connecting');
  // Track which companyId we've subscribed for — prevents re-subscribing on TOKEN_REFRESHED
  const subscribedForCompanyRef = useRef<string | null>(null);

  useEffect(() => {
    onOrderUpdateRef.current = onOrderUpdate;
  }, [onOrderUpdate]);

  const debouncedRefresh = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      onOrderUpdateRef.current();
      debounceTimerRef.current = null;
    }, 450);
  }, []);

  useEffect(() => {
    if (!companyId) {
      setMode('connecting');
      return;
    }

    // Already subscribed for this company — don't tear down and rebuild
    // This prevents re-subscribing on every TOKEN_REFRESHED event
    if (subscribedForCompanyRef.current === companyId && channelRef.current) {
      return;
    }

    // Clean up any previous channel for a different companyId
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    let isCancelled = false;
    let isRealtimeHealthy = false;

    const stopFallbackPolling = () => {
      if (fallbackTimerRef.current) {
        clearInterval(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };

    const startFallbackPolling = () => {
      if (fallbackTimerRef.current) return;
      setMode('polling');
      fallbackTimerRef.current = setInterval(() => {
        if (isCancelled || isRealtimeHealthy) return;
        if (document.visibilityState === 'hidden') return;
        onOrderUpdateRef.current();
      }, 12000);
    };

    // KEY FIX: Don't call supabase.auth.getSession() here.
    // Supabase realtime manages its own auth token internally via the client.
    // Calling getSession() here is what was triggering extra TOKEN_REFRESHED events.

    const channel = supabase
      .channel(`orders_realtime_${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          if (isCancelled) return;
          toast.success('New order received!', { duration: 4000 });
          debouncedRefresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          if (isCancelled) return;
          debouncedRefresh();
        }
      )
      .subscribe((status) => {
        if (isCancelled) return;
        isRealtimeHealthy = status === 'SUBSCRIBED';
        if (isRealtimeHealthy) {
          setMode('realtime');
          stopFallbackPolling();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          startFallbackPolling();
        } else {
          setMode('connecting');
        }
      });

    channelRef.current = channel;
    subscribedForCompanyRef.current = companyId;
    startFallbackPolling();

    return () => {
      isCancelled = true;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      stopFallbackPolling();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      subscribedForCompanyRef.current = null;
      setMode('connecting');
    };
  }, [companyId, debouncedRefresh]);
  // companyId is a string primitive — won't change on TOKEN_REFRESHED

  return mode;
}