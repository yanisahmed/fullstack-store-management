import { Router } from 'express';
import { z } from 'zod';
import { MODULES } from '../../common/constants';
import { authenticate, authorize, getStoreId } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { AppError, asyncHandler } from '../../utils/errors';
import { createUser } from '../users/user.service';
import { Store } from './store.model';

export const storeRoutes = Router();
storeRoutes.use(authenticate);

// Current user's store (shows enabled modules + expiry so the UI can render the menu)
storeRoutes.get('/me', asyncHandler(async (req, res) => {
  res.json(await Store.findById(getStoreId(req)).populate('subscription.planId', 'name code'));
}));

// ---- Superuser only ----
storeRoutes.use(authorize('superuser'));

storeRoutes.get('/', asyncHandler(async (_req, res) => {
  res.json(await Store.find().sort('-createdAt'));
}));

storeRoutes.post('/', validate(z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  enabledModules: z.array(z.enum(MODULES)).default([]),
  validDays: z.number().int().positive().default(30),
})), asyncHandler(async (req, res) => {
  const { adminName, adminEmail, adminPassword, validDays, ...rest } = req.body;
  const now = new Date();
  const store = await Store.create({ ...rest, subscription: { status: 'active', startsAt: now, expiresAt: new Date(now.getTime() + validDays * 864e5) } });
  const admin = await createUser({ storeId: String(store._id), name: adminName, email: adminEmail, password: adminPassword, roles: ['admin'] });
  res.status(201).json({ store, adminId: admin._id });
}));

// Superuser decides exactly which modules a store may use
storeRoutes.patch('/:id/modules', validate(z.object({ enabledModules: z.array(z.enum(MODULES)) })), asyncHandler(async (req, res) => {
  const store = await Store.findByIdAndUpdate(req.params.id, { enabledModules: req.body.enabledModules }, { new: true });
  if (!store) throw new AppError(404, 'Store not found');
  res.json(store);
}));

storeRoutes.patch('/:id/status', validate(z.object({ status: z.enum(['active', 'suspended']) })), asyncHandler(async (req, res) => {
  const store = await Store.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  if (!store) throw new AppError(404, 'Store not found');
  res.json(store);
}));
