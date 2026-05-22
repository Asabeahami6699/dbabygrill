import React, { useEffect, useMemo, useState } from 'react';
import { Product } from './hooks/useCompanyData';
import { toast } from 'react-hot-toast';
import { api } from '../../services/apiClient'
import { getValidToken } from '../../api/authToken';

interface ProductsManagementProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onRefresh: () => void;
}

const fetchWithAuth = async (
  url: string,
  options: any = {}
) => {
  const token = await getValidToken();

  const { data } = await api({
    url,
    method: options.method || 'GET',
    data: options.body ? JSON.parse(options.body) : undefined,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  return data;
};

export default function ProductsManagement({ products, onEdit, onRefresh }: ProductsManagementProps) {
  const [promoRankDraftById, setPromoRankDraftById] = useState<Record<string, string>>({});
  const [ratingsByProductId, setRatingsByProductId] = useState<Record<
    string,
    {
      averageRating: number;
      totalReviews: number;
      lowRatings: Array<{ id: string; rating: number; reviewText: string | null; customerName: string; createdAt: string }>;
    }
  >>({});

  const companyId = useMemo(() => products[0]?.company_id, [products]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;

    const fetchProductRatings = async () => {
      try {
        const data = await fetchWithAuth(`/orders/reviews/company/${companyId}/products`);
        if (cancelled) return;
        const nextMap: Record<string, any> = {};
        (data?.products || []).forEach((p: any) => {
          nextMap[p.productId] = p;
        });
        setRatingsByProductId(nextMap);
      } catch (error) {
        console.error('Error loading product ratings:', error);
      }
    };

    fetchProductRatings();
    return () => {
      cancelled = true;
    };
  }, [companyId, products.length]);

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await fetchWithAuth(`/company/products/${productId}`, { method: 'DELETE' });
      toast.success('Product deleted successfully!');
      onRefresh();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast.error(error.message || 'Failed to delete product');
    }
  };

  const handleToggleAvailability = async (product: Product) => {
    try {
      await fetchWithAuth(`/company/products/${product.id}/toggle-availability`, { method: 'PATCH' });
      toast.success(`Product ${!product.is_available ? 'available' : 'unavailable'}`);
      onRefresh();
    } catch (error: any) {
      console.error('Error toggling product status:', error);
      toast.error(error.message || 'Failed to update product status');
    }
  };

  const handleUpdatePromotion = async (productId: string, payload: { is_promoted?: boolean; promo_rank?: number | null }) => {
    try {
      await fetchWithAuth(`/company/products/${productId}/promotion`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      toast.success('Promotion updated');
      try {
        new BroadcastChannel('products-updated').postMessage({ type: 'products-updated' });
        localStorage.setItem('products-updated', String(Date.now()));
      } catch {
        // ignore cross-tab signalling errors (e.g. unsupported env)
      }
      setPromoRankDraftById((prev) => {
        const { [productId]: _removed, ...rest } = prev;
        return rest;
      });
      onRefresh();
    } catch (error: any) {
      console.error('Error updating promotion:', error);
      toast.error(error.message || 'Failed to update promotion');
    }
  };

  // Helper to display price information
  const getPriceDisplay = (product: Product) => {
    if (product.variants && product.variants.length > 0) {
      const prices = product.variants.map(v => v.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      if (minPrice === maxPrice) return `₵${minPrice.toFixed(2)}`;
      return `₵${minPrice.toFixed(2)} - ₵${maxPrice.toFixed(2)}`;
    }
    if (product.base_price) return `₵${product.base_price.toFixed(2)}`;
    if (product.price) return `₵${product.price.toFixed(2)}`;
    return 'Price not set';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Menu Items</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
        {products.map(product => (
          <div key={product.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-32 sm:h-48 object-cover" />
            ) : (
              <div className="w-full h-32 sm:h-48 bg-gradient-to-r from-orange-400 to-orange-600 flex items-center justify-center">
                <span className="text-white text-2xl sm:text-4xl font-bold">{product.name.charAt(0)}</span>
              </div>
            )}
            <div className="p-2 sm:p-4">
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-sm sm:text-base truncate">{product.name}</h3>
                <button
                  onClick={() => handleToggleAvailability(product)}
                  className={`px-1.5 sm:px-2 py-0.5 rounded-full text-xs ${
                    product.is_available && product.stock_quantity > 0
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {product.is_available && product.stock_quantity > 0 ? 'In Stock' : 'Out of Stock'}
                </button>
              </div>
              <p className="text-orange-600 font-bold text-sm sm:text-base mt-1">{getPriceDisplay(product)}</p>
              <p className="text-xs text-gray-500">Stock: {product.stock_quantity}</p>
              <p className="text-xs text-gray-400 mt-1 truncate">{product.category || 'Uncategorized'}</p>
              <p className="text-xs text-gray-500 mt-1">
                Rating: {ratingsByProductId[product.id]?.totalReviews
                  ? `${ratingsByProductId[product.id].averageRating.toFixed(1)} / 5 (${ratingsByProductId[product.id].totalReviews})`
                  : 'No ratings yet'}
              </p>
              {product.variants && product.variants.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  {product.variants.length} size{product.variants.length !== 1 ? 's' : ''}
                </p>
              )}
              {(ratingsByProductId[product.id]?.lowRatings?.length || 0) > 0 && (
                <div className="mt-2 p-2 rounded-lg bg-red-50 border border-red-100">
                  <p className="text-[11px] font-semibold text-red-700 mb-1">Recent low rating feedback</p>
                  {ratingsByProductId[product.id].lowRatings.slice(0, 2).map((r) => (
                    <p key={r.id} className="text-[11px] text-red-700 line-clamp-2">
                      {r.rating}/5 - {r.reviewText || 'No comment'} ({r.customerName})
                    </p>
                  ))}
                </div>
              )}

              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleUpdatePromotion(product.id, { is_promoted: !product.is_promoted })}
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    product.is_promoted ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'
                  }`}
                  title="Toggle promotion on landing page"
                >
                  {product.is_promoted ? 'Promoted' : 'Not Promoted'}
                </button>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-400">Rank</span>
                  <input
                    type="number"
                    min={0}
                    value={promoRankDraftById[product.id] ?? (product.promo_rank ?? '').toString()}
                    onChange={(e) =>
                      setPromoRankDraftById((prev) => ({ ...prev, [product.id]: e.target.value }))
                    }
                    onBlur={() => {
                      const raw = promoRankDraftById[product.id];
                      if (raw === undefined) return;
                      const nextRank = raw.trim() === '' ? null : Number(raw);
                      if (Number.isNaN(nextRank as any)) return;
                      handleUpdatePromotion(product.id, { promo_rank: nextRank });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="w-16 px-2 py-1 text-xs border rounded-md"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-2">
                <button onClick={() => onEdit(product)} className="text-blue-600 text-xs hover:text-blue-800">
                  Edit
                </button>
                <button onClick={() => handleDeleteProduct(product.id)} className="text-red-600 text-xs hover:text-red-800">
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {products.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <p className="text-gray-500">No menu items yet. Click "Add Item" to get started.</p>
        </div>
      )}
    </div>
  );
}