// backend/src/routes/delivery.routes.ts
import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { supabase } from '../config/supabase';
import { createNotification } from './notification.routes';

const router = Router();

// All routes require authentication + delivery_guy role
router.use(authenticate);
router.use(requireRole(['delivery_guy']));

// ============================
// GET DELIVERY GUY PROFILE
// ============================
router.get('/profile', async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('delivery_guys')
      .select('id, full_name, email, phone, company_id, is_active, created_at')
      .eq('user_id', req.user!.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Delivery guy profile not found' });
    }

    const { data: locationRow } = await supabase
      .from('delivery_locations')
      .select('is_online')
      .eq('delivery_guy_id', data.id)
      .maybeSingle();

    return res.json({
      ...data,
      is_online: locationRow?.is_online ?? false,
    });
  } catch (error: any) {
    console.error('Delivery profile error:', error);
    return res.status(500).json({ error: 'Failed to load profile' });
  }
});

// ============================
// TOGGLE ONLINE (GPS sharing)
// ============================
router.patch('/online', async (req: AuthRequest, res: Response) => {
  try {
    const isOnline = Boolean(req.body?.is_online);

    const { data: profile, error: profileError } = await supabase
      .from('delivery_guys')
      .select('id, is_active')
      .eq('user_id', req.user!.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({ error: 'Delivery guy profile not found' });
    }

    if (!profile.is_active) {
      return res.status(400).json({ error: 'Your account is inactive. Contact your manager.' });
    }

    const { data: existing } = await supabase
      .from('delivery_locations')
      .select('latitude, longitude')
      .eq('delivery_guy_id', profile.id)
      .maybeSingle();

    const { error } = await supabase
      .from('delivery_locations')
      .upsert(
        {
          delivery_guy_id: profile.id,
          latitude: existing?.latitude ?? 0,
          longitude: existing?.longitude ?? 0,
          is_online: isOnline,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'delivery_guy_id' }
      );

    if (error) throw error;

    return res.json({ success: true, is_online: isOnline });
  } catch (error: any) {
    console.error('Toggle online error:', error);
    return res.status(500).json({ error: 'Failed to update online status' });
  }
});

// ============================
// GET ORDERS BY STATUS TAB
// ?status=available | active | completed
// ============================
router.get('/orders', async (req: AuthRequest, res: Response) => {
  try {
    const status = req.query.status as string;

    const { data: profile, error: profileError } = await supabase
      .from('delivery_guys')
      .select('id, company_id')
      .eq('user_id', req.user!.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({ error: 'Delivery guy profile not found' });
    }

    // If no specific status tab is provided, return all relevant orders
    if (!status || status === 'all') {
      // 1. Available orders (ready, unassigned, same company)
      const { data: available } = await supabase
        .from('orders')
        .select('*, order_items(id, product_name, quantity, product_price)')
        .eq('company_id', profile.company_id)
        .eq('status', 'ready')
        .is('delivery_guy_id', null)
        .order('created_at', { ascending: true });

      // 2. Active orders assigned to this guy
      const { data: active } = await supabase
        .from('orders')
        .select('*, order_items(id, product_name, quantity, product_price)')
        .eq('delivery_guy_id', profile.id)
        .in('status', ['ready', 'out_for_delivery'])
        .order('created_at', { ascending: false });

      // 3. Completed orders delivered by this guy (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: completed } = await supabase
        .from('orders')
        .select('*, order_items(id, product_name, quantity, product_price)')
        .eq('delivery_guy_id', profile.id)
        .eq('status', 'delivered')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false });

      return res.json({
        available: available || [],
        active: active || [],
        completed: completed || [],
      });
    }

    // Existing tab‑specific queries
    let query = supabase
      .from('orders')
      .select('*, order_items(id, product_name, quantity, product_price)');

    if (status === 'available') {
      query = query
        .eq('company_id', profile.company_id)
        .eq('status', 'ready')
        .is('delivery_guy_id', null)
        .order('created_at', { ascending: true });
    } else if (status === 'active') {
      query = query
        .eq('delivery_guy_id', profile.id)
        .in('status', ['ready', 'out_for_delivery'])
        .order('created_at', { ascending: false });
    } else if (status === 'completed') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      query = query
        .eq('delivery_guy_id', profile.id)
        .eq('status', 'delivered')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false });
    } else {
      return res.status(400).json({ error: 'Invalid status. Use available, active, completed, or omit for all' });
    }

    const { data, error } = await query;
    if (error) throw error;
    return res.json(data || []);
  } catch (error: any) {
    console.error('Delivery orders error:', error);
    return res.status(500).json({ error: 'Failed to load orders' });
  }
});

// ============================
// ACCEPT ORDER
// ============================
router.patch('/orders/:orderId/accept', async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.params;

    const { data: profile, error: profileError } = await supabase
      .from('delivery_guys')
      .select('id, company_id, full_name')
      .eq('user_id', req.user!.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({ error: 'Delivery guy profile not found' });
    }

    // Verify order exists, is ready, unassigned and belongs to same company
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, company_id, delivery_guy_id, order_number, user_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.company_id !== profile.company_id) {
      return res.status(403).json({ error: 'This order does not belong to your company' });
    }

    if (order.status !== 'ready') {
      return res.status(400).json({ error: 'Order is not ready for pickup' });
    }

    if (order.delivery_guy_id !== null && order.delivery_guy_id !== profile.id) {
    return res.status(400).json({ error: 'Order has already been accepted by another delivery guy' });
    }

    // Atomic update — .is('delivery_guy_id', null) prevents race condition
   // Replace the atomic update block with this
const { data: updatedOrder, error: updateError } = await supabase
  .from('orders')
  .update({
    delivery_guy_id: profile.id,
    status: 'out_for_delivery',
    updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .or(`delivery_guy_id.is.null,delivery_guy_id.eq.${profile.id}`)  // ← null OR mine
        .select()
        .single();

        if (updateError || !updatedOrder) {
        return res.status(400).json({
            error: 'Order was just taken by another delivery guy. Please refresh.',
        });
        }

    // Add tracking entry
    await supabase.from('order_tracking').insert({
      order_id: orderId,
      status: 'out_for_delivery',
      message: `Order picked up by ${profile.full_name} and is on the way`,
    });

    // Notify customer
    if (order.user_id) {
      await createNotification(
        order.user_id,
        order.company_id,
        'order',
        '🛵 Order On The Way!',
        `Your order #${order.order_number} has been picked up and is on its way to you!`,
        { orderId, orderNumber: order.order_number }
      );
    }

    return res.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    console.error('Accept order error:', error);
    return res.status(500).json({ error: 'Failed to accept order' });
  }
});

// ============================
// MARK ORDER AS DELIVERED
// ============================
router.patch('/orders/:orderId/deliver', async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.params;

    const { data: profile, error: profileError } = await supabase
      .from('delivery_guys')
      .select('id, full_name')
      .eq('user_id', req.user!.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({ error: 'Delivery guy profile not found' });
    }

    // Verify order is assigned to this delivery guy
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, delivery_guy_id, order_number, user_id, company_id, total')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.delivery_guy_id !== profile.id) {
      return res.status(403).json({ error: 'This order is not assigned to you' });
    }

    if (order.status !== 'out_for_delivery') {
      return res.status(400).json({ error: 'Order is not out for delivery' });
    }

    // Mark as delivered
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Add tracking entry
    await supabase.from('order_tracking').insert({
      order_id: orderId,
      status: 'delivered',
      message: `Order delivered by ${profile.full_name}`,
    });

    // Notify customer — order delivered
    if (order.user_id) {
      await createNotification(
        order.user_id,
        order.company_id,
        'order',
        '🎉 Order Delivered!',
        `Your order #${order.order_number} has been delivered. Enjoy your meal!`,
        { orderId, orderNumber: order.order_number }
      );

      // Payment notification
      await createNotification(
        order.user_id,
        order.company_id,
        'payment',
        '💰 Payment Processed',
        `Your payment of ₵${Number(order.total).toFixed(2)} for order #${order.order_number} has been processed.`,
        { orderId, orderNumber: order.order_number, amount: order.total }
      );
    }

    return res.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    console.error('Deliver order error:', error);
    return res.status(500).json({ error: 'Failed to mark delivered' });
  }
});

// ============================
// POST DELIVERY LOCATION (GPS)
// ============================
router.post('/location', async (req: AuthRequest, res: Response) => {
  try {
    const { latitude, longitude, accuracy, heading, speed, is_online, order_id } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('delivery_guys')
      .select('id')
      .eq('user_id', req.user!.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({ error: 'Delivery guy profile not found' });
    }

    const payload: Record<string, unknown> = {
      delivery_guy_id: profile.id,
      latitude,
      longitude,
      accuracy: accuracy ?? null,
      heading: heading ?? null,
      speed: speed ?? null,
      is_online: is_online ?? true,
      updated_at: new Date().toISOString(),
    };

    // Optional: ties GPS row to the active order (your table has order_id)
    if (order_id) {
      const { data: order } = await supabase
        .from('orders')
        .select('id')
        .eq('id', order_id)
        .eq('delivery_guy_id', profile.id)
        .eq('status', 'out_for_delivery')
        .maybeSingle();
      if (order) payload.order_id = order.id;
    }

    const { error } = await supabase
      .from('delivery_locations')
      .upsert(payload, { onConflict: 'delivery_guy_id' });

    if (error) throw error;

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Location update error:', error);
    return res.status(500).json({ error: 'Failed to update location' });
  }
});

// ============================
// GET ACTIVITY FEED
// ============================
router.get('/activity', async (req: AuthRequest, res: Response) => {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('delivery_guys')
      .select('id')
      .eq('user_id', req.user!.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({ error: 'Delivery guy profile not found' });
    }

    const { data, error } = await supabase
      .from('order_tracking')
      .select(`
        id, order_id, status, message, created_at,
        orders!inner ( order_number, delivery_guy_id )
      `)
      .eq('orders.delivery_guy_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;

    const entries = (data || []).map((row: any) => ({
      id: row.id,
      order_id: row.order_id,
      status: row.status,
      message: row.message,
      created_at: row.created_at,
      order_number: row.orders?.order_number,
    }));

    return res.json(entries);
  } catch (error: any) {
    console.error('Activity feed error:', error);
    return res.status(500).json({ error: 'Failed to load activity' });
  }
});

export default router;