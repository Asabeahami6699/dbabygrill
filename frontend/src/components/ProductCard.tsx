import { useCartStore } from '../store/cartStore';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { items, addItem, updateQuantity, removeItem } = useCartStore();

  // Use product.id as the cart item identifier (no variant support in this simple card)
  const cartItemId = product.id;
  const existingItem = items.find(item => item.id === cartItemId);
  const itemCount = existingItem?.quantity || 0;
  const isInCart = itemCount > 0;

  const handleAddToCart = () => {
    if (!product.company_id) {
      return;
    }
    addItem(
      product,
      product.company_id,
      product.company_name || 'Restaurant',
      undefined, // variantLabel – not used
      undefined  // variantPrice – will use product.price
    );
  };

  const handleUpdateQuantity = (newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(cartItemId);
    } else {
      updateQuantity(cartItemId, newQuantity);
    }
  };

  const displayPrice = product.price ?? product.base_price ?? 0;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      {/* Product Image */}
      <div className="h-48 overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-orange-400 to-orange-600 flex items-center justify-center">
            <span className="text-white text-4xl font-bold">
              {product.name.charAt(0)}
            </span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {product.name}
        </h3>
        <p className="text-2xl font-bold text-orange-600 mb-4">
          ${displayPrice.toFixed(2)}
        </p>

        {isInCart ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleUpdateQuantity(itemCount - 1)}
                className="w-8 h-8 bg-gray-100 rounded-full hover:bg-gray-200 flex items-center justify-center"
              >
                -
              </button>
              <span className="w-8 text-center font-medium">{itemCount}</span>
              <button
                onClick={() => handleUpdateQuantity(itemCount + 1)}
                className="w-8 h-8 bg-gray-100 rounded-full hover:bg-gray-200 flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleAddToCart}
            className="w-full bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
          >
            Add to Cart
          </button>
        )}
      </div>
    </div>
  );
}