// store/productStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/apiClient'; // ✅ axios instance with VITE_API_URL base

interface ProductVariant {
  label: string;
  price: number;
}

export interface ProductWithCompany {
  id: string;
  name: string;
  description: string;
  price?: number;
  base_price?: number;
  variants: ProductVariant[];
  image_url: string;
  category: string;
  stock_quantity: number;
  is_available: boolean;
  is_promoted?: boolean;
  promo_rank?: number | null;
  created_at?: string;
  company_id: string;
  company_name: string;
  company_location?: string;
  company_logo?: string;
}

interface ProductStore {
  products: ProductWithCompany[];
  categories: string[];
  isLoading: boolean;
  lastFetched: number | null;
  fetchProducts: (force?: boolean) => Promise<void>;
  invalidateCache: () => void;
}

const fetchProductsFromAPI = async (): Promise<ProductWithCompany[]> => {
  // ✅ uses axios — goes to https://dbabygrill.onrender.com/api/products
  const response = await api.get('/products');
  const data = response.data;

  return data.map((product: any) => ({
    id: product.id,
    name: product.name,
    description: product.description || '',
    price: product.price,
    base_price: product.base_price,
    variants: product.variants || [],
    image_url: product.image_url,
    category: product.category || '',
    stock_quantity: product.stock_quantity,
    is_available: product.is_available,
    is_promoted: product.is_promoted ?? false,
    promo_rank: product.promo_rank ?? null,
    created_at: product.created_at || null,
    company_id: product.companies?.id || '',
    company_name: product.companies?.name || 'Restaurant',
    company_location: product.companies?.location || '',
    company_logo: product.companies?.logo || '',
  }));
};

export const useProductStore = create<ProductStore>()(
  persist(
    (set, get) => ({
      products: [],
      categories: [],
      isLoading: false,
      lastFetched: null,

      fetchProducts: async (force = false) => {
        const { lastFetched, products } = get();
        const now = Date.now();
        if (!force && products.length > 0 && lastFetched && now - lastFetched < 5 * 60 * 1000) {
          console.log('Using cached products');
          return;
        }
        set({ isLoading: true });
        try {
          const freshProducts = await fetchProductsFromAPI();
          const uniqueCategories = [
            'all',
            ...new Set(freshProducts.map(p => p.category).filter(Boolean)),
          ];
          set({
            products: freshProducts,
            categories: uniqueCategories,
            lastFetched: now,
            isLoading: false,
          });
        } catch (error) {
          console.error('Error fetching products:', error);
          set({ isLoading: false });
        }
      },

      invalidateCache: () => {
        set({ lastFetched: null, products: [], categories: [] });
        get().fetchProducts(true);
      },
    }),
    {
      name: 'product-storage',
      partialize: (state) => ({
        products: state.products,
        categories: state.categories,
        lastFetched: state.lastFetched,
      }),
    }
  )
);

if (typeof window !== 'undefined') {
  const bc = new BroadcastChannel('products-updated');
  bc.onmessage = (e) => {
    if (e?.data?.type !== 'products-updated') return;
    useProductStore.getState().fetchProducts(true);
  };

  window.addEventListener('storage', (e) => {
    if (e.key !== 'products-updated') return;
    useProductStore.getState().fetchProducts(true);
  });
}