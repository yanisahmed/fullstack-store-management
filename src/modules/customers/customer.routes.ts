import { Router } from 'express';
import { z } from 'zod';
import { dateRange } from '../../common/dateRange';
import { authenticate, authorize, getStoreId, requireModule } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { AppError, asyncHandler } from '../../utils/errors';
import { notify } from '../notifications/notification.service';
import { Store } from '../stores/store.model';
import { Customer, LedgerEntry } from './customer.model';
import { customerSummary, postLedger, toWhatsAppNumber } from './customer.service';

const base = z.object({ name: z.string().min(1), phone: z.string().optional(), address: z.string().optional(), note: z.string().optional() });

export const customerRoutes = Router();
customerRoutes.use(authenticate, requireModule('customers'));
const canWrite = authorize('superuser', 'admin', 'manager', 'cashier');

customerRoutes.get('/', asyncHandler(async (req, res) => {
  const { q, hasDue } = req.query as Record<string, string>;
  const filter: Record<string, any> = { storeId: getStoreId(req), isActive: true };
  if (q) filter.$or = [{ name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }, { phone: new RegExp(q.replace(/\D/g, '') || '^$') }];
  if (hasDue === 'true') filter.dueBalance = { $gt: 0 };
  res.json(await Customer.find(filter).sort('name').limit(200));
}));

customerRoutes.post('/', canWrite, validate(base), asyncHandler(async (req, res) => {
  res.status(201).json(await Customer.create({ ...req.body, storeId: getStoreId(req) }));
}));

customerRoutes.get('/:id', asyncHandler(async (req, res) => {
  const storeId = getStoreId(req);
  const c = await Customer.findOne({ _id: req.params.id, storeId });
  if (!c) throw new AppError(404, 'Customer not found');
  res.json({ customer: c, summary: { ...(await customerSummary(storeId, String(c._id))), currentDue: c.dueBalance } });
}));

customerRoutes.patch('/:id', canWrite, validate(base.partial()), asyncHandler(async (req, res) => {
  const c = await Customer.findOneAndUpdate({ _id: req.params.id, storeId: getStoreId(req) }, req.body, { new: true });
  if (!c) throw new AppError(404, 'Customer not found');
  res.json(c);
}));

customerRoutes.delete('/:id', authorize('superuser', 'admin', 'manager'), asyncHandler(async (req, res) => {
  const c = await Customer.findOne({ _id: req.params.id, storeId: getStoreId(req) });
  if (!c) throw new AppError(404, 'Customer not found');
  if (c.dueBalance > 0) throw new AppError(409, 'Customer still has outstanding dues');
  c.isActive = false;
  await c.save();
  res.json({ message: 'Customer deleted' });
}));

// Individual expense / ledger history
// Filters: date range (preset/month/year/from/to) and type=sale|payment|adjustment
customerRoutes.get('/:id/ledger', asyncHandler(async (req, res) => {
  const filter: Record<string, any> = { storeId: getStoreId(req), customerId: req.params.id };
  const range = dateRange(req.query);
  if (range) filter.createdAt = range;
  const type = req.query.type as string | undefined;
  if (type && ['sale', 'payment', 'adjustment'].includes(type)) filter.type = type;
  const entries = await LedgerEntry.find(filter).sort('-createdAt').limit(500);
  const sum = (t: string) => entries.filter((e) => e.type === t).reduce((s, e) => s + e.amount, 0);
  res.json({ entries, totals: { purchased: sum('sale'), paid: sum('payment') } });
}));

// Record a payment against dues
customerRoutes.post('/:id/payments', canWrite, validate(z.object({ amount: z.number().positive(), note: z.string().optional() })), asyncHandler(async (req, res) => {
  const storeId = getStoreId(req);
  const c = await Customer.findOne({ _id: req.params.id, storeId });
  if (!c) throw new AppError(404, 'Customer not found');
  if (req.body.amount > c.dueBalance) throw new AppError(400, `Amount exceeds outstanding due (${c.dueBalance})`);
  const updated = await postLedger({ storeId, customerId: c._id, type: 'payment', amount: req.body.amount, dueDelta: -req.body.amount, note: req.body.note, userId: req.user!.id });
  await notify(storeId, 'payment_received', `Payment from ${c.name}`, `৳${req.body.amount} received. Remaining due: ৳${updated.dueBalance}`);
  res.json(updated);
}));

// Share dues on WhatsApp via click-to-chat link (no WhatsApp API approval needed)
customerRoutes.get('/:id/whatsapp-dues', asyncHandler(async (req, res) => {
  const storeId = getStoreId(req);
  const [c, store] = await Promise.all([Customer.findOne({ _id: req.params.id, storeId }), Store.findById(storeId)]);
  if (!c) throw new AppError(404, 'Customer not found');
  if (!c.phone) throw new AppError(400, 'Customer has no phone number');
  if (c.dueBalance <= 0) throw new AppError(400, 'Customer has no outstanding dues');
  const message = `Hello ${c.name},\nYour outstanding due at ${store?.name} is ৳${c.dueBalance}.\nPlease pay at your earliest convenience. Thank you!`;
  res.json({ message, url: `https://wa.me/${toWhatsAppNumber(c.phone)}?text=${encodeURIComponent(message)}` });
}));
