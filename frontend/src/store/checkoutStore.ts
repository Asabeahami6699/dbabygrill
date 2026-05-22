// frontend/src/store/checkoutStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/apiClient';
import { getValidToken } from '../api/authToken';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CheckoutFormData {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  region: string;
  landmark: string;
  locationLabel: string;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  locationInputMode: 'manual' | 'gps';
  notes: string;
  paymentMethod: 'cash' | 'card';
}

export interface ItemInstruction {
  product_id: string;
  product_name: string;
  instruction: string;
}

export interface DeliveryArea {
  id: string;
  area_name: string;
  delivery_fee: number;
  is_active: boolean;
}

export interface SavedAddress {
  recipient_name: string | null;
  phone: string | null;
  street_address: string | null;
  city: string | null;
  region: string | null;
  landmark: string | null;
}

export interface PickupBranch {
  id: string;
  branch_name: string;
  address: string;
  phone: string | null;
  is_active: boolean;
}

export type CheckoutStep = 'idle' | 'submitting' | 'redirecting' | 'success' | 'error';

export interface CheckoutStore {
  // ── Form state ──
  formData: CheckoutFormData;
  itemInstructions: ItemInstruction[];
  fulfillmentMode: 'delivery' | 'pickup';
  deliveryDetailsMode: 'saved' | 'custom';
  customLocationSelected: boolean;
  gpsLoading: boolean;

  // ── Delivery data ──
  deliveryAreas: DeliveryArea[];
  deliveryAreasLoading: boolean;
  dynamicDeliveryFee: number;
  matchedDeliveryArea: string | null;
  deliveryFeeLoading: boolean;

  // ── Saved address ──
  savedAddress: SavedAddress | null;
  savedAddressLoading: boolean;

  // ── Pickup branches ──
  pickupBranches: PickupBranch[];
  pickupBranchesLoading: boolean;
  selectedPickupBranchId: string | null;

  // ── Checkout process ──
  step: CheckoutStep;
  error: string | null;
  lastOrderId: string | null;
  lastOrderNumber: string | null;

  // ── Computed ──
  effectiveDeliveryFee: (subtotal: number) => number;

  // ── Actions ──
  setFormData: (data: Partial<CheckoutFormData>) => void;
  setFulfillmentMode: (mode: 'delivery' | 'pickup') => void;
  setDeliveryDetailsMode: (mode: 'saved' | 'custom') => void;
  setCustomLocationSelected: (val: boolean) => void;
  setLocationInputMode: (mode: 'manual' | 'gps') => void;
  captureCurrentLocation: (companyId: string) => Promise<void>;
  clearGpsLocation: () => void;
  setItemInstructions: (instructions: ItemInstruction[]) => void;
  updateInstruction: (productId: string, instruction: string) => void;

  // ── Async actions ──
  loadSavedAddress: (userId: string) => Promise<void>;
  loadDeliveryAreas: (companyId: string) => Promise<void>;
  fetchDeliveryFee: (companyId: string, city: string) => Promise<void>;
  loadPickupBranches: (companyId: string) => Promise<void>;
  setSelectedPickupBranchId: (id: string | null) => void;
  submitCashOrder: (items: any[], grandTotal: number) => Promise<{ orderId: string }>;
  initiatePaystackPayment: (items: any[], grandTotal: number, companyId: string) => Promise<{ checkoutUrl: string }>;

  // ── Reset ──
  resetCheckout: () => void;
  setStep: (step: CheckoutStep) => void;
  setError: (error: string | null) => void;
}

// ─── Default form ─────────────────────────────────────────────────────────────

const defaultForm: CheckoutFormData = {
  fullName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  region: 'Ghana',
  landmark: '',
  locationLabel: '',
  deliveryLatitude: null,
  deliveryLongitude: null,
  locationInputMode: 'manual',
  notes: '',
  paymentMethod: 'cash',
};

// ─── Auth-aware fetch ─────────────────────────────────────────────────────────

const authFetch = async (url: string, method = 'GET', data?: any) => {
  const token = await getValidToken();
  const response = await api({
    url,
    method,
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCheckoutStore = create<CheckoutStore>()(
  persist(
    (set, get) => ({
      // ── Initial state ──
      formData: defaultForm,
      itemInstructions: [],
      fulfillmentMode: 'delivery',
      deliveryDetailsMode: 'custom',
      customLocationSelected: false,
      gpsLoading: false,

      deliveryAreas: [],
      deliveryAreasLoading: false,
      dynamicDeliveryFee: 0,
      matchedDeliveryArea: null,
      deliveryFeeLoading: false,

      savedAddress: null,
      savedAddressLoading: false,

      pickupBranches: [],
      pickupBranchesLoading: false,
      selectedPickupBranchId: null,

      step: 'idle',
      error: null,
      lastOrderId: null,
      lastOrderNumber: null,

      // ── Computed: delivery fee is 0 for pickup ──
      effectiveDeliveryFee: (subtotal: number) => {
        const { fulfillmentMode, dynamicDeliveryFee } = get();
        if (fulfillmentMode === 'pickup') return 0;
        return dynamicDeliveryFee;
      },

      // ── Sync actions ──
      setFormData: (data) =>
        set((state) => ({ formData: { ...state.formData, ...data } })),

      setFulfillmentMode: (mode) => set({ fulfillmentMode: mode }),

      setDeliveryDetailsMode: (mode) => set({ deliveryDetailsMode: mode }),

      setCustomLocationSelected: (val) => set({ customLocationSelected: val }),

      setLocationInputMode: (mode) =>
        set((state) => ({
          formData: {
            ...state.formData,
            locationInputMode: mode,
            ...(mode === 'manual'
              ? {
                  deliveryLatitude: null,
                  deliveryLongitude: null,
                  locationLabel: '',
                }
              : { address: '' }),
          },
        })),

      clearGpsLocation: () =>
        set((state) => ({
          formData: {
            ...state.formData,
            deliveryLatitude: null,
            deliveryLongitude: null,
            locationLabel: '',
          },
        })),

      captureCurrentLocation: async (companyId: string) => {
        set({ gpsLoading: true });
        try {
          if (!('geolocation' in navigator)) {
            throw new Error('GPS is not supported on this device.');
          }

          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 20_000,
              maximumAge: 0,
            });
          }).catch((err: GeolocationPositionError) => {
            if (err.code === err.PERMISSION_DENIED) {
              throw new Error('Location permission denied. Allow GPS in browser settings.');
            }
            throw new Error('Could not get GPS fix. Try again outdoors or use street address.');
          });

          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const { reverseGeocode } = await import('../lib/geocode');
          const reversed = await reverseGeocode(lat, lng);

          const city = reversed?.city || get().formData.city;
          const region = reversed?.region || 'Ghana';
          const label = reversed?.displayName || `GPS (${lat.toFixed(5)}, ${lng.toFixed(5)})`;

          set((state) => ({
            formData: {
              ...state.formData,
              locationInputMode: 'gps',
              deliveryLatitude: lat,
              deliveryLongitude: lng,
              locationLabel: label,
              city: city || state.formData.city,
              region,
              address: '',
            },
          }));

          if (companyId && city) {
            await get().fetchDeliveryFee(companyId, city);
          }
        } finally {
          set({ gpsLoading: false });
        }
      },

      setItemInstructions: (instructions) => set({ itemInstructions: instructions }),

      updateInstruction: (productId, instruction) =>
        set((state) => ({
          itemInstructions: state.itemInstructions.map((i) =>
            i.product_id === productId ? { ...i, instruction } : i
          ),
        })),

      setStep: (step) => set({ step }),

      setError: (error) => set({ error }),

      setSelectedPickupBranchId: (id) => set({ selectedPickupBranchId: id }),

      // ── Load saved address from Supabase ──
      loadSavedAddress: async (_userId: string) => {
        set({ savedAddressLoading: true });
        try {
          const { api } = await import('../services/apiClient');
          const { data } = await api.get<{
            full_name?: string;
            phone?: string;
            address?: string;
            city?: string;
            region?: string;
            landmark?: string;
          }>('/auth/profile');

          if (!data?.address && !data?.city && !data?.full_name) return;

          const saved = {
            recipient_name: data.full_name || '',
            phone: data.phone || '',
            street_address: data.address || '',
            city: data.city || '',
            region: data.region || 'Ghana',
            landmark: data.landmark || '',
          };

          set({
            savedAddress: saved,
            deliveryDetailsMode: 'saved',
            customLocationSelected: false,
          });

          set((state) => ({
            formData: {
              ...state.formData,
              locationInputMode: 'manual',
              deliveryLatitude: null,
              deliveryLongitude: null,
              locationLabel: '',
              fullName: saved.recipient_name?.trim() || state.formData.fullName,
              phone: saved.phone?.trim() || state.formData.phone,
              address: saved.street_address?.trim() || state.formData.address,
              city: saved.city?.trim() || state.formData.city,
              region: saved.region?.trim() || state.formData.region,
              landmark: saved.landmark?.trim() || state.formData.landmark,
            },
          }));
        } catch (err) {
          console.error('Failed to load saved address:', err);
        } finally {
          set({ savedAddressLoading: false });
        }
      },

      // ── Load delivery areas for city suggestions ──
      loadDeliveryAreas: async (companyId: string) => {
        set({ deliveryAreasLoading: true });
        try {
          const data = await authFetch(
            `/orders/delivery-areas?companyId=${encodeURIComponent(companyId)}`
          );
          set({ deliveryAreas: Array.isArray(data) ? data : [] });
        } catch (err) {
          console.error('Failed to load delivery areas:', err);
          set({ deliveryAreas: [] });
        } finally {
          set({ deliveryAreasLoading: false });
        }
      },

      // ── Load pickup branches ──
      loadPickupBranches: async (companyId: string) => {
        set({ pickupBranchesLoading: true });
        try {
          const data = await authFetch(
            `/orders/pickup-branches?companyId=${encodeURIComponent(companyId)}`
          );
          const branches: PickupBranch[] = Array.isArray(data) ? data : [];
          set({
            pickupBranches: branches,
            // Auto-select if only one branch exists
            selectedPickupBranchId:
              branches.length === 1 ? branches[0].id : get().selectedPickupBranchId,
          });
        } catch (err) {
          console.error('Failed to load pickup branches:', err);
          set({ pickupBranches: [] });
        } finally {
          set({ pickupBranchesLoading: false });
        }
      },

      // ── Fetch delivery fee for selected city ──
      fetchDeliveryFee: async (companyId: string, city: string) => {
        if (!city.trim()) {
          set({ dynamicDeliveryFee: 0, matchedDeliveryArea: null });
          return;
        }
        set({ deliveryFeeLoading: true });
        try {
          const quote = await authFetch(
            `/orders/delivery-fee?companyId=${encodeURIComponent(companyId)}&city=${encodeURIComponent(city)}`
          );
          set({
            dynamicDeliveryFee: Number(quote.deliveryFee || 0),
            matchedDeliveryArea: quote.matchedArea || null,
          });
        } catch (err) {
          console.error('Delivery fee fetch error:', err);
          set({ dynamicDeliveryFee: 0, matchedDeliveryArea: null });
        } finally {
          set({ deliveryFeeLoading: false });
        }
      },

      // ── Submit cash order ──
      submitCashOrder: async (cartItems, grandTotal) => {
        const { formData, itemInstructions, fulfillmentMode, effectiveDeliveryFee, selectedPickupBranchId } = get();

        set({ step: 'submitting', error: null });

        try {
          const orderItems = cartItems.map((item: any) => {
            // ✅ Look up the user’s instruction for this product
            const instructionEntry = itemInstructions.find(
              i => i.product_id === item.productId
            );
            const userInstruction = instructionEntry?.instruction?.trim();

            // Fallback to variant label / product description
            const fallbackInstruction = item.variantLabel
              ? `Size: ${item.variantLabel}. ${item.product.description || ''}`
              : item.product.description;

            return {
              id: item.productId,
              product_name: item.product.name,
              product_price: Number(item.variantPrice ?? item.product.price),
              quantity: Number(item.quantity),
              special_instructions: userInstruction || fallbackInstruction,
            };
          });

          const result = await authFetch('/orders', 'POST', {
            items: orderItems,
            formData: {
              ...formData,
              fulfillmentMode,
              pickupBranchId: fulfillmentMode === 'pickup' ? selectedPickupBranchId : undefined,
            },
            itemInstructions,
            deliveryFee: effectiveDeliveryFee(grandTotal - effectiveDeliveryFee(0)),
          });

          set({
            step: 'success',
            lastOrderId: result.id,
            lastOrderNumber: result.order_number,
          });

          return { orderId: result.id };
        } catch (err: any) {
          const message =
            err?.response?.data?.error || err.message || 'Failed to place order';
          set({ step: 'error', error: message });
          throw new Error(message);
        }
      },

      // ── Initiate Paystack payment ──
      initiatePaystackPayment: async (cartItems, grandTotal, companyId) => {
        const { formData, itemInstructions, fulfillmentMode, effectiveDeliveryFee, selectedPickupBranchId } = get();
        const deliveryFee = effectiveDeliveryFee(grandTotal);

        set({ step: 'redirecting', error: null });

        try {
          const leanCartItems = cartItems.map((item: any) => ({
            id: item.productId,
            product_name: item.product.name,
            product_price: Number(item.variantPrice ?? item.product.price),
            quantity: Number(item.quantity),
          }));

          const result = await authFetch('/payments/initiate', 'POST', {
            amount: grandTotal,
            email: formData.email,
            companyId,
            deliveryFee,
            cartItems: leanCartItems,
            formData: {
              ...formData,
              fulfillmentMode,
              pickupBranchId: fulfillmentMode === 'pickup' ? selectedPickupBranchId : undefined,
            },
            itemInstructions,
          });

          if (!result.checkoutUrl) throw new Error('No checkout URL returned');

          return { checkoutUrl: result.checkoutUrl };
        } catch (err: any) {
          const message =
            err?.response?.data?.error || err.message || 'Payment initialization failed';
          set({ step: 'error', error: message });
          throw new Error(message);
        }
      },

      // ── Reset checkout state ──
      resetCheckout: () =>
        set({
          formData: defaultForm,
          itemInstructions: [],
          fulfillmentMode: 'delivery',
          deliveryDetailsMode: 'custom',
          customLocationSelected: false,
          gpsLoading: false,
          dynamicDeliveryFee: 0,
          matchedDeliveryArea: null,
          deliveryAreas: [],
          deliveryAreasLoading: false,
          pickupBranches: [],
          pickupBranchesLoading: false,
          selectedPickupBranchId: null,
          step: 'idle',
          error: null,
          lastOrderId: null,
          lastOrderNumber: null,
        }),
    }),
    {
      name: 'checkout-storage',
      partialize: (state) => ({
        formData: state.formData,
        itemInstructions: state.itemInstructions,
        fulfillmentMode: state.fulfillmentMode,
        savedAddress: state.savedAddress,
      }),
    }
  )
);