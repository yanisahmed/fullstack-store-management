"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saleRoutes = void 0;
const express_1 = require("express");
const mongoose_1 = require("mongoose");
const zod_1 = require("zod");
const dateRange_1 = require("../../common/dateRange");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const errors_1 = require("../../utils/errors");
const sale_model_1 = require("./sale.model");
const sale_service_1 = require("./sale.service");
const saleSchema = zod_1.z.object({
    customerId: zod_1.z.string().optional(),
    items: zod_1.z.array(zod_1.z.object({ productId: zod_1.z.string(), quantity: zod_1.z.number().positive(), unitPrice: zod_1.z.number().min(0).optional() })).min(1),
    discount: zod_1.z.number().min(0).optional(),
    paidAmount: zod_1.z.number().min(0).optional(),
    paymentMethod: zod_1.z.enum(['cash', 'bkash', 'nagad', 'card', 'other']).optional(),
});
exports.saleRoutes = (0, express_1.Router)();
exports.saleRoutes.use(auth_1.authenticate, (0, auth_1.requireModule)('sales'));
/**
 * Shared filter for list + summary.
 * Query: preset | month | year | from & to   (date)
 *        customerId, paymentMethod, status=due|paid, q (invoice no.)
 */
function saleFilter(req) {
    const { customerId, paymentMethod, status, q } = req.query;
    const filter = { storeId: new mongoose_1.Types.ObjectId((0, auth_1.getStoreId)(req)) };
    if (customerId) {
        if (!mongoose_1.Types.ObjectId.isValid(customerId))
            throw new errors_1.AppError(400, 'Invalid customerId');
        filter.customerId = new mongoose_1.Types.ObjectId(customerId);
    }
    if (paymentMethod && ['cash', 'bkash', 'nagad', 'card', 'other'].includes(paymentMethod))
        filter.paymentMethod = paymentMethod;
    if (status === 'due')
        filter.dueAmount = { $gt: 0 };
    if (status === 'paid')
        filter.dueAmount = { $lte: 0 };
    if (q)
        filter.invoiceNo = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const range = (0, dateRange_1.dateRange)(req.query);
    if (range)
        filter.createdAt = range;
    return filter;
}
exports.saleRoutes.post('/', (0, auth_1.authorize)('superuser', 'admin', 'manager', 'cashier'), (0, validate_1.validate)(saleSchema), (0, errors_1.asyncHandler)(async (req, res) => {
    res.status(201).json(await (0, sale_service_1.createSale)((0, auth_1.getStoreId)(req), req.user.id, req.body));
}));
exports.saleRoutes.get('/', (0, errors_1.asyncHandler)(async (req, res) => {
    const { page = '1', limit = '20' } = req.query;
    const filter = saleFilter(req);
    const p = Math.max(+page, 1), l = Math.min(+limit, 100);
    const [items, total] = await Promise.all([
        sale_model_1.Sale.find(filter).populate('customerId', 'name phone').sort('-createdAt').skip((p - 1) * l).limit(l),
        sale_model_1.Sale.countDocuments(filter),
    ]);
    res.json({ items, total, page: p, pages: Math.ceil(total / l) });
}));
// Totals for the same filters, plus a per-day breakdown (days are the SHOP's days, not UTC)
exports.saleRoutes.get('/summary', (0, errors_1.asyncHandler)(async (req, res) => {
    const filter = saleFilter(req);
    const canSeeProfit = req.user.roles.some((r) => ['superuser', 'admin', 'manager'].includes(r));
    const withCost = { $addFields: { cost: { $sum: { $map: { input: '$items', as: 'i', in: { $multiply: ['$$i.quantity', '$$i.costPrice'] } } } } } };
    const [[t], byDay] = await Promise.all([
        sale_model_1.Sale.aggregate([
            { $match: filter }, withCost,
            { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$total' }, paid: { $sum: '$paidAmount' }, due: { $sum: '$dueAmount' }, discount: { $sum: '$discount' }, cost: { $sum: '$cost' } } },
        ]),
        sale_model_1.Sale.aggregate([
            { $match: filter }, withCost,
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: (0, dateRange_1.tzString)() } }, count: { $sum: 1 }, total: { $sum: '$total' }, due: { $sum: '$dueAmount' }, cost: { $sum: '$cost' } } },
            { $sort: { _id: -1 } },
            { $limit: 366 },
        ]),
    ]);
    const totals = t ?? { count: 0, total: 0, paid: 0, due: 0, discount: 0, cost: 0 };
    const round = (n) => Math.round(n * 100) / 100;
    res.json({
        count: totals.count,
        total: round(totals.total),
        paid: round(totals.paid),
        due: round(totals.due),
        discount: round(totals.discount),
        ...(canSeeProfit && { profit: round(totals.total - totals.cost) }),
        byDay: byDay.map((d) => ({ date: d._id, count: d.count, total: round(d.total), due: round(d.due), ...(canSeeProfit && { profit: round(d.total - d.cost) }) })),
    });
}));
exports.saleRoutes.get('/:id', (0, errors_1.asyncHandler)(async (req, res) => {
    const s = await sale_model_1.Sale.findOne({ _id: req.params.id, storeId: (0, auth_1.getStoreId)(req) }).populate('customerId', 'name phone');
    if (!s)
        throw new errors_1.AppError(404, 'Sale not found');
    res.json(s);
}));
