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

/** 01712-345678, +8801712345678 and 8801712345678 all become 01712345678 */
export function normalizePhone(phone?: string | null) {
  let d = (phone ?? '').replace(/\D/g, '');
  if (!d) return undefined;
  if (d.startsWith('880')) d = '0' + d.slice(3);
  else if (d.length === 10 && d.startsWith('1')) d = '0' + d;
  return d;
}

/** Another ACTIVE customer in this store with the same phone number (also matches older rows saved before normalisation). */
export async function findCustomerByPhone(storeId: string, phone?: string, excludeId?: string) {
  const n = normalizePhone(phone);
  if (!n) return null;
  const local = n.startsWith('0') ? n.slice(1) : n;
  return Customer.findOne({
    storeId,
    isActive: true,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    $or: [{ phoneNormalized: n }, { phone: { $in: [n, `88${n}`, `+88${n}`, `880${local}`, `+880${local}`] } }],
  }).select('name phone dueBalance');
}

export async function assertPhoneFree(storeId: string, phone?: string, excludeId?: string) {
  const dup = await findCustomerByPhone(storeId, phone, excludeId);
  if (dup) throw new AppError(409, `${dup.name} already has this phone number`, 'DUPLICATE_PHONE', { id: String(dup._id), name: dup.name });
}
