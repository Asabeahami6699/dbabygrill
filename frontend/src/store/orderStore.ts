import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getValidToken } from '../api/authToken';
import { api } from '../services/apiClient';

interface OrderItem {
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  image_url?: string | null;
  special_instructions?: string;
}

export interface Order {
  id: string;
  order_number: string;
  status: string;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address: string;
  special_instructions: string;
  payment_method: string;
  payment_status: string;
  created_at: string;
  estimated_delivery_time: string;
  company_id: string;
  company_name?: string;
  delivery_guy_id?: string | null;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
}

interface OrderStore {
  orders: Order[];
  isLoading: boolean;
  lastFetched: number | null;
  fetchOrders: () => Promise<void>;
  invalidateCache: () => void;
}

const fetchOrdersFromAPI = async (): Promise<Order[]> => {
  const token = await getValidToken();

  const response = await api.get('/orders/my-orders', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data.map((order: any) => ({
    ...order,
    items: order.order_items || [],
    company_name: order.companies?.name || 'Restaurant',
    delivery_guy_id: order.delivery_guy_id ?? null, // ← map it through
  }));
};

export const useOrderStore = create<OrderStore>()(
  persist(
    (set, get) => ({
      orders: [],
      isLoading: false,
      lastFetched: null,

      fetchOrders: async () => {
        const { lastFetched, orders } = get();
        const now = Date.now();

        // Cache for 2 minutes
        if (orders.length > 0 && lastFetched && now - lastFetched < 2 * 60 * 1000) {
          console.log('Using cached orders');
          return;
        }

        set({ isLoading: true });

        try {
          const freshOrders = await fetchOrdersFromAPI();
          set({ orders: freshOrders, lastFetched: now, isLoading: false });
        } catch (error) {
          console.error('Error fetching orders:', error);
          set({ isLoading: false });
          throw error;
        }
      },

      invalidateCache: () => {
        set({ lastFetched: null, orders: [] });
      },
    }),
    {
      name: 'order-storage',
      partialize: (state) => ({
        orders: state.orders,
        lastFetched: state.lastFetched,
      }),
    }
  )
);