import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount
} from '../services/notification.js';

export const notificationsRouter = Router();

// GET /api/notifications - Get user notifications
notificationsRouter.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { unreadOnly, limit } = req.query;

    const notifications = await getUserNotifications(req.user!.id, {
      unreadOnly: unreadOnly === 'true',
      limit: limit ? parseInt(limit as string) : undefined
    });

    const unreadCount = await getUnreadCount(req.user!.id);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/notifications/count - Get unread count only
notificationsRouter.get('/count', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const count = await getUnreadCount(req.user!.id);

    res.json({
      success: true,
      data: { unreadCount: count }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/notifications/:id/read - Mark single notification as read
notificationsRouter.post('/:id/read', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await markNotificationAsRead(req.params.id, req.user!.id);

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/notifications/read-all - Mark all notifications as read
notificationsRouter.post('/read-all', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await markAllNotificationsAsRead(req.user!.id);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    next(error);
  }
});
