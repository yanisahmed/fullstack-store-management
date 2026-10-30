import { AppError } from '../utils/errors';

export const UNITS = ['pcs', 'kg'] as const;
export type Unit = (typeof UNITS)[number];

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

/** pcs must be whole numbers; kg can go down to 1 gram (0.001) */
export function checkQty(unit: string, qty: number, label = 'Quantity') {
  if (unit === 'pcs' && !Number.isInteger(qty)) throw new AppError(400, `${label} must be a whole number for pieces`);
  if (unit === 'kg' && Math.abs(qty * 1000 - Math.round(qty * 1000)) > 1e-6) throw new AppError(400, `${label} cannot be smaller than 1 gram`);
}
