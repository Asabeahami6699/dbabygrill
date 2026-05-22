// backend/src/routes/payment.routes.ts
//
// FLOW
//  1. POST /payments/initiate  — validates stock, sends customer to Paystack
//  2. POST /payments/webhook   — Paystack fires this on success, creates the order
//  3. GET  /payments/status/:ref — frontend polls this after redirect, just reads DB
//
// /status is unauthenticated and does a single DB read (<50ms).
// Order creation only ever happens in the webhook — never in /status or /verify.

import { Router, Request, Response } from 'express';
import { createHmac } from 'crypto';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { supabase } from '../config/supabase';
import { createNotification, notifyDeliveryGuys, notifyPlatformAdmins } from './notification.routes';
import { buildDeliveryAddressInfo } from '../lib/deliveryAddress';

const router = Router();

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;
const PAYSTACK_URL    = 'https://api.paystack.co';
const FRONTEND_URL    = process.env.FRONTEND_URL!;

// ─────────────────────────────────────────────────────────────
// POST /payments/initiate
// ─────────────────────────────────────────────────────────────
router.post('/initiate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      amount,
      email,
      cartItems,
      formData,
      itemInstructions,
      companyId,
      deliveryFee,
    } = req.body;

    if (!amount || !email || !cartItems?.length || !formData || !companyId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate stock before sending customer to Paystack
    const { data: products, error: productErr } = await supabase
      .from('products')
      .select('id, name, stock_quantity, is_available')
      .in('id', cartItems.map((i: any) => i.id));

    if (productErr || !products?.length) {
      return res.status(400).json({ error: 'Failed to validate products' });
    }

    for (const item of cartItems) {
      const p = products.find((p: any) => p.id === item.id);
      if (!p)              return res.status(400).json({ error: `Product not found: ${item.id}` });
      if (!p.is_available) return res.status(400).json({ error: `${p.name} is currently unavailable` });
      if (p.stock_quantity < item.quantity) {
        return res.status(400).json({ error: `Only ${p.stock_quantity} left of ${p.name}` });
      }
    }

    const reference = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Timeout guard — prevents Paystack slowness from hanging the server
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 10_000);

    const paystackRes = await fetch(`${PAYSTACK_URL}/transaction/initialize`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        email,
        amount:       Math.round(Number(amount) * 100),
        currency:     'GHS',
        reference,
        callback_url: `${FRONTEND_URL}/payment/callback`,
        metadata: {
          userId:     req.user!.id,
          companyId,
          deliveryFee: Number(deliveryFee) || 0,
          formData,
          // Explicitly coerce to numbers — Paystack may stringify on round-trip
          cartItems: cartItems.map((i: any) => ({
            id:            i.id,
            product_name:  i.product_name,
            product_price: Number(i.product_price),
            quantity:      Number(i.quantity),
          })),
          // Per-item special instructions keyed by product id
          itemInstructions: (itemInstructions || []).map((i: any) => ({
            product_id:  i.product_id,
            instruction: i.instruction || '',
          })),
        },
      }),
    }).finally(() => clearTimeout(timeout));

    const data = await paystackRes.json() as any;

    if (!data.status) {
      console.error('[initiate] Paystack error:', data);
      return res.status(400).json({ error: data.message || 'Paystack initialization failed' });
    }

    return res.json({ checkoutUrl: data.data.authorization_url, reference });
  } catch (err: any) {
    console.error('[initiate]', err.message);
    return res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /payments/status/:reference
//
// Frontend polls this after Paystack redirects back.
// Pure DB read — no Paystack API calls, no auth session risk.
// No authenticate middleware — safe to call without a valid session.
// ─────────────────────────────────────────────────────────────
router.get('/status/:reference', async (req: Request, res: Response) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({ error: 'No reference provided' });
    }

    const { data: order } = await supabase
      .from('orders')
      .select('id, order_number')
      .eq('payment_reference', reference)
      .maybeSingle();

    if (order) {
      return res.json({ status: 'paid', orderId: order.id, orderNumber: order.order_number });
    }

    return res.json({ status: 'processing' });
  } catch (err: any) {
    console.error('[status]', err.message);
    return res.status(500).json({ error: 'Failed to check status' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /payments/webhook
//
// Paystack POSTs here on payment events.
// The ONLY place orders are created for card payments.
// ─────────────────────────────────────────────────────────────
router.post('/webhook', async (req: Request, res: Response) => {
  const signature = req.headers['x-paystack-signature'] as string;

  if (!signature) return res.status(401).send('Missing signature');

  const hash = createHmac('sha512', PAYSTACK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== signature) {
    console.warn('[webhook] Invalid HMAC — rejected');
    return res.status(401).send('Invalid signature');
  }

  // ACK Paystack immediately — they require a fast response
  res.sendStatus(200);

  const { event, data } = req.body;

  if (event !== 'charge.success') return;

  try {
    const meta = data.metadata;

    if (!meta?.formData || !meta?.cartItems?.length || !meta?.companyId || !meta?.userId) {
      console.error('[webhook] Incomplete metadata for ref:', data.reference);
      return;
    }

    await createOrder({
      userId:       meta.userId,
      companyId:    meta.companyId,
      formData:     meta.formData,
      cartItems:    meta.cartItems,
      instructions: meta.itemInstructions || [],
      deliveryFee:  Number(meta.deliveryFee) || 0,
      amountPaid:   data.amount / 100,
      reference:    data.reference,
      txnId:        String(data.id),
    });

    console.log('[webhook] ✅ order created for ref:', data.reference);
  } catch (err: any) {
    // 200 already sent — log for investigation
    console.error('[webhook] ❌ failed for', data.reference, '—', err.message);
  }
});

// ─────────────────────────────────────────────────────────────
// INTERNAL: Create order after confirmed payment
// ─────────────────────────────────────────────────────────────
async function createOrder({
  userId,
  companyId,
  formData,
  cartItems,
  instructions,
  deliveryFee,
  amountPaid,
  reference,
  txnId,
}: {
  userId:       string;
  companyId:    string;
  formData:     any;
  cartItems:    any[];
  instructions: { product_id: string; instruction: string }[];
  deliveryFee:  number;
  amountPaid:   number;
  reference:    string;
  txnId:        string;
}) {
  // Fetch current product data (stock, name)
  const { data: products, error: productErr } = await supabase
    .from('products')
    .select('id, name, stock_quantity, is_available')
    .in('id', cartItems.map((i: any) => i.id));

  if (productErr || !products?.length) {
    throw new Error('Failed to fetch products');
  }

  let subtotal    = 0;
  const orderItems: any[] = [];

  for (const item of cartItems) {
    const product = products.find((p: any) => p.id === item.id);
    if (!product) throw new Error(`Product not found: ${item.id}`);

    const price = Number(item.product_price);
    const qty   = Number(item.quantity);

    if (!price || isNaN(price)) throw new Error(`Invalid price for product ${item.id}`);
    if (!qty   || isNaN(qty))   throw new Error(`Invalid quantity for product ${item.id}`);
    if (product.stock_quantity < qty) {
      throw new Error(`Insufficient stock for ${product.name}`);
    }

    subtotal += price * qty;

    const instruction = instructions.find((i) => i.product_id === item.id)?.instruction?.trim() || null;

    orderItems.push({
      product_id:           product.id,
      product_name:         product.name,   // use DB name, not metadata
      product_price:        price,
      quantity:             qty,
      special_instructions: instruction,    // per-item customer instruction
    });
  }

  const total       = subtotal + deliveryFee;
  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const fulfillmentMode = formData.fulfillmentMode || 'delivery';
  const isPickup = fulfillmentMode === 'pickup';
  const { deliveryAddress, deliveryLatitude, deliveryLongitude } =
    buildDeliveryAddressInfo(formData, isPickup);

  // UNIQUE constraint on payment_reference means a duplicate webhook call
  // gets error code 23505, which we catch below and skip safely.
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      order_number:            orderNumber,
      user_id:                 userId,
      company_id:              companyId,
      subtotal,
      delivery_fee:            deliveryFee,
      total,
      customer_name:           (formData.fullName  || '').trim(),
      customer_email:          (formData.email     || '').trim().toLowerCase(),
      customer_phone:          (formData.phone     || '').trim(),
      delivery_address:        deliveryAddress,
      delivery_latitude:       deliveryLatitude,
      delivery_longitude:      deliveryLongitude,
      special_instructions:    (formData.notes     || '').trim() || null,
      payment_method:          'card',
      payment_status:          'paid',
      payment_reference:       reference,
      payment_transaction_id:  txnId,
      status:                  'confirmed',
      estimated_delivery_time: new Date(Date.now() + 45 * 60_000).toISOString(),
      pickup_branch_id:        formData.pickupBranchId || null,
    })
    .select('id, order_number')
    .single();

  if (orderErr) {
    // 23505 = unique_violation — duplicate webhook, order already exists
    if (orderErr.code === '23505') {
      console.log('[createOrder] duplicate blocked by constraint for', reference);
      return;
    }
    throw new Error(`Order insert failed: ${orderErr.message}`);
  }

  // Insert order_items
  const { error: itemsErr } = await supabase
    .from('order_items')
    .insert(orderItems.map((item) => ({ ...item, order_id: order.id })));

  if (itemsErr) throw new Error(`Order items insert failed: ${itemsErr.message}`);

  // Deduct stock
  await Promise.all(
    cartItems.map((item: any) => {
      const product = products.find((p: any) => p.id === item.id)!;
      return supabase
        .from('products')
        .update({
          stock_quantity: product.stock_quantity - Number(item.quantity),
          updated_at:     new Date().toISOString(),
        })
        .eq('id', item.id);
    })
  );

  // Order tracking
  await supabase.from('order_tracking').insert([
    { order_id: order.id, status: 'pending',   message: 'Order received' },
    { order_id: order.id, status: 'confirmed', message: `Payment confirmed via Paystack (ref: ${reference})` },
  ]);

  // Clear backend cart
  await supabase
    .from('carts')
    .update({ items: [], updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'active');

  // ─────────────────────────────────────────────────────────
  // Notifications
  // ─────────────────────────────────────────────────────────

  // Build human-readable fulfillment line used in both notifications
  const paymentLabel      = 'Card';
  const fulfillmentLabel  = isPickup ? 'Pickup' : 'Delivery';

  // For pickup: show branch name if available, else generic "Pickup"
  // For delivery: show the address that was stored on the order
  const locationLine = isPickup
    ? (formData.pickupBranchName ? `Branch: ${formData.pickupBranchName}` : 'Pickup from store')
    : `Deliver to: ${deliveryAddress}`;

  // Customer notification
  createNotification(
    userId,
    companyId,
    'order',
    '✅ Order Confirmed!',
    `Your order #${orderNumber} is confirmed.\nTotal: ₵${total.toFixed(2)} | Paid by ${paymentLabel} | ${fulfillmentLabel}\n${locationLine}`,
    {
      orderId:          order.id,
      orderNumber,
      total,
      payment_method:   'card',
      fulfillment_mode: fulfillmentMode,
      delivery_address: isPickup ? null : deliveryAddress,
      pickup_branch_id: isPickup ? (formData.pickupBranchId || null) : null,
      pickup_branch:    isPickup ? (formData.pickupBranchName || null) : null,
    }
  ).then(undefined, console.error);

  const adminNotificationData = {
    orderId:          order.id,
    orderNumber,
    total,
    customerName:     formData.fullName,
    payment_method:   'card',
    fulfillment_mode: fulfillmentMode,
    delivery_address: isPickup ? null : deliveryAddress,
    pickup_branch_id: isPickup ? (formData.pickupBranchId || null) : null,
    pickup_branch:    isPickup ? (formData.pickupBranchName || null) : null,
  };
  const adminNotificationMessage =
    `Order #${orderNumber} from ${formData.fullName}.\nTotal: ₵${total.toFixed(2)} | Paid by ${paymentLabel} | ${fulfillmentLabel}\n${locationLine}`;

  supabase
    .from('users')
    .select('id')
    .eq('company_id', companyId)
    .eq('role', 'company_admin')
    .maybeSingle()
    .then(({ data: admin }) => {
      if (!admin?.id) return;
      return createNotification(
        admin.id,
        companyId,
        'order',
        '🔔 New Order!',
        adminNotificationMessage,
        adminNotificationData
      );
    })
    .then(undefined, console.error);

  notifyPlatformAdmins(
    companyId,
    'order',
    '🔔 New Order (Platform)',
    adminNotificationMessage,
    adminNotificationData
  ).then(undefined, console.error);

  if (!isPickup) {
    notifyDeliveryGuys(
      companyId,
      'order',
      '📦 New Order Placed',
      `Order #${orderNumber} was placed — watch for ready status.`,
      { orderId: order.id, orderNumber, status: 'pending' }
    ).then(undefined, console.error);
  }
}

export default router;