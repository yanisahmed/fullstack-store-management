import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../common/constants';
import { authenticate, authorize, getStoreId } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { AppError, asyncHandler } from '../../utils/errors';
import { User } from './user.model';
import { createUser, hashPassword } from './user.service';

const assignable = ROLES.filter((r) => r !== 'superuser') as [string, ...string[]];

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  roles: z.array(z.enum(assignable)).min(1),
});
const updateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  password: z.string().min(8).optional(),
  roles: z.array(z.enum(assignable)).min(1).optional(),
  isActive: z.boolean().optional(),
});

export const userRoutes = Router();
userRoutes.use(authenticate, authorize('superuser', 'admin'));

userRoutes.get('/', asyncHandler(async (req, res) => {
  res.json(await User.find({ storeId: getStoreId(req) }).sort('-createdAt'));
}));

// Add a user (with one or more roles) to the store
userRoutes.post('/', validate(createSchema), asyncHandler(async (req, res) => {
  const user = await createUser({ ...req.body, storeId: getStoreId(req) });
  res.status(201).json({ id: user._id, name: user.name, email: user.email, roles: user.roles });
}));

userRoutes.patch('/:id', validate(updateSchema), asyncHandler(async (req, res) => {
  const { password, ...rest } = req.body;
  const update: Record<string, unknown> = { ...rest };
  if (password) update.passwordHash = await hashPassword(password);
  if (req.params.id === req.user!.id && (rest.isActive === false || rest.roles)) throw new AppError(400, 'You cannot change your own roles or status');
  const user = await User.findOneAndUpdate({ _id: req.params.id, storeId: getStoreId(req) }, update, { new: true });
  if (!user) throw new AppError(404, 'User not found');
  res.json(user);
}));

// Soft delete: deactivate
userRoutes.delete('/:id', asyncHandler(async (req, res) => {
  if (req.params.id === req.user!.id) throw new AppError(400, 'You cannot deactivate yourself');
  const user = await User.findOneAndUpdate({ _id: req.params.id, storeId: getStoreId(req) }, { isActive: false }, { new: true });
  if (!user) throw new AppError(404, 'User not found');
  res.json({ message: 'User deactivated' });
}));
