import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { AppModule, Role } from '../common/constants';
import { AppError } from '../utils/errors';
import { verifyAccess } from '../utils/jwt';
import { User } from '../modules/users/user.model';
import { Store } from '../modules/stores/store.model';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; roles: Role[]; storeId?: string };
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new AppError(401, 'Authentication required', 'UNAUTHENTICATED');
    let payload;
    try {
      payload = verifyAccess(header.slice(7));
    } catch {
      throw new AppError(401, 'Invalid or expired token', 'INVALID_TOKEN');
    }
    const user = await User.findById(payload.sub).select('roles storeId isActive');
    if (!user || !user.isActive) throw new AppError(401, 'Account disabled or not found', 'ACCOUNT_DISABLED');
    req.user = { id: String(user._id), roles: user.roles as Role[], storeId: user.storeId ? String(user.storeId) : undefined };
    next();
  } catch (e) {
    next(e);
  }
}

export const authorize =
  (...allowed: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user?.roles.some((r) => allowed.includes(r))) return next(new AppError(403, 'Insufficient permissions', 'FORBIDDEN'));
    next();
  };

/** Tenant id for the current request. Superuser must send `x-store-id` to act inside a store. */
export function getStoreId(req: Request): string {
  const id = req.user?.storeId || (req.user?.roles.includes('superuser') ? (req.header('x-store-id') as string) : undefined);
  if (!id || !Types.ObjectId.isValid(id)) throw new AppError(400, 'Store context missing');
  return id;
}

/** Blocks the route unless the store has the module enabled AND an unexpired subscription. */
export const requireModule =
  (mod: AppModule) => async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (req.user?.roles.includes('superuser')) return next();
      const store = await Store.findById(getStoreId(req));
      if (!store || store.status !== 'active') throw new AppError(403, 'Store is suspended', 'STORE_SUSPENDED');
      const expired = !store.subscription?.expiresAt || store.subscription.expiresAt < new Date();
      if (expired) throw new AppError(402, 'Subscription expired. Please renew.', 'SUBSCRIPTION_EXPIRED');
      if (!store.enabledModules.includes(mod)) throw new AppError(403, `The "${mod}" module is not part of your subscription`, 'MODULE_DISABLED', { module: mod });
      next();
    } catch (e) {
      next(e);
    }
  };
