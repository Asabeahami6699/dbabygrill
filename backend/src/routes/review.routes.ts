// backend/src/routes/review.routes.ts
import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { supabase } from '../config/supabase';
import { createNotification } from './notification.routes';

const router = Router();

const isMissingProductIdColumnError = (error: any) => {
  const message = String(error?.message || '');
  const code = String(error?.code || '');
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    message.includes('order_reviews.product_id') ||
    message.includes("'product_id' column of 'order_reviews'")
  );
};

const isMissingReviewResolutionSchemaError = (error: any) => {
  const message = String(error?.message || '');
  const code = String(error?.code || '');
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    message.includes('order_reviews.issue_resolved') ||
    message.includes('order_reviews.resolved_at') ||
    message.includes('rating_reminders') ||
    message.includes("relation \"rating_reminders\" does not exist")
  );
};

// PUBLIC — customer reviews for a restaurant (same data as RatingModal submits via POST /)
router.get('/company/:companyId/public', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('company_id', companyId);

    if (ordersError) throw ordersError;

    const orderIds = (orders || []).map((o: { id: string }) => o.id);
    if (orderIds.length === 0) {
      return res.json({ reviews: [], averageRating: 0, totalReviews: 0 });
    }

    // ✅ FIX: added owner_response and owner_responded_at
    const { data, error } = await supabase
      .from('order_reviews')
      .select(`
        id,
        rating,
        review_text,
        created_at,
        owner_response,
        owner_responded_at,
        orders ( order_number, customer_name )
      `)
      .in('order_id', orderIds)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const list = data || [];
    const totalReviews = list.length;
    const averageRating =
      totalReviews > 0 ? list.reduce((sum, r: { rating: number }) => sum + r.rating, 0) / totalReviews : 0;

    res.json({
      reviews: list,
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews,
    });
  } catch (error) {
    console.error('Get public company reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Submit a review
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, productId, rating, reviewText } = req.body;

    if (!orderId || !productId || !rating) {
      return res.status(400).json({ error: 'Order ID, product ID and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if order belongs to user
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, order_number, company_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.user_id !== req.user?.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Ensure the rated product is part of this order
    const { data: orderItem, error: orderItemError } = await supabase
      .from('order_items')
      .select('id, product_id')
      .eq('order_id', orderId)
      .eq('product_id', productId)
      .maybeSingle();

    if (orderItemError) throw orderItemError;
    if (!orderItem) {
      return res.status(400).json({ error: 'Rated product is not part of this order' });
    }

    // Check if review already exists for this order+product
    const { data: existingReview } = await supabase
      .from('order_reviews')
      .select('id')
      .eq('order_id', orderId)
      .eq('product_id', productId)
      .maybeSingle();

    if (existingReview) {
      return res.status(400).json({ error: 'Review already submitted for this product in this order' });
    }

    // Create review
    const { data: review, error: reviewError } = await supabase
      .from('order_reviews')
      .insert({
        order_id: orderId,
        product_id: productId,
        user_id: req.user?.id,
        rating,
        review_text: reviewText || null
      })
      .select()
      .single();

    if (reviewError) throw reviewError;

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      review
    });
  } catch (error) {
    console.error('Submit review error:', error);
    if (isMissingProductIdColumnError(error)) {
      return res.status(400).json({
        error:
          'Product ratings are not enabled yet. Run the latest database migration to add order_reviews.product_id.',
      });
    }
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// PUBLIC - Product-specific reviews for Product Detail page
router.get('/product/:productId/public', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    // ✅ FIX: added owner_response and owner_responded_at
    const { data, error } = await supabase
      .from('order_reviews')
      .select(`
        id,
        rating,
        review_text,
        created_at,
        owner_response,
        owner_responded_at,
        orders ( order_number, customer_name )
      `)
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const list = data || [];
    const totalReviews = list.length;
    const averageRating =
      totalReviews > 0 ? list.reduce((sum, r: { rating: number }) => sum + r.rating, 0) / totalReviews : 0;

    res.json({
      reviews: list,
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews,
    });
  } catch (error) {
    console.error('Get public product reviews error:', error);
    if (isMissingProductIdColumnError(error)) {
      return res.status(400).json({
        error:
          'Product ratings are not enabled yet. Run the latest database migration to add order_reviews.product_id.',
      });
    }
    res.status(500).json({ error: 'Failed to fetch product reviews' });
  }
});

// Company dashboard - product-level ratings, highlight poor reviews
router.get('/company/:companyId/products', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.params;
    if (req.user?.role !== 'company_admin' || req.user.company_id !== companyId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { data: reviews, error } = await supabase
      .from('order_reviews')
      .select(`
        id,
        product_id,
        rating,
        review_text,
        owner_response,
        owner_responded_at,
        issue_resolved,
        resolved_at,
        created_at,
        orders!inner ( company_id, customer_name )
      `)
      .eq('orders.company_id', companyId)
      .not('product_id', 'is', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const { data: companyProducts, error: productsError } = await supabase
      .from('products')
      .select('id, name')
      .eq('company_id', companyId);
    if (productsError) throw productsError;

    const productNameById = new Map<string, string>(
      (companyProducts || []).map((p: { id: string; name: string }) => [p.id, p.name])
    );

    const grouped = new Map<string, {
      productId: string;
      productName: string;
      averageRating: number;
      totalReviews: number;
      lowRatings: Array<{ id: string; rating: number; reviewText: string | null; customerName: string; createdAt: string }>;
      recentReviews: Array<{
        id: string;
        rating: number;
        reviewText: string | null;
        customerName: string;
        createdAt: string;
        ownerResponse: string | null;
        ownerRespondedAt: string | null;
        issueResolved: boolean;
        resolvedAt: string | null;
      }>;
    }>();

    (reviews || []).forEach((r: any) => {
      const pid = r.product_id as string;
      if (!pid) return;
      const current = grouped.get(pid) || {
        productId: pid,
        productName: productNameById.get(pid) || 'Unknown product',
        averageRating: 0,
        totalReviews: 0,
        lowRatings: [],
        recentReviews: [],
      };

      current.totalReviews += 1;
      current.averageRating += Number(r.rating || 0);
      if (Number(r.rating) <= 2) {
        current.lowRatings.push({
          id: r.id,
          rating: Number(r.rating || 0),
          reviewText: r.review_text || null,
          customerName: r.orders?.customer_name || 'Customer',
          createdAt: r.created_at,
        });
      }
      current.recentReviews.push({
        id: r.id,
        rating: Number(r.rating || 0),
        reviewText: r.review_text || null,
        customerName: r.orders?.customer_name || 'Customer',
        createdAt: r.created_at,
        ownerResponse: r.owner_response || null,
        ownerRespondedAt: r.owner_responded_at || null,
        issueResolved: Boolean(r.issue_resolved),
        resolvedAt: r.resolved_at || null,
      });

      grouped.set(pid, current);
    });

    const productRatings = Array.from(grouped.values()).map((p) => ({
      ...p,
      averageRating: p.totalReviews > 0 ? Math.round((p.averageRating / p.totalReviews) * 10) / 10 : 0,
      lowRatings: p.lowRatings.slice(0, 5),
      recentReviews: p.recentReviews.slice(0, 20),
    }));

    res.json({
      products: productRatings,
      totalProductsWithReviews: productRatings.length,
      totalLowRatings: productRatings.reduce((sum, p) => sum + p.lowRatings.length, 0),
    });
  } catch (error) {
    console.error('Get company product reviews error:', error);
    if (isMissingReviewResolutionSchemaError(error)) {
      return res.status(400).json({
        error:
          'Ratings resolution features are not enabled yet. Run migration 004_review_resolution_status.sql.',
      });
    }
    if (isMissingProductIdColumnError(error)) {
      return res.status(400).json({
        error:
          'Product ratings are not enabled yet. Run the latest database migration to add order_reviews.product_id.',
      });
    }
    res.status(500).json({ error: 'Failed to fetch product ratings' });
  }
});

// Company owner responds to a product rating.
router.patch('/:reviewId/respond', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'company_admin') {
      return res.status(403).json({ error: 'Only company admins can respond to ratings' });
    }

    const { reviewId } = req.params;
    const { response } = req.body as { response?: string };
    const ownerResponse = (response || '').trim();

    if (!ownerResponse) {
      return res.status(400).json({ error: 'Response text is required' });
    }

    const { data: reviewRow, error: reviewError } = await supabase
      .from('order_reviews')
      .select(`
        id,
        user_id,
        product_id,
        orders!inner (
          id,
          company_id
        )
      `)
      .eq('id', reviewId)
      .maybeSingle();

    if (reviewError) throw reviewError;
    if (!reviewRow) return res.status(404).json({ error: 'Review not found' });
    const reviewOrder = Array.isArray((reviewRow as any).orders)
      ? (reviewRow as any).orders[0]
      : (reviewRow as any).orders;
    if (!reviewOrder || reviewOrder.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Unauthorized for this review' });
    }

    const { data, error } = await supabase
      .from('order_reviews')
      .update({
        owner_response: ownerResponse,
        owner_responded_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .select('*')
      .single();

    if (error) throw error;

    if (reviewRow.user_id) {
      await createNotification(
        reviewRow.user_id,
        req.user.company_id || '',
        'alert',
        'Restaurant replied to your rating',
        'You received feedback on your product rating. Tap to view your orders.',
        { reviewId, orderId: reviewOrder.id, productId: reviewRow.product_id }
      );
    }

    res.json({ success: true, review: data });
  } catch (error) {
    console.error('Respond to review error:', error);
    if (isMissingReviewResolutionSchemaError(error)) {
      return res.status(400).json({
        error:
          'Ratings resolution features are not enabled yet. Run migration 004_review_resolution_status.sql.',
      });
    }
    if (isMissingProductIdColumnError(error)) {
      return res.status(400).json({
        error:
          'Product ratings are not enabled yet. Run the latest database migration to add order_reviews.product_id.',
      });
    }
    res.status(500).json({ error: 'Failed to respond to review' });
  }
});

// Company owner marks a review issue resolved/unresolved.
router.patch('/:reviewId/resolve', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'company_admin') {
      return res.status(403).json({ error: 'Only company admins can update review resolution status' });
    }

    const { reviewId } = req.params;
    const { resolved } = req.body as { resolved?: boolean };
    if (typeof resolved !== 'boolean') {
      return res.status(400).json({ error: 'resolved must be a boolean' });
    }

    const { data: reviewRow, error: reviewError } = await supabase
      .from('order_reviews')
      .select(`
        id,
        orders!inner (
          company_id
        )
      `)
      .eq('id', reviewId)
      .maybeSingle();
    if (reviewError) throw reviewError;
    if (!reviewRow) return res.status(404).json({ error: 'Review not found' });

    const reviewOrder = Array.isArray((reviewRow as any).orders)
      ? (reviewRow as any).orders[0]
      : (reviewRow as any).orders;
    if (!reviewOrder || reviewOrder.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Unauthorized for this review' });
    }

    const { data, error } = await supabase
      .from('order_reviews')
      .update({
        issue_resolved: resolved,
        resolved_at: resolved ? new Date().toISOString() : null,
      })
      .eq('id', reviewId)
      .select('*')
      .single();
    if (error) throw error;

    res.json({ success: true, review: data });
  } catch (error) {
    console.error('Update review resolve status error:', error);
    if (isMissingReviewResolutionSchemaError(error)) {
      return res.status(400).json({
        error:
          'Ratings resolution features are not enabled yet. Run migration 004_review_resolution_status.sql.',
      });
    }
    res.status(500).json({ error: 'Failed to update resolve status' });
  }
});

// Customer reminder runner: once daily, max 3 reminders for unrated delivered items within 3 days.
router.post('/reminders/run', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data: deliveredOrders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        company_id,
        order_items (
          product_id,
          product_name
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'delivered')
      .gte('updated_at', threeDaysAgo);
    if (ordersError) throw ordersError;

    if (!deliveredOrders?.length) {
      return res.json({ success: true, remindersSent: 0 });
    }

    const orderIds = deliveredOrders.map((o: any) => o.id);
    const { data: existingReviews, error: reviewsError } = await supabase
      .from('order_reviews')
      .select('order_id, product_id')
      .in('order_id', orderIds);
    if (reviewsError && !isMissingProductIdColumnError(reviewsError)) throw reviewsError;

    const reviewedKeys = new Set(
      (existingReviews || []).map((r: any) => `${r.order_id}:${r.product_id || ''}`)
    );

    let remindersSent = 0;
    for (const order of deliveredOrders as any[]) {
      for (const item of order.order_items || []) {
        const key = `${order.id}:${item.product_id || ''}`;
        if (!item.product_id || reviewedKeys.has(key)) continue;

        const { data: reminderRow, error: reminderError } = await supabase
          .from('rating_reminders')
          .select('id, reminder_count, last_sent_at')
          .eq('user_id', userId)
          .eq('order_id', order.id)
          .eq('product_id', item.product_id)
          .maybeSingle();
        if (reminderError) throw reminderError;

        const lastSentAt = reminderRow?.last_sent_at ? new Date(reminderRow.last_sent_at) : null;
        const sentToday =
          lastSentAt &&
          lastSentAt.getUTCFullYear() === now.getUTCFullYear() &&
          lastSentAt.getUTCMonth() === now.getUTCMonth() &&
          lastSentAt.getUTCDate() === now.getUTCDate();

        if ((reminderRow?.reminder_count || 0) >= 3 || sentToday) continue;

        if (reminderRow?.id) {
          await supabase
            .from('rating_reminders')
            .update({
              reminder_count: (reminderRow.reminder_count || 0) + 1,
              last_sent_at: now.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq('id', reminderRow.id);
        } else {
          await supabase.from('rating_reminders').insert({
            user_id: userId,
            order_id: order.id,
            product_id: item.product_id,
            reminder_count: 1,
            last_sent_at: now.toISOString(),
            updated_at: now.toISOString(),
          });
        }

        await createNotification(
          userId,
          order.company_id || '',
          'system',
          'Rate your meal',
          `How was "${item.product_name || 'your meal'}"? Your feedback helps improve quality.`,
          { orderId: order.id, productId: item.product_id }
        );
        remindersSent += 1;
      }
    }

    res.json({ success: true, remindersSent });
  } catch (error) {
    console.error('Run rating reminders error:', error);
    if (isMissingReviewResolutionSchemaError(error)) {
      return res.status(400).json({
        error:
          'Rating reminder features are not enabled yet. Run migration 003_review_feedback_and_reminders.sql and 004_review_resolution_status.sql.',
      });
    }
    if (isMissingProductIdColumnError(error)) {
      return res.status(400).json({
        error:
          'Product ratings are not enabled yet. Run the latest database migration to add order_reviews.product_id.',
      });
    }
    res.status(500).json({ error: 'Failed to run rating reminders' });
  }
});

// Get reviews for an order
router.get('/order/:orderId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.params;

    const { data, error } = await supabase
      .from('order_reviews')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json(data || null);
  } catch (error) {
    console.error('Get review error:', error);
    res.status(500).json({ error: 'Failed to fetch review' });
  }
});

// Get company reviews (for restaurant dashboard)
router.get('/company/:companyId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.params;

    const { data, error } = await supabase
      .from('order_reviews')
      .select(`
        *,
        orders (
          order_number,
          customer_name
        )
      `)
      .eq('orders.company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const averageRating = data?.length
      ? data.reduce((sum, r) => sum + r.rating, 0) / data.length
      : 0;

    res.json({
      reviews: data || [],
      averageRating,
      totalReviews: data?.length || 0
    });
  } catch (error) {
    console.error('Get company reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

export default router;