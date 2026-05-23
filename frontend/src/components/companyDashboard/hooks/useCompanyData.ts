// frontend/src/pages/company/hooks/useCompanyData.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import { getValidToken } from '../../../api/authToken';
import { api } from '../../../services/apiClient';

// ---------- Types ----------
export interface Company {
  id: string;
  name: string;
  description: string;
  location: string;
  phone: string;
  email: string;
  logo?: string;
}

export interface Product {
  id: string;
  company_id?: string;
  name: string;
  description: string;
  price?: number;
  base_price?: number;
  variants?: Array<{ label: string; price: number }>;
  image_url: string;
  category: string;
  stock_quantity: number;
  is_available: boolean;
  is_promoted?: boolean;
  promo_rank?: number | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  special_instructions?: string;
  image_url?: string | null;
}

export interface Order {
  id: string;
  user_id: string;
  company_id: string;
  order_number: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' |'out_for_delivery'| 'cancelled';
  total_amount: number;
  subtotal: number;
  delivery_fee: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  updated_at?: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  special_instructions?: string;
  delivery_guy_id?: string;
  order_items: OrderItem[];
}

// ---------- Auth fetch ----------
const fetchWithAuth = async (
  url: string,
  options: any = {}
): Promise<any> => {
  const token = await getValidToken();

  try {
    const response = await api({
      url,
      method: options.method || 'GET',
      data: options.body
        ? JSON.parse(options.body)
        : undefined,
      headers: {
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    return response.data;
  } catch (error: any) {
    const msg =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message;

    throw new Error(msg);
  }
};

const isSessionError = (err: any) =>
  err?.message?.includes('No active session') ||
  err?.message?.includes('Auth session missing') ||
  err?.message?.includes('expired') ||
  err?.message?.includes('log in');

const isRateLimitError = (err: any) =>
  err?.message?.includes('429') ||
  err?.message?.toLowerCase?.().includes('too many requests');

// ---------- Hook ----------
export function useCompanyData() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [company, setCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const loadInProgressRef = useRef(false);

  const handleError = useCallback(
    (err: any, context: string) => {
      console.error(`[useCompanyData] ${context}:`, err);
      if (isRateLimitError(err)) {
        setError('Too many requests. Please wait and retry.');
        toast.error('Too many requests. Please wait and retry.');
        return;
      }
      if (isSessionError(err)) {
        if (user) {
          setError('Session is stabilizing. Please refresh.');
          return;
        }
        toast.error('Session expired. Please log in again.');
        navigate('/login');
        return;
      }
      setError(`Failed to ${context}`);
      toast.error(`Failed to ${context}`);
    },
    [navigate, user?.id]
  );

  const loadAllData = useCallback(async () => {
    if (loadInProgressRef.current || !isMountedRef.current || !user) {
      return;
    }

    loadInProgressRef.current = true;

    if (isMountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const [companyRes, productsRes, ordersRes] = await Promise.allSettled([
        fetchWithAuth('/company/profile'),
        fetchWithAuth('/company/products'),
        fetchWithAuth('/company/orders'),
      ]);

      if (!isMountedRef.current) return;

      if (companyRes.status === 'fulfilled' && companyRes.value) {
        setCompany(companyRes.value);
      } else if (companyRes.status === 'rejected') {
        handleError(companyRes.reason, 'load company profile');
      }

      if (productsRes.status === 'fulfilled') {
        setProducts(productsRes.value || []);
      } else if (productsRes.status === 'rejected') {
        handleError(productsRes.reason, 'load products');
      }

      if (ordersRes.status === 'fulfilled') {
        setOrders(ordersRes.value || []);
      } else if (ordersRes.status === 'rejected') {
        handleError(ordersRes.reason, 'load orders');
      }
    } catch (err: any) {
      if (isMountedRef.current) handleError(err, 'load dashboard data');
    } finally {
      if (isMountedRef.current) setLoading(false);
      loadInProgressRef.current = false;
    }
  }, [handleError, user]);

  useEffect(() => {
    isMountedRef.current = true;

    if (authLoading) {
      return;
    }

    if (!user) {
      if (isMountedRef.current) setLoading(false);
      navigate('/login');
      return;
    }

    loadAllData();

    return () => {
      isMountedRef.current = false;
    };
  }, [user?.id, authLoading]);

  const refreshData = useCallback(async () => {
    loadInProgressRef.current = false;
    await loadAllData();
  }, [loadAllData]);

  return {
    company,
    products,
    orders,
    loading,
    error,
    refreshData,
    refreshDataImmediate: refreshData,
  };
}
