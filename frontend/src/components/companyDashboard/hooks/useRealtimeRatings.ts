import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../api/supabase';
import { getValidToken } from '../../../api/authToken';
import { api } from '../../../services/apiClient';
import { useRatingsStore } from '../comDashStore/ratingsStore';

export interface ReviewItem {
  id: string;
  rating: number;
  reviewText: string | null;
  customerName: string;
  createdAt: string;
  ownerResponse: string | null;
  ownerRespondedAt: string | null;
  issueResolved: boolean;
  resolvedAt: string | null;
}

export interface ProductRating {
  productId: string;
  productName: string;
  averageRating: number;
  totalReviews: number;
  lowRatings: ReviewItem[];
  recentReviews: ReviewItem[];
}

interface UseRealtimeRatingsOptions {
  companyId?: string;
  startDate?: Date | null;
  endDate?: Date | null;
}

export function useRealtimeRatings({ companyId, startDate, endDate }: UseRealtimeRatingsOptions) {
  const {
    ratings,
    loading,
    error,
    setRatings,
    setLoading,
    setError,
    updateReview,
  } = useRatingsStore();

  const isMounted = useRef(true);
  const currentCompanyId = useRef(companyId);
  const currentStartDate = useRef(startDate);
  const currentEndDate = useRef(endDate);

  // Build API URL with date filters
  const buildUrl = useCallback(() => {
    let url = `/orders/reviews/company/${companyId}/products`;
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());
    if (params.toString()) url += `?${params.toString()}`;
    return url;
  }, [companyId, startDate, endDate]);

  // Fetch function – updates the store
  const fetchRatings = useCallback(async (silent = false) => {
    if (!companyId) return;
    if (!silent) setLoading(true);
    try {
      const token = await getValidToken();
      const { data } = await api.get(buildUrl(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (isMounted.current) {
        setRatings(data.products || []);
      }
    } catch (err: any) {
      if (isMounted.current) {
        setError(err.message || 'Failed to load ratings');
      }
    } finally {
      if (isMounted.current && !silent) setLoading(false);
    }
  }, [companyId, buildUrl, setRatings, setError, setLoading]);

  // Realtime subscription and initial fetch
  useEffect(() => {
    if (!companyId) return;
    isMounted.current = true;

    // If filters changed, force refetch (don't use cache)
    const filtersChanged =
      currentCompanyId.current !== companyId ||
      currentStartDate.current !== startDate ||
      currentEndDate.current !== endDate;

    if (filtersChanged) {
      currentCompanyId.current = companyId;
      currentStartDate.current = startDate;
      currentEndDate.current = endDate;
      fetchRatings(false);
    } else if (ratings.length === 0) {
      // No cache, fetch
      fetchRatings(false);
    } else {
      // Use cached data – ensure loading is false
      setLoading(false);
    }

    const channel = supabase
      .channel(`ratings-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_reviews',
        },
        (payload) => {
          if (!isMounted.current) return;
          // Optimistic update for UPDATE events
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new;
            updateReview(updated.id, {
              ownerResponse: updated.owner_response,
              ownerRespondedAt: updated.owner_responded_at,
              issueResolved: updated.issue_resolved,
              resolvedAt: updated.resolved_at,
            });
          } else {
            // For INSERT or DELETE, do a silent refetch
            fetchRatings(true);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [companyId, startDate, endDate, fetchRatings, setLoading, ratings.length, updateReview]);

  return { ratings, loading, error, refetch: () => fetchRatings(false) };
}