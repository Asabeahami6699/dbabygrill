import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { supabase } from '../config/supabase';

const router = Router();

// GET - Get user's cart
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('carts')
      .select('*')
      .eq('user_id', req.user?.id)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({ items: data?.items || [] });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// POST - Sync cart (create or update)
router.post('/sync', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { items } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if cart exists
    const { data: existingCart } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (existingCart) {
      // Update existing cart
      const { error } = await supabase
        .from('carts')
        .update({
          items,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCart.id);

      if (error) throw error;
    } else if (items && items.length > 0) {
      // Create new cart
      const { error } = await supabase
        .from('carts')
        .insert({
          user_id: userId,
          items,
          status: 'active'
        });

      if (error) throw error;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error syncing cart:', error);
    res.status(500).json({ error: 'Failed to sync cart' });
  }
});

// DELETE - Clear cart
router.delete('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabase
      .from('carts')
      .update({ items: [], updated_at: new Date().toISOString() })
      .eq('user_id', req.user?.id)
      .eq('status', 'active');

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

export default router;