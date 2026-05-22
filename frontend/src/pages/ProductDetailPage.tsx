import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';
import { toast } from 'react-hot-toast';
import { Product } from '../types';
import { api } from '../services/apiClient';

interface ProductVariant {
  label: string;
  price: number;
}

interface ProductDetail {
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
  company_id: string;
  companies?: {
    id: string;
    name: string;
    location: string;
    logo?: string;
    phone?: string;
    email?: string;
  };
}

interface PublicReview {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  // Owner reply fields — present when the restaurant has responded
  owner_response?: string | null;
  owner_responded_at?: string | null;
  orders?: {
    order_number?: string;
    customer_name?: string | null;
  } | null;
}

function StarRow({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' }) {
  const starClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <div className="flex gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className={`${starClass} ${s <= rating ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function OwnerReply({
  response,
  respondedAt,
  restaurantName,
}: {
  response: string;
  respondedAt?: string | null;
  restaurantName?: string;
}) {
  const date = respondedAt
    ? new Date(respondedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : '';

  return (
    <div className="mt-3 ml-2 pl-4 border-l-2 border-orange-300 bg-orange-50 rounded-r-xl py-3 pr-4">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        {/* Restaurant badge */}
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <span className="text-xs font-semibold text-orange-700">
            {restaurantName ? `${restaurantName}` : 'Restaurant'}{' '}
            <span className="font-normal text-orange-600">replied</span>
          </span>
        </div>
        {date && <span className="text-xs text-orange-400 ml-auto">{date}</span>}
      </div>
      <p className="text-sm text-orange-950 whitespace-pre-wrap leading-relaxed">{response}</p>
    </div>
  );
}

export default function ProductDetailPage() {
  const { companyId, productId } = useParams();
  const navigate = useNavigate();
  const addToCart = useCartStore((state) => state.addItem);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [reviewStats, setReviewStats] = useState<{ average: number; total: number } | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  useEffect(() => {
    fetchProduct();
  }, [productId]);

 const fetchProduct = async () => {
  try {
    const response = await api.get(`/products/${productId}`);

    const data = response.data;

    setProduct(data);

    if (data.variants && data.variants.length > 0) {
      setSelectedVariant(data.variants[0]);
    }
  } catch (error) {
    console.error('Error fetching product:', error);

    toast.error('Product not found');

    navigate('/');
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
  if (!product?.id) return;

  let cancelled = false;

  const loadReviews = async () => {
    setReviewsLoading(true);

    try {
      const response = await api.get(
        `/orders/reviews/product/${product.id}/public`
      );

      const data = response.data;

      if (cancelled) return;

      setReviews(data.reviews || []);

      setReviewStats({
        average: data.averageRating ?? 0,
        total: data.totalReviews ?? 0,
      });
    } catch (e) {
      console.error('Failed to load reviews', e);
    } finally {
      if (!cancelled) {
        setReviewsLoading(false);
      }
    }
  };

  loadReviews();

  return () => {
    cancelled = true;
  };
}, [product?.id]);

  const handleAddToCart = async () => {
    if (!product) return;
    const finalPrice = selectedVariant?.price ?? product.base_price ?? product.price ?? 0;
    const variantLabel = selectedVariant?.label;
    setAdding(true);
    try {
      const productForCart: Product = {
        id: product.id,
        name: product.name,
        description: product.description,
        price: finalPrice,
        image_url: product.image_url,
        category: product.category,
        stock_quantity: product.stock_quantity,
        is_available: product.is_available,
        created_at: new Date().toISOString(),
        variants: [],
        base_price: product.base_price ?? null,
        company_id: product.company_id,
      };
      await addToCart(
        productForCart,
        product.company_id,
        product.companies?.name || 'Restaurant',
        variantLabel,
        finalPrice
      );
      toast.success(`${product.name}${variantLabel ? ` (${variantLabel})` : ''} added to cart!`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add to cart');
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!product) return null;

  const displayPrice = selectedVariant?.price ?? product.base_price ?? product.price ?? 0;
  const hasVariants = product.variants && product.variants.length > 0;
  const company = product.companies;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="mb-4 text-orange-600 hover:text-orange-700">
        ← Back
      </button>
      <div className="grid md:grid-cols-2 gap-8">
        {/* Image */}
        <div className="bg-gray-100 rounded-lg overflow-hidden">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-auto object-cover" />
          ) : (
            <div className="w-full aspect-square bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
              <span className="text-white text-6xl font-bold">{product.name.charAt(0)}</span>
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
          {reviewStats && reviewStats.total > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StarRow rating={Math.round(reviewStats.average)} />
              <span className="text-sm text-gray-600">
                {reviewStats.average.toFixed(1)} ({reviewStats.total}{' '}
                {reviewStats.total === 1 ? 'review' : 'reviews'})
              </span>
            </div>
          )}
          <p className="text-gray-600 mt-2">{product.description}</p>

          {hasVariants ? (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Size</label>
              <select
                value={selectedVariant?.label}
                onChange={(e) => {
                  const variant = product.variants.find((v) => v.label === e.target.value);
                  setSelectedVariant(variant || null);
                }}
                className="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-600"
              >
                {product.variants.map((v) => (
                  <option key={v.label} value={v.label}>
                    {v.label} – ₵{v.price}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-2xl font-bold text-orange-600">₵{displayPrice.toFixed(2)}</p>
            </div>
          )}

          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-8 h-8 bg-gray-100 rounded-full"
              >
                -
              </button>
              <span className="w-8 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-8 h-8 bg-gray-100 rounded-full"
              >
                +
              </button>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={adding}
              className="flex-1 bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Add to Cart'}
            </button>
          </div>

          {company && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-semibold text-gray-900">Restaurant Info</h3>
              <p className="text-gray-600">{company.name}</p>
              <p className="text-gray-500 text-sm">{company.location}</p>
              {company.phone && <p className="text-gray-500 text-sm">{company.phone}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Product reviews */}
      <section className="mt-12 border-t pt-8">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Customer reviews</h2>
        <p className="text-sm text-gray-500 mb-6">
          Ratings specifically for this meal from customers who ordered it.
        </p>

        {reviewsLoading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
          </div>
        )}

        {!reviewsLoading && !reviews.length && (
          <p className="text-gray-500 text-sm">
            No reviews yet. Be the first to order and share your experience.
          </p>
        )}

        {!reviewsLoading && reviews.length > 0 && (
          <ul className="space-y-5">
            {reviews.map((r) => {
              const name = r.orders?.customer_name?.trim();
              const displayName = name ? name.split(/\s+/)[0] : 'Customer';
              const date = r.created_at
                ? new Date(r.created_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : '';
              const hasReply = !!r.owner_response?.trim();

              return (
                <li key={r.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  {/* Customer review */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <StarRow rating={r.rating} size="sm" />
                      <span className="text-sm font-medium text-gray-900">{displayName}</span>
                    </div>
                    {date && <span className="text-xs text-gray-400">{date}</span>}
                  </div>
                  {r.review_text && (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.review_text}</p>
                  )}

                  {/* Owner reply — shown indented below the review */}
                  {hasReply && (
                    <OwnerReply
                      response={r.owner_response!}
                      respondedAt={r.owner_responded_at}
                      restaurantName={company?.name}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}