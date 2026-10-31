"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationRoutes = void 0;
const express_1 = require("express");
const dateRange_1 = require("../../common/dateRange");
const auth_1 = require("../../middleware/auth");
const errors_1 = require("../../utils/errors");
const notification_model_1 = require("./notification.model");
exports.notificationRoutes = (0, express_1.Router)();
exports.notificationRoutes.use(auth_1.authenticate, (0, auth_1.requireModule)('notifications'));
exports.notificationRoutes.get('/', (0, errors_1.asyncHandler)(async (req, res) => {
    const filter = { storeId: (0, auth_1.getStoreId)(req) };
    if (req.query.unread === 'true')
        filter.isRead = false;
    const type = req.query.type;
    if (type && ['low_stock', 'customer_due', 'payment_received', 'subscription', 'system'].includes(type))
        filter.type = type;
    const range = (0, dateRange_1.dateRange)(req.query);
    if (range)
        filter.createdAt = range;
    const [items, unreadCount] = await Promise.all([
        notification_model_1.Notification.find(filter).sort('-createdAt').limit(100),
        notification_model_1.Notification.countDocuments({ storeId: (0, auth_1.getStoreId)(req), isRead: false }),
    ]);
    res.json({ unreadCount, items });
}));
exports.notificationRoutes.patch('/read-all', (0, errors_1.asyncHandler)(async (req, res) => {
    await notification_model_1.Notification.updateMany({ storeId: (0, auth_1.getStoreId)(req), isRead: false }, { isRead: true });
    res.json({ message: 'All marked as read' });
}));
exports.notificationRoutes.patch('/:id/read', (0, errors_1.asyncHandler)(async (req, res) => {
    const n = await notification_model_1.Notification.findOneAndUpdate({ _id: req.params.id, storeId: (0, auth_1.getStoreId)(req) }, { isRead: true }, { new: true });
    if (!n)
        throw new errors_1.AppError(404, 'Notification not found');
    res.json(n);
}));
