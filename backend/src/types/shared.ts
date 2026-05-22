// copied from shared package — no longer a workspace dependency

export interface BaseUser {
    id: string;
    role: "admin" | "company_admin" | "customer";
  }
  
  export interface BaseCompany {
    id: string;
    name: string;
  }
  
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
    base_price?: number;
  }