import { Router } from 'express';
import { dateRange } from '../../common/dateRange';
import { authenticate, getStoreId, requireModule } from '../../middleware/auth';
import { AppError, asyncHandler } from '../../utils/errors';
import { Notification } from './notification.model';

export const notificationRoutes = Router();
notificationRoutes.use(authenticate, requireModule('notifications'));

notificationRoutes.get('/', asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = { storeId: getStoreId(req) };
  if (req.query.unread === 'true') filter.isRead = false;
  const type = req.query.type as string | undefined;
  if (type && ['low_stock', 'customer_due', 'payment_received', 'subscription', 'system'].includes(type)) filter.type = type;
  const range = dateRange(req.query);
  if (range) filter.createdAt = range;
  const [items, unreadCount] = await Promise.all([
    Notification.find(filter).sort('-createdAt').limit(100),
    Notification.countDocuments({ storeId: getStoreId(req), isRead: false }),
  ]);
  res.json({ unreadCount, items });
}));

notificationRoutes.patch('/read-all', asyncHandler(async (req, res) => {
  await Notification.updateMany({ storeId: getStoreId(req), isRead: false }, { isRead: true });
  res.json({ message: 'All marked as read' });
}));

notificationRoutes.patch('/:id/read', asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, storeId: getStoreId(req) }, { isRead: true }, { new: true });
  if (!n) throw new AppError(404, 'Notification not found');
  res.json(n);
}));
