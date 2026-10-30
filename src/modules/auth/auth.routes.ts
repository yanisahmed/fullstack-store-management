import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { MODULES } from '../../common/constants';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { AppError, asyncHandler } from '../../utils/errors';
import { signAccess, signRefresh, verifyRefresh } from '../../utils/jwt';
import { Store } from '../stores/store.model';
import { User } from '../users/user.model';
import { createUser } from '../users/user.service';

const TRIAL_DAYS = 14;
const tokens = (id: string) => ({ accessToken: signAccess(id), refreshToken: signRefresh(id) });

export const authRoutes = Router();

// Self-service signup: creates a store (14-day trial, all modules) + its first admin
authRoutes.post('/register-store', validate(z.object({
  storeName: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
})), asyncHandler(async (req, res) => {
  const { storeName, name, email, phone, password } = req.body;
  if (await User.exists({ email: email.toLowerCase() })) throw new AppError(409, 'Email already registered');
  const now = new Date();
  const store = await Store.create({
    name: storeName, phone,
    enabledModules: [...MODULES],
    subscription: { status: 'trial', startsAt: now, expiresAt: new Date(now.getTime() + TRIAL_DAYS * 864e5) },
  });
  const user = await createUser({ storeId: String(store._id), name, email, phone, password, roles: ['admin'] });
  res.status(201).json({ ...tokens(String(user._id)), user: { id: user._id, name, email, roles: user.roles, storeId: store._id } });
}));

authRoutes.post('/login', validate(z.object({ email: z.string().email(), password: z.string() })), asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+passwordHash');
  if (!user || !user.isActive || !(await bcrypt.compare(req.body.password, user.passwordHash))) throw new AppError(401, 'Invalid email or password');
  res.json({ ...tokens(String(user._id)), user: { id: user._id, name: user.name, email: user.email, roles: user.roles, storeId: user.storeId } });
}));

authRoutes.post('/refresh', validate(z.object({ refreshToken: z.string() })), asyncHandler(async (req, res) => {
  let sub: string;
  try {
    sub = verifyRefresh(req.body.refreshToken).sub;
  } catch {
    throw new AppError(401, 'Invalid refresh token');
  }
  const user = await User.findById(sub);
  if (!user?.isActive) throw new AppError(401, 'Account disabled');
  res.json(tokens(sub));
}));

authRoutes.get('/me', authenticate, asyncHandler(async (req, res) => {
  res.json(await User.findById(req.user!.id));
}));
