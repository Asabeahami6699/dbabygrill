import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { useCartStore } from '../../store/cartStore';

export default function CartDrawer() {
  const { 
    isOpen, 
    closeCart, 
    items, 
    companies,
    subtotal,
    deliveryFee,
    grandTotal,
    totalItems,
    updateQuantity,
    removeItem,
    clearCart 
  } = useCartStore();

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeItem(itemId);
    } else {
      updateQuantity(itemId, newQuantity);
    }
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={closeCart}>
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-500"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-500"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-500 sm:duration-700"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-500 sm:duration-700"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-xl">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-6 border-b border-gray-200">
                      <Dialog.Title className="text-lg font-semibold text-gray-900">
                        Your Cart ({totalItems} {totalItems === 1 ? 'item' : 'items'})
                      </Dialog.Title>
                      <button
                        type="button"
                        className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                        onClick={closeCart}
                      >
                        <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                      </button>
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto py-6 px-4">
                      {items.length === 0 ? (
                        <div className="text-center py-12">
                          <div className="mb-4">
                            <svg 
                              className="w-24 h-24 mx-auto text-gray-400" 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={1.5} 
                                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" 
                              />
                            </svg>
                          </div>
                          <p className="text-gray-500 mb-4">Your cart is empty</p>
                          <button
                            onClick={closeCart}
                            className="text-orange-600 hover:text-orange-700 font-medium"
                          >
                            Continue Shopping
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {companies.map((company) => (
                            <div key={company.id} className="border-b border-gray-200 pb-4">
                              <h3 className="font-medium text-gray-900 mb-3">
                                {company.name}
                              </h3>
                              <div className="space-y-4">
                                {company.items.map((item) => (
                                  <div key={item.id} className="flex gap-3">
                                    {/* Product Image */}
                                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-gray-200">
                                      {item.product.image_url ? (
                                        <img
                                          src={item.product.image_url}
                                          alt={item.product.name}
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <div className="h-full w-full bg-gray-100 flex items-center justify-center">
                                          <span className="text-xs text-gray-400">No img</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Product Details */}
                                    <div className="flex-1">
                                      <div className="flex justify-between">
                                        <h4 className="text-sm font-medium text-gray-900">
                                          {item.product.name}
                                        </h4>
                                        <p className="text-sm font-medium text-gray-900">
                                          ${((item.product.price ?? 0) * item.quantity).toFixed(2)}
                                        </p>
                                      </div>
                                      <p className="mt-1 text-sm text-gray-500">
                                        ${(item.product.price ?? 0).toFixed(2)} each
                                      </p>
                                      
                                      {/* Quantity Controls */}
                                      <div className="flex items-center gap-2 mt-2">
                                        <button
                                          onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                          className="w-6 h-6 bg-gray-100 rounded-full hover:bg-gray-200 flex items-center justify-center"
                                        >
                                          -
                                        </button>
                                        <span className="text-sm w-6 text-center">{item.quantity}</span>
                                        <button
                                          onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                          className="w-6 h-6 bg-gray-100 rounded-full hover:bg-gray-200 flex items-center justify-center"
                                        >
                                          +
                                        </button>
                                        <button
                                          onClick={() => removeItem(item.id)}
                                          className="ml-2 text-xs text-red-600 hover:text-red-800"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-3 text-right">
                                <p className="text-sm text-gray-600">
                                  Subtotal: ${company.total.toFixed(2)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    {items.length > 0 && (
                      <div className="border-t border-gray-200 px-4 py-6">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Subtotal</span>
                            <span className="text-gray-900">${subtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Delivery Fee</span>
                            <span className="text-gray-900">${deliveryFee.toFixed(2)}</span>
                          </div>
                          {deliveryFee === 0 && subtotal > 50 && (
                            <p className="text-xs text-green-600 text-right">✨ Free delivery!</p>
                          )}
                          <div className="flex justify-between text-base font-medium pt-2 border-t">
                            <span className="text-gray-900">Total</span>
                            <span className="text-orange-600">${grandTotal.toFixed(2)}</span>
                          </div>
                        </div>
                        
                        <div className="mt-6 space-y-2">
                          <Link
                            to="/checkout"
                            onClick={closeCart}
                            className="w-full block text-center bg-orange-600 text-white px-4 py-3 rounded-lg hover:bg-orange-700 transition-colors font-medium"
                          >
                            Proceed to Checkout
                          </Link>
                          <button
                            onClick={clearCart}
                            className="w-full border border-red-600 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors text-sm"
                          >
                            Clear Cart
                          </button>
                          <button
                            onClick={closeCart}
                            className="w-full text-gray-500 py-2 hover:text-gray-700 transition-colors text-sm"
                          >
                            Continue Shopping
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}