import { Request, Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { dateRange, tzString } from '../../common/dateRange';
import { authenticate, authorize, getStoreId, requireModule } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { AppError, asyncHandler } from '../../utils/errors';
import { Sale } from './sale.model';
import { createSale } from './sale.service';

const saleSchema = z.object({
  customerId: z.string().optional(),
  items: z.array(z.object({ productId: z.string(), quantity: z.number().positive(), unitPrice: z.number().min(0).optional() })).min(1),
  discount: z.number().min(0).optional(),
  paidAmount: z.number().min(0).optional(),
  paymentMethod: z.enum(['cash', 'bkash', 'nagad', 'card', 'other']).optional(),
});

export const saleRoutes = Router();
saleRoutes.use(authenticate, requireModule('sales'));

/**
 * Shared filter for list + summary.
 * Query: preset | month | year | from & to   (date)
 *        customerId, paymentMethod, status=due|paid, q (invoice no.)
 */
function saleFilter(req: Request) {
  const { customerId, paymentMethod, status, q } = req.query as Record<string, string>;
  const filter: Record<string, any> = { storeId: new Types.ObjectId(getStoreId(req)) };
  if (customerId) {
    if (!Types.ObjectId.isValid(customerId)) throw new AppError(400, 'Invalid customerId');
    filter.customerId = new Types.ObjectId(customerId);
  }
  if (paymentMethod && ['cash', 'bkash', 'nagad', 'card', 'other'].includes(paymentMethod)) filter.paymentMethod = paymentMethod;
  if (status === 'due') filter.dueAmount = { $gt: 0 };
  if (status === 'paid') filter.dueAmount = { $lte: 0 };
  if (q) filter.invoiceNo = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const range = dateRange(req.query);
  if (range) filter.createdAt = range;
  return filter;
}

saleRoutes.post('/', authorize('superuser', 'admin', 'manager', 'cashier'), validate(saleSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createSale(getStoreId(req), req.user!.id, req.body));
}));

saleRoutes.get('/', asyncHandler(async (req, res) => {
  const { page = '1', limit = '20' } = req.query as Record<string, string>;
  const filter = saleFilter(req);
  const p = Math.max(+page, 1), l = Math.min(+limit, 100);
  const [items, total] = await Promise.all([
    Sale.find(filter).populate('customerId', 'name phone').sort('-createdAt').skip((p - 1) * l).limit(l),
    Sale.countDocuments(filter),
  ]);
  res.json({ items, total, page: p, pages: Math.ceil(total / l) });
}));

// Totals for the same filters, plus a per-day breakdown (days are the SHOP's days, not UTC)
saleRoutes.get('/summary', asyncHandler(async (req, res) => {
  const filter = saleFilter(req);
  const canSeeProfit = req.user!.roles.some((r) => ['superuser', 'admin', 'manager'].includes(r));
  const withCost = { $addFields: { cost: { $sum: { $map: { input: '$items', as: 'i', in: { $multiply: ['$$i.quantity', '$$i.costPrice'] } } } } } };

  const [[t], byDay] = await Promise.all([
    Sale.aggregate([
      { $match: filter }, withCost,
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$total' }, paid: { $sum: '$paidAmount' }, due: { $sum: '$dueAmount' }, discount: { $sum: '$discount' }, cost: { $sum: '$cost' } } },
    ]),
    Sale.aggregate([
      { $match: filter }, withCost,
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: tzString() } }, count: { $sum: 1 }, total: { $sum: '$total' }, due: { $sum: '$dueAmount' }, cost: { $sum: '$cost' } } },
      { $sort: { _id: -1 } },
      { $limit: 366 },
    ]),
  ]);

  const totals = t ?? { count: 0, total: 0, paid: 0, due: 0, discount: 0, cost: 0 };
  const round = (n: number) => Math.round(n * 100) / 100;
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

saleRoutes.get('/:id', asyncHandler(async (req, res) => {
  const s = await Sale.findOne({ _id: req.params.id, storeId: getStoreId(req) }).populate('customerId', 'name phone');
  if (!s) throw new AppError(404, 'Sale not found');
  res.json(s);
}));
