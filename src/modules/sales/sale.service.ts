import { nextSeq } from '../../common/counter.model';
import { checkQty, round2, round3 } from '../../common/units';
import { cleanStock } from '../products/product.service';
import { AppError } from '../../utils/errors';
import { Customer } from '../customers/customer.model';
import { postLedger } from '../customers/customer.service';
import { notify } from '../notifications/notification.service';
import { Product, StockMovement } from '../products/product.model';
import { Sale } from './sale.model';

interface SaleInput {
  customerId?: string;
  items: { productId: string; quantity: number; unitPrice?: number }[];
  discount?: number;
  paidAmount?: number;
  paymentMethod?: string;
}

export async function createSale(storeId: string, userId: string, input: SaleInput) {
  // 1. Validate customer (needed whenever the sale leaves a due)
  const customer = input.customerId ? await Customer.findOne({ _id: input.customerId, storeId, isActive: true }) : null;
  if (input.customerId && !customer) throw new AppError(404, 'Customer not found');

  // 2. Price the cart from the DB (never trust client prices unless explicitly overridden)
  const products = await Product.find({ _id: { $in: input.items.map((i) => i.productId) }, storeId, isActive: true });
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const lines = input.items.map((i) => {
    const p = byId.get(i.productId);
    if (!p) throw new AppError(404, `Product ${i.productId} not found`);
    const quantity = round3(i.quantity);
    checkQty(p.unit, quantity, `Quantity for ${p.name}`);
    return { productId: p._id, name: p.name, sku: p.sku, unit: p.unit, quantity, unitPrice: i.unitPrice ?? p.salePrice, costPrice: p.costPrice };
  });
  const subtotal = round2(lines.reduce((s, l) => s + round2(l.quantity * l.unitPrice), 0));
  const discount = input.discount ?? 0;
  const total = round2(Math.max(subtotal - discount, 0));
  const paidAmount = input.paidAmount ?? total;
  if (paidAmount > total + 0.001) throw new AppError(400, 'Paid amount cannot exceed total');
  const dueAmount = round2(Math.max(total - paidAmount, 0));
  if (dueAmount > 0 && !customer) throw new AppError(400, 'Select a customer to sell on due');

  // 3. Reserve stock atomically; roll back on any failure
  const reserved: typeof lines = [];
  const lowStock: { name: string; stock: number; unit: string }[] = [];
  const after = new Map<string, number>();
  try {
    for (const l of lines) {
      const p = await Product.findOneAndUpdate({ _id: l.productId, storeId, stock: { $gte: l.quantity - 0.0005 } }, { $inc: { stock: -l.quantity } }, { new: true });
      if (!p) throw new AppError(409, `Insufficient stock for ${l.name}`);
      reserved.push(l);
      const stock = await cleanStock(p);
      after.set(String(p._id), stock);
      if (stock <= p.lowStockThreshold) lowStock.push({ name: p.name, stock, unit: p.unit });
    }
  } catch (e) {
    await Promise.all(reserved.map((l) => Product.updateOne({ _id: l.productId }, { $inc: { stock: l.quantity } })));
    throw e;
  }

  // 4. Persist sale, stock movements, ledger
  const invoiceNo = `INV-${String(await nextSeq(`invoice:${storeId}`)).padStart(6, '0')}`;
  const sale = await Sale.create({ storeId, invoiceNo, customerId: customer?._id, items: lines, subtotal, discount, total, paidAmount, dueAmount, paymentMethod: input.paymentMethod, createdBy: userId });
  await StockMovement.insertMany(lines.map((l) => ({ storeId, productId: l.productId, type: 'sale', quantity: -l.quantity, stockAfter: after.get(String(l.productId)), refId: sale._id, note: invoiceNo, createdBy: userId })));

  if (customer) {
    await postLedger({ storeId, customerId: customer._id, type: 'sale', amount: total, dueDelta: total, saleId: sale._id, note: invoiceNo, userId });
    if (paidAmount > 0) await postLedger({ storeId, customerId: customer._id, type: 'payment', amount: paidAmount, dueDelta: -paidAmount, saleId: sale._id, note: `Paid at ${invoiceNo}`, userId });
    if (dueAmount > 0) await notify(storeId, 'customer_due', `Due added: ${customer.name}`, `৳${dueAmount} unpaid on ${invoiceNo}`, `/customers/${customer._id}`);
  }
  for (const p of lowStock) await notify(storeId, 'low_stock', `Low stock: ${p.name}`, `Only ${p.stock} ${p.unit} left`);

  return sale;
}
