import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

// PUBLIC - Get all available products
router.get('/products', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        description,
        price,
        base_price,
        variants,
        image_url,
        category,
        stock_quantity,
        is_available,
        is_promoted,
        promo_rank,
        companies (
          id,
          name,
          location,
          logo
        )
      `)
      .eq('is_available', true)
      .gt('stock_quantity', 0)
      .order('is_promoted', { ascending: false })
      .order('promo_rank', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching public products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// PUBLIC - Get single product by ID
router.get('/products/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        description,
        price,
        base_price,
        variants,
        image_url,
        category,
        stock_quantity,
        is_available,
        is_promoted,
        promo_rank,
        companies (
          id,
          name,
          location,
          logo,
          phone,
          email
        )
      `)
      .eq('id', id)
      .eq('is_available', true)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Product not found' });

    res.json(data);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// PUBLIC - Get products by company
router.get('/companies/:companyId/products', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;

    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        description,
        price,
        base_price,
        variants,
        image_url,
        category,
        stock_quantity,
        is_available,
        is_promoted,
        promo_rank,
        companies (
          id,
          name,
          location,
          logo
        )
      `)
      .eq('company_id', companyId)
      .eq('is_available', true)
      .gt('stock_quantity', 0)
      .order('is_promoted', { ascending: false })
      .order('promo_rank', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching company products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

export default router;