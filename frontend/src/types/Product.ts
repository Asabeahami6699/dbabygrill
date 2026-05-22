// frontend/src/types/Product.ts
export interface ProductVariant {
  label: string;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  image_url: string;
  category: string;
  stock_quantity: number;
  is_available: boolean;
  company_id: string;
  company_name?: string;
  created_at?: string;
  variants: ProductVariant[];
  base_price?: number;   // for combos without variants
  price?: number;        // legacy, kept for compatibility (some existing code may use product.price)
}