import React, { useState, useRef, useEffect } from 'react';
import { Product } from './hooks/useCompanyData';
import { toast } from 'react-hot-toast';
import { api } from '../../services/apiClient';
import { getValidToken } from '../../api/authToken';

interface ProductVariant {
  label: string;
  price: number;
}

interface Category {
  id: string;
  name: string;
}

interface ProductModalProps {
  isOpen: boolean;
  editingProduct: Product | null;
  companyId: string | undefined;
  onClose: () => void;
  onSuccess: () => void;
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

export default function ProductModal({ isOpen, editingProduct, companyId, onClose, onSuccess }: ProductModalProps) {
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [stockQuantity, setStockQuantity] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>([{ label: '', price: 0 }]);
  const [basePrice, setBasePrice] = useState('');

  // Fetch categories when modal opens
  useEffect(() => {
    if (isOpen && companyId) {
      fetchCategories();
    }
  }, [isOpen, companyId]);

  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name || '');
      setDescription(editingProduct.description || '');
      // Find category ID by name
      const found = categories.find(c => c.name === editingProduct.category);
      setCategoryId(found?.id || '');
      setStockQuantity(editingProduct.stock_quantity?.toString() || '');
      setImageUrl(editingProduct.image_url || '');
      const hasVar = editingProduct.variants && editingProduct.variants.length > 0;
      setHasVariants(hasVar);
      if (hasVar) {
        setVariants(editingProduct.variants!);
        setBasePrice('');
      } else {
        setVariants([{ label: '', price: 0 }]);
        setBasePrice(editingProduct.base_price?.toString() || editingProduct.price?.toString() || '');
      }
    } else {
      // Reset for new product
      setName('');
      setDescription('');
      setCategoryId('');
      setStockQuantity('');
      setImageUrl('');
      setHasVariants(false);
      setVariants([{ label: '', price: 0 }]);
      setBasePrice('');
    }
  }, [editingProduct, categories]);

  const fetchCategories = async () => {
    try {
      const data = await fetchWithAuth('/company/categories');
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load categories');
    }
  };

  const addVariant = () => setVariants([...variants, { label: '', price: 0 }]);
  const removeVariant = (index: number) => setVariants(variants.filter((_, i) => i !== index));
  const updateVariant = (index: number, field: keyof ProductVariant, value: string | number) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    setVariants(updated);
  };

  const handleImageUpload = async (file: File) => {
  if (!file) return null;

  setUploadingImage(true);

  try {
    const token = await getValidToken();

    const formData = new FormData();
    formData.append('image', file);
    formData.append('companyId', companyId || '');

    const { data } = await api.post(
      '/company/products/upload-image',
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return data.imageUrl;

  } catch (error: any) {
    console.error('Error uploading image:', error);

    toast.error(
      error?.response?.data?.error ||
      error?.message ||
      'Failed to upload image'
    );

    return null;

  } finally {
    setUploadingImage(false);
  }
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Get the category name from selected ID
      const selectedCategory = categories.find(c => c.id === categoryId);
      if (!selectedCategory) {
        toast.error('Please select a category');
        setLoading(false);
        return;
      }

      let productData: any = {
        name,
        description,
        category: selectedCategory.name,
        stock_quantity: parseInt(stockQuantity),
        image_url: imageUrl,
      };

      if (hasVariants) {
        const validVariants = variants.filter(v => v.label.trim() !== '' && v.price > 0);
        if (validVariants.length === 0) {
          toast.error('Please add at least one valid variant');
          setLoading(false);
          return;
        }
        productData.variants = validVariants;
        productData.base_price = null;
      } else {
        if (!basePrice || parseFloat(basePrice) <= 0) {
          toast.error('Please enter a valid base price');
          setLoading(false);
          return;
        }
        productData.base_price = parseFloat(basePrice);
        productData.variants = [];
      }

      const url = editingProduct ? `/company/products/${editingProduct.id}` : '/company/products';
      const method = editingProduct ? 'PUT' : 'POST';
      await fetchWithAuth(url, { method, body: JSON.stringify(productData) });

      toast.success(`Product ${editingProduct ? 'updated' : 'created'} successfully!`);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving product:', error);
      toast.error(error.message || `Failed to ${editingProduct ? 'update' : 'create'} product`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg sm:text-xl font-bold mb-4">
          {editingProduct ? 'Edit Item' : 'Add New Item'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <input
            type="text"
            placeholder="Item Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />

          {/* Category dropdown */}
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">Select category</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          <input
            type="number"
            placeholder="Stock Quantity"
            value={stockQuantity}
            onChange={(e) => setStockQuantity(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-lg text-sm no-number-spin"
          />

          {/* Variant toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="hasVariants"
              checked={hasVariants}
              onChange={(e) => setHasVariants(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="hasVariants" className="text-sm font-medium text-gray-700">
              This product has variants (sizes/portions)
            </label>
          </div>

          {hasVariants ? (
            <div className="space-y-3 border rounded-lg p-3 bg-gray-50">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-semibold">Variants (Size / Portion)</h4>
                <button
                  type="button"
                  onClick={addVariant}
                  className="text-xs bg-orange-600 text-white px-2 py-1 rounded hover:bg-orange-700"
                >
                  + Add Variant
                </button>
              </div>
              {variants.map((variant, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Label (e.g., Small)"
                    value={variant.label}
                    onChange={(e) => updateVariant(idx, 'label', e.target.value)}
                    className="flex-1 px-2 py-1 border rounded text-sm"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Price (₵)"
                    value={variant.price}
                    onChange={(e) => updateVariant(idx, 'price', parseFloat(e.target.value) || 0)}
                    className="w-28 px-2 py-1 border rounded text-sm no-number-spin"
                  />
                  {variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVariant(idx)}
                      className="text-red-600 hover:text-red-800"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {variants.length === 0 && (
                <p className="text-xs text-gray-500">Click "Add Variant" to add sizes/portions.</p>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base Price (₵)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g., 360"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                required={!hasVariants}
                className="w-full px-3 py-2 border rounded-lg text-sm no-number-spin"
              />
              <p className="text-xs text-gray-500 mt-1">For combos or products without size options.</p>
            </div>
          )}

          {/* Image Upload Section */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Product Image</label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = await handleImageUpload(file);
                    if (url) {
                      setImageUrl(url);
                      toast.success('Image uploaded successfully!');
                    }
                  }
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {uploadingImage ? 'Uploading...' : 'Choose Image'}
              </button>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="px-2 py-1 text-red-600 text-sm"
                >
                  Remove
                </button>
              )}
            </div>
            {imageUrl && (
              <div className="mt-2">
                <img src={imageUrl} alt="Preview" className="w-32 h-32 object-cover rounded-lg border" />
              </div>
            )}
            <input
              type="text"
              placeholder="Or enter image URL"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading || uploadingImage}
              className="flex-1 bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 text-sm disabled:opacity-50"
            >
              {loading ? 'Saving...' : (editingProduct ? 'Update' : 'Create')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}