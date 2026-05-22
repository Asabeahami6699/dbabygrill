// backend/src/routes/notification.routes.ts
import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { supabase } from '../config/supabase';

const router = Router();

// Get all notifications for the authenticated user
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user?.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.patch('/:id/read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', req.user?.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.post('/read-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', req.user?.id)
      .eq('read', false);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// Delete notification
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user?.id);

    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Helper function to create notification (used by other routes)
export const createNotification = async (
  userId: string,
  companyId: string,
  type: 'order' | 'payment' | 'system' | 'alert',
  title: string,
  message: string,
  data?: any
) => {
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      company_id: companyId,
      type,
      title,
      message,
      data,
    });
    if (error) console.error('Failed to create notification:', error);
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};

/** Notify all active delivery drivers for a company */
export const notifyDeliveryGuys = async (
  companyId: string,
  type: 'order' | 'payment' | 'system' | 'alert',
  title: string,
  message: string,
  data?: any
) => {
  try {
    const { data: drivers, error } = await supabase
      .from('delivery_guys')
      .select('user_id')
      .eq('company_id', companyId)
      .eq('is_active', true);

    if (error) {
      console.error('notifyDeliveryGuys lookup error:', error);
      return;
    }

    await Promise.all(
      (drivers || [])
        .filter((d) => d.user_id)
        .map((d) => createNotification(d.user_id, companyId, type, title, message, data))
    );
  } catch (err) {
    console.error('notifyDeliveryGuys error:', err);
  }
};

/** Notify platform admins (role = admin) */
export const notifyPlatformAdmins = async (
  companyId: string,
  type: 'order' | 'payment' | 'system' | 'alert',
  title: string,
  message: string,
  data?: any
) => {
  try {
    const { data: admins, error } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin');

    if (error) {
      console.error('notifyPlatformAdmins lookup error:', error);
      return;
    }

    await Promise.all(
      (admins || []).map((a) => createNotification(a.id, companyId, type, title, message, data))
    );
  } catch (err) {
    console.error('notifyPlatformAdmins error:', err);
  }
};

export default router;