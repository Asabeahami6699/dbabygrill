// backend/src/routes/company.routes.ts
import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { supabase } from '../config/supabase';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { createNotification, notifyDeliveryGuys } from './notification.routes';

const supabaseServiceRole = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const router = Router();

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WEBP are allowed.'));
    }
  }
});

// ======================
// GET COMPANY PROFILE
// ======================
router.get(
  '/profile',
  authenticate,
  requireRole(['company_admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', req.user?.company_id)
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error) {
      console.error('Get company profile error:', error);
      res.status(500).json({ error: 'Failed to fetch company profile' });
    }
  }
);

// ======================
// UPDATE COMPANY PROFILE
// ======================
router.put(
  '/profile',
  authenticate,
  requireRole(['company_admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, description, location, phone, email } = req.body;

      const { data, error } = await supabase
        .from('companies')
        .update({
          name,
          description,
          location,
          phone,
          email,
          updated_at: new Date().toISOString()
        })
        .eq('id', req.user?.company_id)
        .select()
        .single();

      if (error) throw error;

      res.json(data);
    } catch (error) {
      console.error('Update company profile error:', error);
      res.status(500).json({ error: 'Failed to update company profile' });
    }
  }
);

// ======================
// GET PRODUCTS
// ======================
router.get(
  '/products',
  authenticate,
  requireRole(['company_admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', req.user?.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      console.error('Get products error:', error);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  }
);

// ======================
// CREATE PRODUCT (with variants support)
// ======================
router.post(
  '/products',
  authenticate,
  requireRole(['company_admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { 
        name, 
        description, 
        category, 
        stock_quantity, 
        image_url,
        variants,      // optional: array of { label, price }
        base_price     // optional: number for combos/single-price products
      } = req.body;

      // Validate required fields
      if (!name || stock_quantity === undefined) {
        return res.status(400).json({ error: 'Name and stock quantity are required' });
      }

      let insertData: any = {
        name,
        description: description || '',
        category: category || '',
        stock_quantity: parseInt(stock_quantity),
        image_url: image_url || null,
        company_id: req.user?.company_id,
        is_available: true,
        is_promoted: false,
        promo_rank: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Handle variants vs base_price
      if (variants && Array.isArray(variants) && variants.length > 0) {
        // Validate each variant has label and price
        const validVariants = variants.filter(v => v.label && typeof v.price === 'number');
        if (validVariants.length === 0) {
          return res.status(400).json({ error: 'At least one valid variant (label + price) is required' });
        }
        insertData.variants = validVariants;
        insertData.base_price = null;
        insertData.price = null; // no single price for variant products
      } else if (base_price !== undefined && base_price !== null) {
        insertData.base_price = parseFloat(base_price);
        insertData.variants = [];
        insertData.price = parseFloat(base_price);
      } else {
        return res.status(400).json({ error: 'Either variants or base_price is required' });
      }

      const { data, error } = await supabase
        .from('products')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      res.status(201).json(data);
    } catch (error) {
      console.error('Create product error:', error);
      res.status(500).json({ error: 'Failed to create product' });
    }
  }
);

// ======================
// UPDATE PRODUCT (with variants support)
// ======================
router.put(
  '/products/:id',
  authenticate,
  requireRole(['company_admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { 
        name, 
        description, 
        category, 
        stock_quantity, 
        image_url,
        variants,
        base_price
      } = req.body;

      // Verify product belongs to company
      const { data: existingProduct, error: verifyError } = await supabase
        .from('products')
        .select('company_id')
        .eq('id', id)
        .single();

      if (verifyError || !existingProduct) {
        return res.status(404).json({ error: 'Product not found' });
      }

      if (existingProduct.company_id !== req.user?.company_id) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      let updateData: any = {
        name,
        description: description || '',
        category: category || '',
        stock_quantity: parseInt(stock_quantity),
        image_url: image_url || null,
        updated_at: new Date().toISOString()
      };

      // Handle variants vs base_price
      if (variants && Array.isArray(variants) && variants.length > 0) {
        const validVariants = variants.filter(v => v.label && typeof v.price === 'number');
        if (validVariants.length === 0) {
          return res.status(400).json({ error: 'At least one valid variant (label + price) is required' });
        }
        updateData.variants = validVariants;
        updateData.base_price = null;
        updateData.price = null;
      } else if (base_price !== undefined && base_price !== null) {
        updateData.base_price = parseFloat(base_price);
        updateData.variants = [];
        updateData.price = parseFloat(base_price);
      } else {
        return res.status(400).json({ error: 'Either variants or base_price is required' });
      }

      const { data, error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      res.json(data);
    } catch (error) {
      console.error('Update product error:', error);
      res.status(500).json({ error: 'Failed to update product' });
    }
  }
);

// ======================
// DELETE PRODUCT
// ======================
router.delete(
  '/products/:id',
  authenticate,
  requireRole(['company_admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const { data: existingProduct, error: verifyError } = await supabase
        .from('products')
        .select('company_id')
        .eq('id', id)
        .single();

      if (verifyError || !existingProduct) {
        return res.status(404).json({ error: 'Product not found' });
      }

      if (existingProduct.company_id !== req.user?.company_id) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      res.status(204).send();
    } catch (error) {
      console.error('Delete product error:', error);
      res.status(500).json({ error: 'Failed to delete product' });
    }
  }
);

// ======================
// TOGGLE PRODUCT AVAILABILITY
// ======================
router.patch(
  '/products/:id/toggle-availability',
  authenticate,
  requireRole(['company_admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const { data: existingProduct, error: verifyError } = await supabase
        .from('products')
        .select('company_id, is_available')
        .eq('id', id)
        .single();

      if (verifyError || !existingProduct) {
        return res.status(404).json({ error: 'Product not found' });
      }

      if (existingProduct.company_id !== req.user?.company_id) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const { data, error } = await supabase
        .from('products')
        .update({
          is_available: !existingProduct.is_available,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      res.json(data);
    } catch (error) {
      console.error('Toggle product availability error:', error);
      res.status(500).json({ error: 'Failed to toggle product availability' });
    }
  }
);

// ======================
// UPDATE PRODUCT PROMOTION (Admin-controlled)
// ======================
router.patch(
  '/products/:id/promotion',
  authenticate,
  requireRole(['company_admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { is_promoted, promo_rank } = req.body as {
        is_promoted?: boolean;
        promo_rank?: unknown;
      };

      const { data: existingProduct, error: verifyError } = await supabase
        .from('products')
        .select('company_id')
        .eq('id', id)
        .single();

      if (verifyError || !existingProduct) {
        return res.status(404).json({ error: 'Product not found' });
      }

      if (existingProduct.company_id !== req.user?.company_id) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const normalizedRank = (() => {
        if (promo_rank === null || promo_rank === undefined) return null;
        if (typeof promo_rank === 'string' && promo_rank.trim() === '') return null;
        return Number(promo_rank);
      })();

      if (normalizedRank !== null && (!Number.isFinite(normalizedRank) || normalizedRank < 0)) {
        return res.status(400).json({ error: 'promo_rank must be a non-negative number or null' });
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (typeof is_promoted === 'boolean') updateData.is_promoted = is_promoted;
      if (promo_rank !== undefined) updateData.promo_rank = normalizedRank;

      const { data, error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      res.json(data);
    } catch (error) {
      console.error('Update product promotion error:', error);
      res.status(500).json({ error: 'Failed to update product promotion' });
    }
  }
);

// ======================
// UPLOAD PRODUCT IMAGE
// ======================
router.post(
  '/products/upload-image',
  authenticate,
  requireRole(['company_admin']),
  upload.single('image'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      const companyId = req.user?.company_id;
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID not found' });
      }

      const fileExt = req.file.originalname.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `${companyId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          cacheControl: '3600'
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      res.json({ imageUrl: publicUrl });
    } catch (error) {
      console.error('Upload image error:', error);
      res.status(500).json({ error: 'Failed to upload image' });
    }
  }
);

// ======================
// GET ORDERS WITH ITEMS (Using order_items table)
// ======================
router.get(
  '/orders',
  authenticate,
  requireRole(['company_admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('company_id', req.user?.company_id)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      if (!ordersData || ordersData.length === 0) {
        return res.json([]);
      }

      const orderIds = ordersData.map((order: any) => order.id);
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('id, order_id, product_id, product_name, product_price, quantity, special_instructions')
        .in('order_id', orderIds);

      if (itemsError) {
        console.error('Get order items error:', itemsError);
        // Do not fail the whole request if order items query has schema differences.
      }

      const productIds = Array.from(
        new Set((itemsData || []).map((item: any) => item.product_id).filter(Boolean))
      );
      let imageByProductId = new Map<string, string | null>();
      if (productIds.length > 0) {
        const { data: productRows } = await supabase
          .from('products')
          .select('id, image_url')
          .in('id', productIds);
        imageByProductId = new Map<string, string | null>(
          (productRows || []).map((p: any) => [p.id, p.image_url || null])
        );
      }

      const itemsByOrderId = new Map<string, any[]>();
      (itemsData || []).forEach((item: any) => {
        const existing = itemsByOrderId.get(item.order_id) || [];
        existing.push({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          product_price: item.product_price,
          quantity: item.quantity,
          special_instructions: item.special_instructions,
          image_url: imageByProductId.get(item.product_id) || null,
        });
        itemsByOrderId.set(item.order_id, existing);
      });

      const transformedOrders = ordersData.map((order: any) => ({
        ...order,
        total_amount: order.total ?? order.total_amount ?? 0,
        customer_address: order.delivery_address ?? order.customer_address ?? '',
        order_items: itemsByOrderId.get(order.id) || []
      }));

      res.json(transformedOrders);
    } catch (error) {
      console.error('Get orders error:', error);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  }
);

// ======================
// UPDATE ORDER STATUS (With Notifications)
// ======================
router.patch(
  '/orders/:orderId/status',
  authenticate,
  requireRole(['company_admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orderId } = req.params;
      const { status, delivery_guy_id } = req.body;

      const validStatuses = [
        'pending',
        'confirmed',
        'preparing',
        'ready',
        'delivered',
        'cancelled'
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const { data: existingOrder, error: fetchError } = await supabase
        .from('orders')
        .select(`
          status, 
          company_id, 
          user_id,
          order_number,
          customer_name,
          total
        `)
        .eq('id', orderId)
        .single();

      if (fetchError || !existingOrder) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (existingOrder.company_id !== req.user?.company_id) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const orderedStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];
      const isCurrentInFlow = orderedStatuses.includes(existingOrder.status);
      const isTargetInFlow = orderedStatuses.includes(status);

      let progression: string[] = [];

      // Cancelling is only allowed before delivery and not from cancelled.
      if (status === 'cancelled') {
        if (!['pending', 'confirmed', 'preparing'].includes(existingOrder.status)) {
          return res.status(400).json({
            error: `Cannot move from ${existingOrder.status} to ${status}`
          });
        }
        progression = ['cancelled'];
      } else if (isCurrentInFlow && isTargetInFlow) {
        const currentIdx = orderedStatuses.indexOf(existingOrder.status);
        const targetIdx = orderedStatuses.indexOf(status);

        if (targetIdx <= currentIdx) {
          return res.status(400).json({
            error: `Cannot move from ${existingOrder.status} to ${status}`
          });
        }

        // Fast-forward safely: apply each intermediate stage so tracking + notifications remain complete.
        progression = orderedStatuses.slice(currentIdx + 1, targetIdx + 1);
      } else {
        return res.status(400).json({
          error: `Cannot move from ${existingOrder.status} to ${status}`
        });
      }

      // Send notification to customer
      const statusMessages: Record<string, { title: string; message: string; type: 'order' | 'payment' }> = {
        confirmed: {
          title: 'Order Confirmed ✅',
          message: `Your order #${existingOrder.order_number} has been confirmed and is being prepared.`,
          type: 'order'
        },
        preparing: {
          title: 'Order Being Prepared 🍳',
          message: `Great news! Your order #${existingOrder.order_number} is now being prepared by the chef.`,
          type: 'order'
        },
        ready: {
          title: 'Order Ready for Delivery 🛵',
          message: `Your order #${existingOrder.order_number} is ready! A delivery partner will pick it up shortly.`,
          type: 'order'
        },
        delivered: {
          title: 'Order Delivered! 🎉',
          message: `Your order #${existingOrder.order_number} has been delivered. Enjoy your meal!`,
          type: 'order'
        },
        cancelled: {
          title: 'Order Cancelled ❌',
          message: `Your order #${existingOrder.order_number} has been cancelled.`,
          type: 'order'
        }
      };

      let previousStatus = existingOrder.status;
      let latestOrder: any = null;

      for (const nextStatus of progression) {
        const updateData: any = {
          status: nextStatus,
          updated_at: new Date().toISOString()
        };

        // When status is 'ready', optionally include the delivery_guy_id
        if (nextStatus === 'ready' && delivery_guy_id !== undefined) {
          updateData.delivery_guy_id = delivery_guy_id || null;
        }

        const { data: updatedOrder, error: updateError } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', orderId)
          .select()
          .single();

        if (updateError) throw updateError;
        latestOrder = updatedOrder;

        await supabase.from('order_tracking').insert({
          order_id: orderId,
          status: nextStatus,
          message: `Order status updated to ${nextStatus}`
        });

        if (statusMessages[nextStatus] && existingOrder.user_id) {
          await createNotification(
            existingOrder.user_id,
            existingOrder.company_id,
            statusMessages[nextStatus].type,
            statusMessages[nextStatus].title,
            statusMessages[nextStatus].message,
            {
              orderId,
              status: nextStatus,
              orderNumber: existingOrder.order_number,
              previousStatus
            }
          );
        }

        if (nextStatus === 'ready') {
          await notifyDeliveryGuys(
            existingOrder.company_id,
            'order',
            '🛵 New Delivery Available',
            `Order #${existingOrder.order_number} is ready for pickup.`,
            { orderId, orderNumber: existingOrder.order_number, status: 'ready' }
          );
        }

        if (nextStatus === 'delivered') {
          await createNotification(
            existingOrder.user_id,
            existingOrder.company_id,
            'payment',
            'Payment Processed 💰',
            `Your payment of ₵${existingOrder.total.toFixed(2)} for order #${existingOrder.order_number} has been processed successfully.`,
            {
              orderId,
              orderNumber: existingOrder.order_number,
              amount: existingOrder.total
            }
          );
        }

        previousStatus = nextStatus;
      }

      res.json(latestOrder);
    } catch (error) {
      console.error('Update order status error:', error);
      res.status(500).json({ error: 'Failed to update order status' });
    }
  }
);

// GET /api/company/categories
router.get('/categories', authenticate, requireRole(['company_admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('company_id', req.user?.company_id)
      .order('name');
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/company/categories
router.post('/categories', authenticate, requireRole(['company_admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name required' });
    const { data, error } = await supabase
      .from('categories')
      .insert({ name, company_id: req.user?.company_id })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// DELETE /api/company/categories/:id
router.delete('/categories/:id', authenticate, requireRole(['company_admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('company_id', req.user?.company_id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// Get all delivery areas for the company
router.get(
  '/delivery-areas',
  authenticate,
  requireRole(['company_admin']),
  async (req: AuthRequest, res) => {
    try {
      const { data, error } = await supabase
        .from('delivery_areas')
        .select('*')
        .eq('company_id', req.user?.company_id)
        .order('area_name', { ascending: true });
      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch delivery areas' });
    }
  }
);

// Create a new delivery area
router.post(
  '/delivery-areas',
  authenticate,
  requireRole(['company_admin']),
  async (req: AuthRequest, res) => {
    try {
      const { area_name, delivery_fee, is_active } = req.body;
      const { data, error } = await supabase
        .from('delivery_areas')
        .insert({
          company_id: req.user?.company_id,
          area_name,
          delivery_fee,
          is_active: is_active ?? true
        })
        .select()
        .single();
      if (error) throw error;
      res.status(201).json(data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create delivery area' });
    }
  }
);

// Update a delivery area
router.put(
  '/delivery-areas/:id',
  authenticate,
  requireRole(['company_admin']),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const { data, error } = await supabase
        .from('delivery_areas')
        .update({ ...updates, updated_at: new Date() })
        .eq('id', id)
        .eq('company_id', req.user?.company_id)
        .select()
        .single();
      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update delivery area' });
    }
  }
);

// Delete a delivery area
router.delete(
  '/delivery-areas/:id',
  authenticate,
  requireRole(['company_admin']),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase
        .from('delivery_areas')
        .delete()
        .eq('id', id)
        .eq('company_id', req.user?.company_id);
      if (error) throw error;
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete delivery area' });
    }
  }
);

// ============================
// PICKUP BRANCHES — Admin CRUD
// ============================
router.get('/pickup-branches', authenticate, requireRole(['company_admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('pickup_branches')
      .select('*')
      .eq('company_id', req.user?.company_id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return res.json(data || []);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/pickup-branches', authenticate, requireRole(['company_admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { branch_name, address, phone, is_active } = req.body;
    if (!branch_name?.trim() || !address?.trim()) {
      return res.status(400).json({ error: 'Branch name and address are required' });
    }
    const { data, error } = await supabase
      .from('pickup_branches')
      .insert({ company_id: req.user?.company_id, branch_name: branch_name.trim(), address: address.trim(), phone: phone?.trim() || null, is_active: is_active ?? true })
      .select()
      .single();
    if (error) throw error;
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/pickup-branches/:id', authenticate, requireRole(['company_admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { branch_name, address, phone, is_active } = req.body;
    const { data, error } = await supabase
      .from('pickup_branches')
      .update({
        ...(branch_name !== undefined && { branch_name: branch_name.trim() }),
        ...(address !== undefined && { address: address.trim() }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(is_active !== undefined && { is_active }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', req.user?.company_id)
      .select()
      .single();
    if (error) throw error;
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/pickup-branches/:id', authenticate, requireRole(['company_admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('pickup_branches')
      .delete()
      .eq('id', id)
      .eq('company_id', req.user?.company_id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ============================
// DELIVERY GUYS — Company Admin CRUD
// ============================
router.get('/delivery-guys', authenticate, requireRole(['company_admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('delivery_guys')
      .select('id, full_name, email, phone, is_active, created_at')
      .eq('company_id', req.user?.company_id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json(data || []);
  } catch (error: any) {
    console.error('Get delivery guys error:', error);
    return res.status(500).json({ error: 'Failed to fetch delivery guys' });
  }
});

router.post('/delivery-guys', authenticate, requireRole(['company_admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { full_name, email, password, phone } = req.body;

    // Validate required fields
    if (!full_name?.trim()) return res.status(400).json({ error: 'Full name is required' });
    if (!email?.trim()) return res.status(400).json({ error: 'Email is required' });
    if (!password?.trim()) return res.status(400).json({ error: 'Password is required' });
    if (!phone?.trim()) return res.status(400).json({ error: 'Phone is required' });

    const trimmedEmail = email.trim().toLowerCase();

    // Check for existing delivery guy
    const { data: existing } = await supabase
      .from('delivery_guys')
      .select('id')
      .eq('email', trimmedEmail)
      .maybeSingle();

    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const deliveryGuyId = uuidv4();

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: trimmedEmail,
      password: password.trim(),
      email_confirm: true,
    });

    if (authError) throw new Error(`Failed to create auth user: ${authError.message}`);
    const userId = authData.user.id;

    // 2. Upsert public.users with role = delivery_guy (CRITICAL)
    const { error: profileError } = await supabase
      .from('users')
      .upsert(
        {
          id: userId,
          email: trimmedEmail,
          role: 'delivery_guy',          // ✅ sets the role correctly
          full_name: full_name.trim(),
          phone: phone.trim(),
          company_id: req.user?.company_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Rollback auth user
      await supabase.auth.admin.deleteUser(userId);
      return res.status(500).json({ error: 'Failed to create user profile' });
    }

    // 3. Insert into delivery_guys
    const { data, error } = await supabase
      .from('delivery_guys')
      .insert({
        id: deliveryGuyId,
        user_id: userId,
        company_id: req.user?.company_id,
        full_name: full_name.trim(),
        email: trimmedEmail,
        password: await bcrypt.hash(password.trim(), 10),
        phone: phone.trim(),
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id, full_name, email, phone, is_active, created_at')
      .single();

    if (error) {
      console.error('Insert delivery_guys error:', error);
      // Clean up
      await supabase.from('users').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId);
      throw error;
    }

    return res.status(201).json(data);
  } catch (error: any) {
    console.error('Create delivery guy error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create delivery guy' });
  }
});

router.put('/delivery-guys/:id', authenticate, requireRole(['company_admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active, full_name, phone } = req.body;

    // Verify delivery guy belongs to company
    const { data: existingGuy, error: verifyError } = await supabase
      .from('delivery_guys')
      .select('company_id')
      .eq('id', id)
      .single();

    if (verifyError || !existingGuy) {
      return res.status(404).json({ error: 'Delivery guy not found' });
    }

    if (existingGuy.company_id !== req.user?.company_id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (is_active !== undefined) updateData.is_active = is_active;
    if (full_name !== undefined) updateData.full_name = full_name.trim();
    if (phone !== undefined) updateData.phone = phone.trim();

    const { data, error } = await supabase
      .from('delivery_guys')
      .update(updateData)
      .eq('id', id)
      .select('id, full_name, email, phone, is_active, created_at')
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (error: any) {
    console.error('Update delivery guy error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update delivery guy' });
  }
});

router.delete('/delivery-guys/:id', authenticate, requireRole(['company_admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Verify delivery guy belongs to company
    const { data: existingGuy, error: verifyError } = await supabase
      .from('delivery_guys')
      .select('company_id, user_id')
      .eq('id', id)
      .single();

    if (verifyError || !existingGuy) {
      return res.status(404).json({ error: 'Delivery guy not found' });
    }

    if (existingGuy.company_id !== req.user?.company_id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Delete auth user if exists
    if (existingGuy.user_id) {
      await supabase.auth.admin.deleteUser(existingGuy.user_id);
    }

    const { error } = await supabase
      .from('delivery_guys')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return res.status(204).send();
  } catch (error: any) {
    console.error('Delete delivery guy error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete delivery guy' });
  }
});

export default router;