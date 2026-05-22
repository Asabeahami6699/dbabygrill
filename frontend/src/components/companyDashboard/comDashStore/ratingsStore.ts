// frontend/src/components/companyDashboard/comDashStore/ratingsStore.ts
import { create } from 'zustand';
import { ProductRating } from '../hooks/useRealtimeRatings';

interface RatingsStore {
  ratings: ProductRating[];
  loading: boolean;
  error: string | null;
  lastFetched: Date | null;
  setRatings: (ratings: ProductRating[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateReview: (
    reviewId: string,
    updates: Partial<{
      ownerResponse: string;
      ownerRespondedAt: string;
      issueResolved: boolean;
      resolvedAt: string;
    }>
  ) => void;
  clearCache: () => void;
}

export const useRatingsStore = create<RatingsStore>((set, get) => ({
  ratings: [],
  loading: false,
  error: null,
  lastFetched: null,

  setRatings: (ratings) => set({ ratings, lastFetched: new Date(), loading: false, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),

  updateReview: (reviewId, updates) => {
    const { ratings } = get();
    const updatedRatings = ratings.map((product) => ({
      ...product,
      recentReviews: product.recentReviews.map((review) =>
        review.id === reviewId ? { ...review, ...updates } : review
      ),
      lowRatings: product.lowRatings.map((review) =>
        review.id === reviewId ? { ...review, ...updates } : review
      ),
    }));
    set({ ratings: updatedRatings });
  },

  clearCache: () => set({ ratings: [], lastFetched: null, error: null }),
}));