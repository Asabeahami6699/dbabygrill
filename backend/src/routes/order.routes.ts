import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { supabase } from '../config/supabase';
import { AuthRequest } from '../middleware/auth.middleware';
import { createNotification, notifyDeliveryGuys, notifyPlatformAdmins } from './notification.routes';
import { buildDeliveryAddressInfo, validateDeliveryForm } from '../lib/deliveryAddress';

const router = Router();

const normalizeLocation = (value: string) =>
  (value || '').toLowerCase().replace(/\s+/g, ' ').trim();

const getDeliveryFeeForArea = async (companyId: string, cityOrArea: string) => {
  const normalizedInput = normalizeLocation(cityOrArea);
  const fallbackFee = 5;

  const { data: areas, error } = await supabase
    .from('delivery_areas')
    .select('id, area_name, delivery_fee, is_active')
    .eq('company_id', companyId)
    .eq('is_active', true);

  if (error) throw error;
  const activeAreas = areas || [];

  if (!normalizedInput || activeAreas.length === 0) {
    return { fee: fallbackFee, matchedArea: null };
  }

  const exactMatch = activeAreas.find(
    (area: any) => normalizeLocation(area.area_name) === normalizedInput
  );
  if (exactMatch) {
    return { fee: Number(exactMatch.delivery_fee || 0), matchedArea: exactMatch.area_name };
  }

  const partialMatch = activeAreas.find((area: any) => {
    const areaName = normalizeLocation(area.area_name);
    return normalizedInput.includes(areaName) || areaName.includes(normalizedInput);
  });

  if (partialMatch) {
    return { fee: Number(partialMatch.delivery_fee || 0), matchedArea: partialMatch.area_name };
  }

  return { fee: fallbackFee, matchedArea: null };
};

// ============================
// GET DELIVERY QUOTE BY AREA
// ============================
router.get('/delivery-fee', authenticate, async (req: AuthRequest, res) => {
  try {
    const { companyId, city } = req.query as { companyId?: string; city?: string };
    if (!companyId) {
      return res.status(400).json({ error: 'companyId is required' });
    }

    const quote = await getDeliveryFeeForArea(companyId, city || '');
    return res.json({
      deliveryFee: quote.fee,
      matchedArea: quote.matchedArea,
      fallbackApplied: !quote.matchedArea,
    });
  } catch (error) {
    console.error('Delivery fee quote error:', error);
    return res.status(500).json({ error: 'Failed to get delivery fee quote' });
  }
});

// ============================
// GET DELIVERY AREAS (SUGGESTIONS)
// ============================
router.get('/delivery-areas', authenticate, async (req: AuthRequest, res) => {
  try {
    const { companyId } = req.query as { companyId?: string };
    if (!companyId) {
      return res.status(400).json({ error: 'companyId is required' });
    }

    const { data, error } = await supabase
      .from('delivery_areas')
      .select('id, area_name, delivery_fee, is_active')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('area_name', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Get delivery areas error:', error);
    res.status(500).json({ error: 'Failed to fetch delivery areas' });
  }
});

// ============================
// PUBLIC: Get active pickup branches for checkout
// ============================
router.get('/pickup-branches', async (req, res) => {
  try {
    const { companyId } = req.query as { companyId?: string };
    if (!companyId) return res.status(400).json({ error: 'companyId is required' });
    const { data, error } = await supabase
      .from('pickup_branches')
      .select('id, branch_name, address, phone, is_active')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return res.json(data || []);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ============================
// CREATE ORDER (SECURE WITH NOTIFICATIONS)
// ============================
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { items, formData, itemInstructions } = req.body;

    // ============================
    // 1. VALIDATE REQUIRED DATA
    // ============================
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    if (!formData?.fullName || !formData?.email || !formData?.phone) {
      return res.status(400).json({ error: 'Missing required customer information' });
    }

    const fulfillmentMode = formData.fulfillmentMode || 'delivery';
    const isPickup        = fulfillmentMode === 'pickup';

    const deliveryValidation = validateDeliveryForm(formData, isPickup);
    if (deliveryValidation) {
      return res.status(400).json({ error: deliveryValidation });
    }

    const pickupBranchId   = formData.pickupBranchId   || null;
    const pickupBranchName = formData.pickupBranchName || null;

    // ============================
    // 2. FETCH REAL PRODUCT DATA FROM DATABASE
    // ============================
    const productIds = items.map((item: any) => item.id);

    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id, name, price, base_price, variants, stock_quantity, company_id, is_available')
      .in('id', productIds);

    if (productError) {
      console.error('Product fetch error:', productError);
      return res.status(500).json({ error: 'Failed to fetch product information' });
    }

    if (!products || products.length === 0) {
      return res.status(400).json({ error: 'No valid products found' });
    }

    // ============================
    // 3. VALIDATE EACH PRODUCT (Stock, Availability)
    // ============================
    let subtotal = 0;
    const orderItems = [];
    const companiesSet = new Set<string>();

    for (const item of items) {
      const product = products.find((p: any) => p.id === item.id);

      if (!product) {
        return res.status(400).json({ error: `Product not found: ${item.id}` });
      }

      if (!product.is_available) {
        return res.status(400).json({ error: `${product.name} is currently not available` });
      }

      if (product.stock_quantity < item.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for ${product.name}. Only ${product.stock_quantity} left.`,
        });
      }

      companiesSet.add(product.company_id);

      const instruction = itemInstructions?.find(
        (i: any) => i.product_id === item.id
      )?.instruction;

      const priceToUse = item.product_price;

      // Optional price validation (prevent price manipulation)
      let isValidPrice = false;
      if (product.variants && product.variants.length > 0) {
        isValidPrice = product.variants.some((v: any) => v.price === priceToUse);
      } else if (product.base_price !== null) {
        isValidPrice = Math.abs(product.base_price - priceToUse) < 0.01;
      } else if (product.price !== null) {
        isValidPrice = Math.abs(product.price - priceToUse) < 0.01;
      }

      if (!isValidPrice) {
        return res.status(400).json({ error: `Invalid price for ${product.name}` });
      }

      subtotal += priceToUse * item.quantity;

      orderItems.push({
        product_id:           product.id,
        product_name:         product.name,
        product_price:        priceToUse,
        quantity:             item.quantity,
        special_instructions: instruction || null,
      });
    }

    // ============================
    // 4. VALIDATE SAME COMPANY
    // ============================
    if (companiesSet.size !== 1) {
      return res.status(400).json({
        error: 'All items must be from the same restaurant. Please order from one restaurant at a time.',
      });
    }

    const companyId = Array.from(companiesSet)[0] as string;

    // ============================
    // 5. CALCULATE TOTALS
    // ============================
    // Pickup orders have no delivery fee
    let finalDeliveryFee = 0;
    if (!isPickup) {
      const deliveryQuote  = await getDeliveryFeeForArea(companyId, formData.city);
      finalDeliveryFee     = deliveryQuote.fee;
    }
    const total = subtotal + finalDeliveryFee;

    // ============================
    // 6. GENERATE ORDER NUMBER
    // ============================
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;

    // ============================
    // 7. BUILD HUMAN-READABLE LABELS (reused in order + notifications)
    // ============================
    const paymentMethodRaw = formData.paymentMethod as string;
    const paymentLabel =
      paymentMethodRaw === 'cash'         ? 'Cash on Delivery' :
      paymentMethodRaw === 'mobile_money' ? 'Mobile Money'     :
      paymentMethodRaw === 'card'         ? 'Card'             :
      paymentMethodRaw;

    const fulfillmentLabel = isPickup ? 'Pickup' : 'Delivery';

    const { deliveryAddress, deliveryLatitude, deliveryLongitude } =
      buildDeliveryAddressInfo(formData, isPickup);

    // Location line shown in notifications
    const locationLine = isPickup
      ? (pickupBranchName ? `Branch: ${pickupBranchName}` : 'Pickup from store')
      : `Deliver to: ${deliveryAddress}`;

    // ============================
    // 8. CREATE ORDER IN DATABASE
    // ============================
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number:            orderNumber,
        user_id:                 req.user?.id,
        company_id:              companyId,
        subtotal,
        delivery_fee:            finalDeliveryFee,
        total,
        customer_name:           formData.fullName.trim(),
        customer_email:          formData.email.trim().toLowerCase(),
        customer_phone:          formData.phone.trim(),
        delivery_address:        deliveryAddress,
        delivery_latitude:       deliveryLatitude,
        delivery_longitude:      deliveryLongitude,
        special_instructions:    formData.notes?.trim() || null,
        payment_method:          paymentMethodRaw,         // ✅ dynamic — cash / mobile_money / card
        status:                  'pending',
        estimated_delivery_time: new Date(Date.now() + 45 * 60_000).toISOString(),
        pickup_branch_id:        pickupBranchId,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      throw new Error('Failed to create order');
    }

    // ============================
    // 9. INSERT ORDER ITEMS
    // ============================
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems.map((item) => ({ ...item, order_id: order.id })));

    if (itemsError) {
      console.error('Order items insertion error:', itemsError);
      await supabase.from('orders').delete().eq('id', order.id);
      throw new Error('Failed to insert order items');
    }

    // ============================
    // 10. UPDATE PRODUCT STOCK
    // ============================
    await Promise.all(
      items.map((item: any) => {
        const product = products.find((p: any) => p.id === item.id)!;
        return supabase
          .from('products')
          .update({
            stock_quantity: product.stock_quantity - item.quantity,
            updated_at:     new Date().toISOString(),
          })
          .eq('id', item.id);
      })
    );

    // ============================
    // 11. CREATE TRACKING ENTRY
    // ============================
    await supabase.from('order_tracking').insert({
      order_id: order.id,
      status:   'pending',
      message:  'Order placed successfully',
    });

    // ============================
    // 12. CLEAR USER'S CART
    // ============================
    await supabase
      .from('carts')
      .update({ items: [], updated_at: new Date().toISOString() })
      .eq('user_id', req.user?.id)
      .eq('status', 'active');

    // ============================
    // 13. SEND NOTIFICATIONS
    // ============================
    if (req.user?.id) {
      await createNotification(
        req.user.id,
        companyId,
        'order',
        '✅ Order Confirmed!',
        `Your order #${orderNumber} is confirmed.\nTotal: ₵${total.toFixed(2)} | ${paymentLabel} | ${fulfillmentLabel}\n${locationLine}`,
        {
          orderId:          order.id,
          orderNumber,
          total,
          itemCount:        orderItems.length,
          payment_method:   paymentMethodRaw,
          fulfillment_mode: fulfillmentMode,
          delivery_address: isPickup ? null : deliveryAddress,
          pickup_branch_id: isPickup ? pickupBranchId   : null,
          pickup_branch:    isPickup ? pickupBranchName  : null,
        }
      );
    }

    const { data: companyAdmin } = await supabase
      .from('users')
      .select('id')
      .eq('company_id', companyId)
      .eq('role', 'company_admin')
      .single();

    const adminNotificationData = {
      orderId:          order.id,
      orderNumber,
      customerName:     formData.fullName,
      total,
      itemCount:        orderItems.length,
      payment_method:   paymentMethodRaw,
      fulfillment_mode: fulfillmentMode,
      delivery_address: isPickup ? null : deliveryAddress,
      pickup_branch_id: isPickup ? pickupBranchId   : null,
      pickup_branch:    isPickup ? pickupBranchName  : null,
    };
    const adminNotificationMessage =
      `Order #${orderNumber} from ${formData.fullName}.\nTotal: ₵${total.toFixed(2)} | ${paymentLabel} | ${fulfillmentLabel}\n${locationLine}`;

    if (companyAdmin?.id) {
      await createNotification(
        companyAdmin.id,
        companyId,
        'order',
        '🔔 New Order!',
        adminNotificationMessage,
        adminNotificationData
      );
    }

    await notifyPlatformAdmins(
      companyId,
      'order',
      '🔔 New Order (Platform)',
      adminNotificationMessage,
      adminNotificationData
    );

    if (!isPickup) {
      await notifyDeliveryGuys(
        companyId,
        'order',
        '📦 New Order Placed',
        `Order #${orderNumber} was placed — watch for ready status.`,
        { orderId: order.id, orderNumber, status: 'pending' }
      );
    }

    // ============================
    // 14. SUCCESS RESPONSE
    // ============================
    res.status(201).json({
      success:            true,
      message:            'Order created successfully',
      id:                 order.id,
      order_number:       orderNumber,
      estimated_delivery: order.estimated_delivery_time,
    });

  } catch (error: any) {
    console.error('Create order error:', error);
    const isClientError =
      error.message?.includes('not found') ||
      error.message?.includes('Insufficient stock') ||
      error.message?.includes('same restaurant');
    res.status(isClientError ? 400 : 500).json({
      error: error.message || 'Failed to create order. Please try again.',
    });
  }
});

// ============================
// GET USER'S ORDERS
// ============================
router.get('/my-orders', authenticate, async (req: AuthRequest, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*),
        companies (name, logo)
      `)
      .eq('user_id', req.user?.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const orders = data || [];
    if (!orders.length) return res.json([]);

    const productIds = Array.from(
      new Set(
        orders.flatMap((o: any) =>
          (o.order_items || []).map((i: any) => i.product_id).filter(Boolean)
        )
      )
    );

    const { data: productsData } = await supabase
      .from('products')
      .select('id, image_url')
      .in('id', productIds);

    const imageByProductId = new Map<string, string | null>(
      (productsData || []).map((p: any) => [p.id, p.image_url || null])
    );

    const transformed = orders.map((o: any) => ({
      ...o,
      order_items: (o.order_items || []).map((item: any) => ({
        ...item,
        image_url: imageByProductId.get(item.product_id) || null,
      })),
    }));

    res.json(transformed);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ============================
// GET DRIVER LOCATION FOR CUSTOMER (live map on Orders page)
// ============================
router.get('/:orderId/driver-location', authenticate, async (req: AuthRequest, res) => {
  try {
    const { orderId } = req.params;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, delivery_guy_id, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.user_id !== req.user?.id) {
      return res.status(403).json({ error: 'Not your order' });
    }

    if (!order.delivery_guy_id || order.status !== 'out_for_delivery') {
      return res.json({ location: null });
    }

    const { data: location, error: locError } = await supabase
      .from('delivery_locations')
      .select('latitude, longitude, accuracy, heading, speed, is_online, updated_at')
      .eq('delivery_guy_id', order.delivery_guy_id)
      .maybeSingle();

    if (locError) throw locError;

    return res.json({ location: location || null });
  } catch (error: any) {
    console.error('Driver location error:', error);
    return res.status(500).json({ error: 'Failed to fetch driver location' });
  }
});

// ============================
// GET SINGLE ORDER
// ============================
router.get('/:orderId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { orderId } = req.params;
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*),
        companies (name, logo, location, phone)
      `)
      .eq('id', orderId)
      .eq('user_id', req.user?.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Order not found' });
    res.json(data);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

export default router;