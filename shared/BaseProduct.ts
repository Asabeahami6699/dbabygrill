// shared/src/Product.ts
export interface BaseProduct {
  id: string;
  name: string;
  description: string;
  image_url: string;
  category: string;
  stock_quantity: number;
  is_available: boolean;
  company_id: string;
  created_at: string;
}

export interface ProductVariant {
  label: string;
  price: number;
}

export interface Product extends BaseProduct {
  variants: ProductVariant[];
  base_price?: number;   // for combos without variants
}