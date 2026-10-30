import { Types } from 'mongoose';
import { AppError } from '../../utils/errors';
import { Customer, LedgerEntry } from './customer.model';

/** Atomically moves the customer's due balance and writes a ledger row. */
export async function postLedger(p: { storeId: string; customerId: unknown; type: 'sale' | 'payment' | 'adjustment'; amount: number; dueDelta: number; saleId?: unknown; note?: string; userId?: string }) {
  const c = await Customer.findOneAndUpdate({ _id: p.customerId, storeId: p.storeId }, { $inc: { dueBalance: p.dueDelta } }, { new: true });
  if (!c) throw new AppError(404, 'Customer not found');
  await LedgerEntry.create({ storeId: p.storeId, customerId: p.customerId, type: p.type, amount: p.amount, balanceAfter: c.dueBalance, saleId: p.saleId, note: p.note, createdBy: p.userId });
  return c;
}

export async function customerSummary(storeId: string, customerId: string) {
  const rows = await LedgerEntry.aggregate([
    { $match: { storeId: new Types.ObjectId(storeId), customerId: new Types.ObjectId(customerId) } },
    { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const get = (t: string) => rows.find((r) => r._id === t)?.total ?? 0;
  return { totalPurchased: get('sale'), totalPaid: get('payment'), purchases: rows.find((r) => r._id === 'sale')?.count ?? 0 };
}

/** Bangladesh-friendly: 01XXXXXXXXX -> 8801XXXXXXXXX */
export function toWhatsAppNumber(phone: string) {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('880')) return d;
  if (d.startsWith('0')) return '88' + d;
  return d;
}
