import { Router } from 'express';
import { z } from 'zod';
import { MODULES } from '../../common/constants';
import { env } from '../../config/env';
import { authenticate, authorize, getStoreId } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { AppError, asyncHandler } from '../../utils/errors';
import { nextSeq } from '../../common/counter.model';
import { notify } from '../notifications/notification.service';
import { Store } from '../stores/store.model';
import * as bkash from './bkash.service';
import { Payment, Plan } from './subscription.model';

export const subscriptionRoutes = Router();

// ---- bKash redirects the customer's browser here (no auth header available) ----
subscriptionRoutes.get('/bkash/callback', asyncHandler(async (req, res) => {
  const { paymentID, status } = req.query as Record<string, string>;
  const back = (s: string) => res.redirect(`${env.CLIENT_URL}/billing?status=${s}`);
  const payment = await Payment.findOne({ bkashPaymentID: paymentID });
  if (!payment) return back('invalid');
  if (payment.status === 'completed') return back('success'); // idempotent
  if (status === 'cancel') { payment.status = 'cancelled'; await payment.save(); return back('cancelled'); }
  if (status === 'failure') { payment.status = 'failed'; await payment.save(); return back('failed'); }

  // status === 'success' only means the customer approved: we MUST execute to actually take the money
  let result = await bkash.executePayment(paymentID);
  if (result.statusCode !== '0000') result = await bkash.queryPayment(paymentID); // may already be executed
  const ok = result.transactionStatus === 'Completed' && Number(result.amount) === payment.amount;
  payment.raw = result;
  if (!ok) { payment.status = 'failed'; await payment.save(); return back('failed'); }

  payment.status = 'completed';
  payment.trxID = result.trxID;
  await payment.save();

  const plan = await Plan.findById(payment.planId);
  const store = await Store.findById(payment.storeId);
  if (plan && store) {
    const now = new Date();
    const current = store.subscription?.expiresAt;
    const startFrom = current && current > now ? current : now; // renewing early extends, not overwrites
    store.enabledModules = plan.modules as any;
    store.subscription = { planId: plan._id, status: 'active', startsAt: now, expiresAt: new Date(startFrom.getTime() + plan.durationDays * 864e5) } as any;
    await store.save();
    await notify(store._id, 'subscription', 'Subscription activated', `${plan.name} is active until ${store.subscription!.expiresAt!.toDateString()}`);
  }
  back('success');
}));

subscriptionRoutes.use(authenticate);

subscriptionRoutes.get('/plans', asyncHandler(async (_req, res) => {
  res.json(await Plan.find({ isActive: true }).sort('priceBDT'));
}));

// ---- Store admin: pay for a plan with bKash ----
subscriptionRoutes.post('/checkout', authorize('admin'), validate(z.object({ planId: z.string() })), asyncHandler(async (req, res) => {
  const storeId = getStoreId(req);
  const plan = await Plan.findOne({ _id: req.body.planId, isActive: true });
  if (!plan) throw new AppError(404, 'Plan not found');
  const invoice = `SUB-${Date.now()}-${await nextSeq('subscription-invoice')}`;
  const created = await bkash.createPayment({ amount: plan.priceBDT, invoice, payerReference: storeId, callbackURL: `${env.API_URL}/api/v1/subscriptions/bkash/callback` });
  await Payment.create({ storeId, planId: plan._id, amount: plan.priceBDT, invoiceNumber: invoice, bkashPaymentID: created.paymentID });
  res.json({ bkashURL: created.bkashURL, paymentID: created.paymentID });
}));

subscriptionRoutes.get('/payments', authorize('admin', 'superuser'), asyncHandler(async (req, res) => {
  const filter = req.user!.roles.includes('superuser') && !req.header('x-store-id') ? {} : { storeId: getStoreId(req) };
  res.json(await Payment.find(filter).populate('planId', 'name').sort('-createdAt').limit(100));
}));

// ---- Superuser: manage plans ----
const planSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  priceBDT: z.number().min(0),
  durationDays: z.number().int().positive(),
  modules: z.array(z.enum(MODULES)),
  isActive: z.boolean().optional(),
});
subscriptionRoutes.post('/plans', authorize('superuser'), validate(planSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await Plan.create(req.body));
}));
subscriptionRoutes.patch('/plans/:id', authorize('superuser'), validate(planSchema.partial()), asyncHandler(async (req, res) => {
  const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!plan) throw new AppError(404, 'Plan not found');
  res.json(plan);
}));
