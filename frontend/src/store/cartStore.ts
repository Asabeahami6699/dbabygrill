// frontend/src/store/cartStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getValidToken } from '../api/authToken';
import { Product } from '../types';
import { api } from '../services/apiClient';

export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  company_id: string;
  company_name: string;
  variantLabel?: string;
  variantPrice?: number;
}

export interface CompanyCart {
  id: string;
  name: string;
  items: CartItem[];
  total: number;
}

export interface CartStore {
  items: CartItem[];
  companies: CompanyCart[];
  subtotal: number;
  deliveryFee: number;
  grandTotal: number;
  totalItems: number;
  isLoading: boolean;
  isInitialized: boolean;
  isOpen: boolean;
  totalPrice: number;
  toggleCart: () => void;
  closeCart: () => void;
  addItem: (
    product: Product,
    companyId: string,
    companyName: string,
    variantLabel?: string,
    variantPrice?: number
  ) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  loadCart: () => Promise<void>;
  syncCart: () => Promise<void>;
  resetCart: () => void;
  calculateTotals: (items: CartItem[]) => {
    subtotal: number;
    totalItems: number;
    deliveryFee: number;
    grandTotal: number;
    companies: CompanyCart[];
  };
}

const fetchWithAuth = async (
  url: string,
  options: any = {}
) => {
  const token = await getValidToken();

  const method = options.method || 'GET';

  const response = await api({
    url,
    method,
    data: options.body ? JSON.parse(options.body) : undefined,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  return response.data;
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      companies: [],
      subtotal: 0,
      deliveryFee: 0,  // ✅ always 0 in cart — real fee comes from checkout city lookup
      grandTotal: 0,   // ✅ same as subtotal in cart
      totalItems: 0,
      isLoading: false,
      isInitialized: false,
      isOpen: false,
      totalPrice: 0,

      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
      closeCart: () => set({ isOpen: false }),

      resetCart: () => {
        set({
          items: [],
          companies: [],
          subtotal: 0,
          deliveryFee: 0,
          grandTotal: 0,
          totalItems: 0,
          isLoading: false,
          isInitialized: false,
          isOpen: false,
          totalPrice: 0,
        });
      },

      calculateTotals: (items: CartItem[]) => {
        const subtotal = items.reduce(
          (sum, item) => sum + ((item.variantPrice ?? item.product.price) * item.quantity),
          0
        );
        const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

        // ✅ Delivery fee is NOT calculated here — it depends on the delivery area
        // chosen at checkout. The cart only shows item subtotal.
        const deliveryFee = 0;
        const grandTotal = subtotal; // grandTotal in cart = subtotal only

        const companyMap = new Map<string, CompanyCart>();
        items.forEach((item) => {
          if (!companyMap.has(item.company_id)) {
            companyMap.set(item.company_id, {
              id: item.company_id,
              name: item.company_name,
              items: [],
              total: 0,
            });
          }
          const companyCart = companyMap.get(item.company_id)!;
          companyCart.items.push(item);
          companyCart.total += (item.variantPrice ?? item.product.price) * item.quantity;
        });

        return {
          subtotal,
          totalItems,
          deliveryFee,
          grandTotal,
          companies: Array.from(companyMap.values()),
        };
      },

      syncCart: async () => {
        const { items } = get();
        try {
          const cartItems = items.map((item) => ({
            cart_item_id: item.id,
            product_id: item.productId,
            product_name: item.product.name,
            price: item.variantPrice ?? item.product.price,
            quantity: item.quantity,
            image_url: item.product.image_url,
            description: item.product.description,
            category: item.product.category,
            stock_quantity: item.product.stock_quantity,
            company_id: item.company_id,
            company_name: item.company_name,
            variant_label: item.variantLabel,
            variant_price: item.variantPrice,
          }));

          await fetchWithAuth('/cart/sync', {
            method: 'POST',
            body: JSON.stringify({ items: cartItems }),
          });
        } catch (error) {
          console.error('Error syncing cart:', error);
        }
      },

      loadCart: async () => {
        set({ isLoading: true });

        try {
          const data = await fetchWithAuth('/cart');

          if (data.items && data.items.length > 0) {
            const items: CartItem[] = data.items.map((item: any) => ({
              id: item.cart_item_id || `${item.product_id}-${item.variant_label || 'default'}`,
              productId: item.product_id,
              product: {
                id: item.product_id,
                name: item.product_name,
                price: item.price,
                image_url: item.image_url,
                description: item.description || '',
                category: item.category || '',
                stock_quantity: item.stock_quantity || 0,
                is_available: true,
                created_at: new Date().toISOString(),
                variants: [],
                base_price: null,
                company_id: item.company_id,
              },
              quantity: item.quantity,
              company_id: item.company_id,
              company_name: item.company_name,
              variantLabel: item.variant_label,
              variantPrice: item.variant_price,
            }));

            const { subtotal, totalItems, deliveryFee, grandTotal, companies } =
              get().calculateTotals(items);

            set({
              items,
              companies,
              subtotal,
              totalItems,
              deliveryFee,
              grandTotal,
              totalPrice: subtotal,
              isLoading: false,
              isInitialized: true,
            });
          } else {
            set({ isLoading: false, isInitialized: true });
          }
        } catch (error) {
          console.error('Error loading cart:', error);
          set({ isLoading: false, isInitialized: true });
        }
      },

      addItem: async (
        product: Product,
        companyId: string,
        companyName: string,
        variantLabel?: string,
        variantPrice?: number
      ) => {
        const currentItems = get().items;
        const finalPrice = variantPrice ?? product.base_price ?? product.price ?? 0;
        const uniqueId = variantLabel ? `${product.id}-${variantLabel}` : product.id;
        const existingItemIndex = currentItems.findIndex((item) => item.id === uniqueId);

        let updatedItems: CartItem[];

        if (existingItemIndex > -1) {
          updatedItems = currentItems.map((item, idx) =>
            idx === existingItemIndex ? { ...item, quantity: item.quantity + 1 } : item
          );
        } else {
          const newItem: CartItem = {
            id: uniqueId,
            productId: product.id,
            product: {
              ...product,
              price: finalPrice,
              name: variantLabel ? `${product.name} (${variantLabel})` : product.name,
            },
            quantity: 1,
            company_id: companyId,
            company_name: companyName,
            variantLabel,
            variantPrice: finalPrice,
          };
          updatedItems = [...currentItems, newItem];
        }

        const { subtotal, totalItems, deliveryFee, grandTotal, companies } =
          get().calculateTotals(updatedItems);

        set({
          items: updatedItems,
          companies,
          subtotal,
          totalItems,
          deliveryFee,
          grandTotal,
          totalPrice: subtotal,
        });

        get().syncCart().catch(console.error);
      },

      updateQuantity: async (itemId: string, quantity: number) => {
        const currentItems = get().items;
        const updatedItems =
          quantity <= 0
            ? currentItems.filter((item) => item.id !== itemId)
            : currentItems.map((item) =>
                item.id === itemId ? { ...item, quantity } : item
              );

        const { subtotal, totalItems, deliveryFee, grandTotal, companies } =
          get().calculateTotals(updatedItems);

        set({
          items: updatedItems,
          companies,
          subtotal,
          totalItems,
          deliveryFee,
          grandTotal,
          totalPrice: subtotal,
        });

        get().syncCart().catch(console.error);
      },

      removeItem: async (itemId: string) => {
        const updatedItems = get().items.filter((item) => item.id !== itemId);

        const { subtotal, totalItems, deliveryFee, grandTotal, companies } =
          get().calculateTotals(updatedItems);

        set({
          items: updatedItems,
          companies,
          subtotal,
          totalItems,
          deliveryFee,
          grandTotal,
          totalPrice: subtotal,
        });

        get().syncCart().catch(console.error);
      },

      clearCart: async () => {
        get().resetCart();
        get().syncCart().catch(console.error);
      },
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({
        items: state.items,
        subtotal: state.subtotal,
        totalPrice: state.totalPrice,
        totalItems: state.totalItems,
        deliveryFee: state.deliveryFee,
        grandTotal: state.grandTotal,
        companies: state.companies,
      }),
    }
  )
);