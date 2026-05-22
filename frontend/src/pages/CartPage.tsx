import { Link, useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';

export default function CartPage() {
  const navigate = useNavigate();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isSubtotalSticky, setIsSubtotalSticky] = useState(false);
  const subtotalRef = useRef<HTMLDivElement>(null);
  const { 
    items, 
    companies,
    subtotal,
    deliveryFee,
    grandTotal,
    totalItems,
    updateQuantity,
    removeItem,
    clearCart,
    isLoading
  } = useCartStore();

  // Handle sticky subtotal on mobile
  useEffect(() => {
    const handleScroll = () => {
      if (subtotalRef.current) {
        const rect = subtotalRef.current.getBoundingClientRect();
        setIsSubtotalSticky(rect.top <= 80);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleQuantityChange = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      await removeItem(itemId);
      toast.success('Item removed from cart');
    } else {
      await updateQuantity(itemId, newQuantity);
      toast.success('Quantity updated');
    }
  };

  const handleProceedToCheckout = async () => {
    setIsCheckingOut(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      navigate('/checkout');
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleClearCart = async () => {
    if (confirm('Are you sure you want to clear your cart?')) {
      await clearCart();
      toast.success('Cart cleared');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  // Empty cart state
  if (items.length === 0) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="text-center max-w-md mx-auto">
          <div className="mb-8">
            <svg 
              className="w-32 h-32 sm:w-40 sm:h-40 mx-auto text-gray-300" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1} 
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" 
              />
            </svg>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
            Your cart is empty
          </h2>
          <p className="text-gray-500 mb-8 text-sm sm:text-base">
            Looks like you haven't added any items to your cart yet. Start exploring our delicious menu!
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-orange-600 text-white px-6 py-3 rounded-xl hover:bg-orange-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Browse Restaurants
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        {/* Page Header */}
        <div className="mb-6 sm:mb-8 lg:mb-12">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
            Shopping Cart
          </h1>
          <p className="text-sm sm:text-base text-gray-500">
            You have <span className="font-semibold text-orange-600">{totalItems}</span> {totalItems === 1 ? 'item' : 'items'} in your cart
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left Column - Cart Items */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {companies.map((company) => (
              <div key={company.id} className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Company Header */}
                <div className="bg-gradient-to-r from-orange-50 to-white px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                        {company.name}
                      </h2>
                    </div>
                    <Link 
                      to={`/store/${company.id}`}
                      className="text-xs sm:text-sm text-orange-600 hover:text-orange-700 font-medium"
                    >
                      View Restaurant →
                    </Link>
                  </div>
                </div>

                {/* Items List - Mobile Optimized */}
                <div className="divide-y divide-gray-100">
                  {company.items.map((item) => (
                    <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors duration-200">
                      {/* Mobile Layout: Horizontal with image on left */}
                      <div className="flex gap-3">
                        {/* Product Image - Smaller on mobile */}
                        <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          {item.product.image_url ? (
                            <img
                              src={item.product.image_url}
                              alt={item.product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-orange-200">
                              <svg className="w-6 h-6 sm:w-8 sm:h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Product Details - Right side */}
                        <div className="flex-1 min-w-0">
                          {/* Name and Price Row */}
                          <div className="flex justify-between items-start gap-2 mb-1">
                            <h3 className="text-sm sm:text-base font-semibold text-gray-900 line-clamp-2 flex-1">
                              {item.product.name}
                            </h3>
                            <p className="text-base sm:text-lg font-bold text-orange-600 whitespace-nowrap">
                              ₵{(item.product.price * item.quantity).toFixed(2)}
                            </p>
                          </div>
                          
                          {/* Description - Only show on larger screens */}
                          <p className="text-xs text-gray-500 line-clamp-2 mb-2 hidden sm:block">
                            {item.product.description || 'Delicious dish from our kitchen'}
                          </p>
                          
                          {/* Price per item */}
                          <p className="text-xs text-gray-400 mb-2">
                            ₵{item.product.price.toFixed(2)} each
                          </p>

                          {/* Quantity Controls and Remove Button - Horizontal layout */}
                          <div className="flex items-center justify-between gap-2 mt-2">
                            <div className="flex items-center gap-2">
                              {/* Minus Button */}
                              <button
                                onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-100 hover:bg-gray-200 rounded-full transition-all duration-200 flex items-center justify-center active:scale-95"
                                aria-label="Decrease quantity"
                              >
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                </svg>
                              </button>
                              
                              {/* Quantity Display */}
                              <span className="w-8 text-center font-semibold text-gray-900 text-sm sm:text-base">
                                {item.quantity}
                              </span>
                              
                              {/* Plus Button */}
                              <button
                                onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-100 hover:bg-gray-200 rounded-full transition-all duration-200 flex items-center justify-center active:scale-95"
                                aria-label="Increase quantity"
                              >
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                            </div>
                            
                            {/* Remove Button */}
                            <button
                              onClick={() => handleQuantityChange(item.id, 0)}
                              className="flex items-center gap-1 px-2 py-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200 text-xs font-medium"
                            >
                              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span className="hidden xs:inline">Remove</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Company Subtotal - Mobile Optimized */}
                <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center border-t border-gray-100">
                  <span className="text-sm sm:text-base text-gray-600">Subtotal</span>
                  <span className="font-bold text-gray-900 text-base sm:text-lg">
                    ₵{company.total.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column - Order Summary with Sticky on Mobile */}
          <div className="lg:col-span-1">
            {/* Mobile Sticky Subtotal */}
            <div 
              ref={subtotalRef}
              className={`lg:hidden bg-white rounded-xl shadow-lg border border-gray-100 p-4 mb-4 transition-all duration-300 ${
                isSubtotalSticky ? 'fixed top-16 left-0 right-0 mx-4 z-40 shadow-xl' : ''
              }`}
              style={isSubtotalSticky ? { width: 'calc(100% - 2rem)' } : {}}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-500">Total Items: {totalItems}</p>
                  <p className="text-sm font-semibold text-gray-900">Total: ₵{grandTotal.toFixed(2)}</p>
                </div>
                <button
                  onClick={handleProceedToCheckout}
                  disabled={isCheckingOut}
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {isCheckingOut ? 'Processing...' : 'Checkout'}
                </button>
              </div>
            </div>

            {/* Desktop Order Summary */}
            <div className="hidden lg:block bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 sticky top-24">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">
                Order Summary
              </h2>

              <div className="space-y-3 sm:space-y-4">
                <div className="flex justify-between text-sm sm:text-base text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-medium">₵{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm sm:text-base text-gray-600">
                  <span>Delivery Fee</span>
                  <span className="text-xs text-gray-400 italic">Calculated at checkout</span>
                </div>
                
                <div className="border-t border-gray-200 pt-3 sm:pt-4 mt-3 sm:mt-4">
                  <div className="flex justify-between items-baseline">
                    <span className="text-base sm:text-lg font-semibold text-gray-900">Total</span>
                    <span className="text-xl sm:text-2xl font-bold text-orange-600">₵{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Proceed to Checkout Button */}
              <button
                onClick={handleProceedToCheckout}
                disabled={isCheckingOut}
                className="w-full bg-orange-600 text-white py-3 sm:py-3.5 rounded-xl hover:bg-orange-700 transition-all duration-200 font-semibold mt-6 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-sm sm:text-base"
              >
                {isCheckingOut ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </div>
                ) : (
                  'Proceed to Checkout'
                )}
              </button>

              {/* Continue Shopping Link */}
              <Link
                to="/"
                className="w-full block text-center text-gray-600 py-2 sm:py-3 hover:text-orange-600 transition-colors mt-2 text-sm sm:text-base font-medium"
              >
                ← Continue Shopping
              </Link>

              {/* Clear Cart Link */}
              <button
                onClick={handleClearCart}
                className="w-full text-gray-400 hover:text-red-600 transition-colors text-xs sm:text-sm py-2"
              >
                Clear Cart
              </button>

              {/* Delivery Information */}
              <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-100">
                <div className="flex items-start gap-2 sm:gap-3 text-xs sm:text-sm text-gray-500">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Estimated delivery: 30-45 minutes</span>
                </div>
                <div className="flex items-start gap-2 sm:gap-3 text-xs sm:text-sm text-gray-500 mt-2 sm:mt-3">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Free delivery on orders over ₵50</span>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-100">
                <p className="text-xs text-gray-400 text-center">Secure payment</p>
                <div className="flex justify-center gap-2 sm:gap-3 mt-2 sm:mt-3">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/>
                  </svg>
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                  </svg>
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15h-1v-6h1v6zm-.5-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add extra padding for mobile sticky footer */}
      <div className="h-20 lg:h-0"></div>

      <style>{`
        @media (max-width: 1023px) {
          .fixed {
            animation: slideDown 0.3s ease-out;
          }
        }
        
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}