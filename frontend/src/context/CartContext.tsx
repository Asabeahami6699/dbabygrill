import React, { createContext, useContext, useEffect } from 'react';
import { useCartStore } from '../store/cartStore';
import { CartStore } from '../types/cart';

// Create context for backward compatibility
const CartContext = createContext<CartStore | undefined>(undefined);

// Custom hook to use cart
export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};

// Cart Provider component
export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cartStore = useCartStore();
  
  // Optional: Log cart changes for debugging
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('Cart updated:', {
        items: cartStore.items.length,
        totalItems: cartStore.totalItems,
        totalPrice: cartStore.totalPrice,
      });
    }
  }, [cartStore.items, cartStore.totalItems, cartStore.totalPrice]);
  
  return (
    <CartContext.Provider value={cartStore}>
      {children}
    </CartContext.Provider>
  );
};