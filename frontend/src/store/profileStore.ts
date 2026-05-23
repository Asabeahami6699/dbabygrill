import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/apiClient';

export interface ProfileFormData {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  landmark: string;
  postalCode: string;
}

interface ProfileApiResponse {
  full_name?: string;
  phone?: string;
  address?: string;
  city?: string;
  region?: string;
  landmark?: string;
  postal_code?: string;
  email?: string;
}

interface ProfileFallback {
  fullName?: string;
  phone?: string;
}

interface ProfileStore {
  profile: ProfileFormData | null;
  userId: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  lastFetched: number | null;
  fetchProfile: (userId: string, fallback?: ProfileFallback) => Promise<void>;
  updateProfile: (data: ProfileFormData) => Promise<void>;
  invalidateCache: () => void;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

const emptyProfile = (): ProfileFormData => ({
  fullName: '',
  phone: '',
  address: '',
  city: '',
  landmark: '',
  postalCode: '',
});

const mapApiToForm = (
  data: ProfileApiResponse,
  fallback?: ProfileFallback
): ProfileFormData => ({
  fullName: data.full_name || fallback?.fullName || '',
  phone: data.phone || fallback?.phone || '',
  address: data.address || '',
  city: data.city || '',
  landmark: data.landmark || '',
  postalCode: data.postal_code || '',
});

const fetchProfileFromAPI = async (): Promise<ProfileFormData> => {
  const { data } = await api.get<ProfileApiResponse>('/auth/profile');
  return mapApiToForm(data);
};

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      profile: null,
      userId: null,
      isLoading: false,
      isRefreshing: false,
      lastFetched: null,

      fetchProfile: async (userId, fallback) => {
        const { profile, userId: cachedUserId, lastFetched } = get();
        const now = Date.now();
        const isSameUser = cachedUserId === userId;
        const hasCache = isSameUser && profile !== null;
        const cacheFresh =
          hasCache && lastFetched !== null && now - lastFetched < CACHE_TTL_MS;

        if (!isSameUser) {
          set({
            profile: null,
            userId,
            lastFetched: null,
            isLoading: !hasCache,
            isRefreshing: false,
          });
        } else {
          set({ userId });
        }

        if (cacheFresh) {
          return;
        }

        if (hasCache) {
          set({ isRefreshing: true });
          try {
            const fresh = await fetchProfileFromAPI();
            set({
              profile: fresh,
              lastFetched: now,
              isRefreshing: false,
            });
          } catch (err) {
            console.error('Failed to refresh profile:', err);
            set({ isRefreshing: false });
          }
          return;
        }

        set({ isLoading: true });
        try {
          const fresh = await fetchProfileFromAPI();
          set({
            profile: fresh,
            userId,
            lastFetched: now,
            isLoading: false,
          });
        } catch (err) {
          console.error('Failed to load profile:', err);
          set({
            profile: mapApiToForm({}, fallback),
            userId,
            isLoading: false,
          });
        }
      },

      updateProfile: async (data) => {
        await api.put('/auth/profile', {
          full_name: data.fullName.trim(),
          phone: data.phone.trim(),
          address: data.address.trim(),
          city: data.city.trim(),
          landmark: data.landmark.trim(),
          region: data.city.trim() || 'Ghana',
        });
        set({
          profile: { ...data },
          lastFetched: Date.now(),
        });
      },

      invalidateCache: () => {
        set({
          profile: null,
          userId: null,
          lastFetched: null,
          isLoading: false,
          isRefreshing: false,
        });
      },
    }),
    {
      name: 'profile-storage',
      partialize: (state) => ({
        profile: state.profile,
        userId: state.userId,
        lastFetched: state.lastFetched,
      }),
    }
  )
);

export { emptyProfile };
