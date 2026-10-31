"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customerRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const dateRange_1 = require("../../common/dateRange");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const errors_1 = require("../../utils/errors");
const notification_service_1 = require("../notifications/notification.service");
const store_model_1 = require("../stores/store.model");
const customer_model_1 = require("./customer.model");
const customer_service_1 = require("./customer.service");
const base = zod_1.z.object({ name: zod_1.z.string().min(1), phone: zod_1.z.string().optional(), address: zod_1.z.string().optional(), note: zod_1.z.string().optional() });
exports.customerRoutes = (0, express_1.Router)();
exports.customerRoutes.use(auth_1.authenticate, (0, auth_1.requireModule)('customers'));
const canWrite = (0, auth_1.authorize)('superuser', 'admin', 'manager', 'cashier');
exports.customerRoutes.get('/', (0, errors_1.asyncHandler)(async (req, res) => {
    const { q, hasDue } = req.query;
    const filter = { storeId: (0, auth_1.getStoreId)(req), isActive: true };
    if (q)
        filter.$or = [{ name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }, { phone: new RegExp(q.replace(/\D/g, '') || '^$') }];
    if (hasDue === 'true')
        filter.dueBalance = { $gt: 0 };
    res.json(await customer_model_1.Customer.find(filter).sort('name').limit(200));
}));
exports.customerRoutes.post('/', canWrite, (0, validate_1.validate)(base), (0, errors_1.asyncHandler)(async (req, res) => {
    res.status(201).json(await customer_model_1.Customer.create({ ...req.body, storeId: (0, auth_1.getStoreId)(req) }));
}));
exports.customerRoutes.get('/:id', (0, errors_1.asyncHandler)(async (req, res) => {
    const storeId = (0, auth_1.getStoreId)(req);
    const c = await customer_model_1.Customer.findOne({ _id: req.params.id, storeId });
    if (!c)
        throw new errors_1.AppError(404, 'Customer not found');
    res.json({ customer: c, summary: { ...(await (0, customer_service_1.customerSummary)(storeId, String(c._id))), currentDue: c.dueBalance } });
}));
exports.customerRoutes.patch('/:id', canWrite, (0, validate_1.validate)(base.partial()), (0, errors_1.asyncHandler)(async (req, res) => {
    const c = await customer_model_1.Customer.findOneAndUpdate({ _id: req.params.id, storeId: (0, auth_1.getStoreId)(req) }, req.body, { new: true });
    if (!c)
        throw new errors_1.AppError(404, 'Customer not found');
    res.json(c);
}));
exports.customerRoutes.delete('/:id', (0, auth_1.authorize)('superuser', 'admin', 'manager'), (0, errors_1.asyncHandler)(async (req, res) => {
    const c = await customer_model_1.Customer.findOne({ _id: req.params.id, storeId: (0, auth_1.getStoreId)(req) });
    if (!c)
        throw new errors_1.AppError(404, 'Customer not found');
    if (c.dueBalance > 0)
        throw new errors_1.AppError(409, 'Customer still has outstanding dues');
    c.isActive = false;
    await c.save();
    res.json({ message: 'Customer deleted' });
}));
// Individual expense / ledger history
// Filters: date range (preset/month/year/from/to) and type=sale|payment|adjustment
exports.customerRoutes.get('/:id/ledger', (0, errors_1.asyncHandler)(async (req, res) => {
    const filter = { storeId: (0, auth_1.getStoreId)(req), customerId: req.params.id };
    const range = (0, dateRange_1.dateRange)(req.query);
    if (range)
        filter.createdAt = range;
    const type = req.query.type;
    if (type && ['sale', 'payment', 'adjustment'].includes(type))
        filter.type = type;
    const entries = await customer_model_1.LedgerEntry.find(filter).sort('-createdAt').limit(500);
    const sum = (t) => entries.filter((e) => e.type === t).reduce((s, e) => s + e.amount, 0);
    res.json({ entries, totals: { purchased: sum('sale'), paid: sum('payment') } });
}));
// Record a payment against dues
exports.customerRoutes.post('/:id/payments', canWrite, (0, validate_1.validate)(zod_1.z.object({ amount: zod_1.z.number().positive(), note: zod_1.z.string().optional() })), (0, errors_1.asyncHandler)(async (req, res) => {
    const storeId = (0, auth_1.getStoreId)(req);
    const c = await customer_model_1.Customer.findOne({ _id: req.params.id, storeId });
    if (!c)
        throw new errors_1.AppError(404, 'Customer not found');
    if (req.body.amount > c.dueBalance)
        throw new errors_1.AppError(400, `Amount exceeds outstanding due (${c.dueBalance})`);
    const updated = await (0, customer_service_1.postLedger)({ storeId, customerId: c._id, type: 'payment', amount: req.body.amount, dueDelta: -req.body.amount, note: req.body.note, userId: req.user.id });
    await (0, notification_service_1.notify)(storeId, 'payment_received', `Payment from ${c.name}`, `৳${req.body.amount} received. Remaining due: ৳${updated.dueBalance}`);
    res.json(updated);
}));
// Share dues on WhatsApp via click-to-chat link (no WhatsApp API approval needed)
exports.customerRoutes.get('/:id/whatsapp-dues', (0, errors_1.asyncHandler)(async (req, res) => {
    const storeId = (0, auth_1.getStoreId)(req);
    const [c, store] = await Promise.all([customer_model_1.Customer.findOne({ _id: req.params.id, storeId }), store_model_1.Store.findById(storeId)]);
    if (!c)
        throw new errors_1.AppError(404, 'Customer not found');
    if (!c.phone)
        throw new errors_1.AppError(400, 'Customer has no phone number');
    if (c.dueBalance <= 0)
        throw new errors_1.AppError(400, 'Customer has no outstanding dues');
    const message = `Hello ${c.name},\nYour outstanding due at ${store?.name} is ৳${c.dueBalance}.\nPlease pay at your earliest convenience. Thank you!`;
    res.json({ message, url: `https://wa.me/${(0, customer_service_1.toWhatsAppNumber)(c.phone)}?text=${encodeURIComponent(message)}` });
}));
