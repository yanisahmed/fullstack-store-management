import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export const signAccess = (sub: string) => jwt.sign({ sub }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
export const signRefresh = (sub: string) => jwt.sign({ sub }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
export const verifyAccess = (t: string) => jwt.verify(t, env.JWT_ACCESS_SECRET) as { sub: string };
export const verifyRefresh = (t: string) => jwt.verify(t, env.JWT_REFRESH_SECRET) as { sub: string };
