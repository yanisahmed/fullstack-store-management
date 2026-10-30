import bcrypt from 'bcryptjs';
import { Role } from '../../common/constants';
import { AppError } from '../../utils/errors';
import { User } from './user.model';

export const hashPassword = (p: string) => bcrypt.hash(p, 12);

export async function createUser(input: { storeId?: string; name: string; email: string; phone?: string; password: string; roles: Role[] }) {
  if (input.roles.includes('superuser')) throw new AppError(403, 'Superuser can only be created by the seed script');
  const { password, ...rest } = input;
  const user = await User.create({ ...rest, passwordHash: await hashPassword(password) });
  return user;
}

export async function createSuperuser(name: string, email: string, password: string) {
  if (await User.exists({ roles: 'superuser' })) throw new AppError(409, 'Superuser already exists');
  return User.create({ name, email, passwordHash: await hashPassword(password), roles: ['superuser'] });
}
