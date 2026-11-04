import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { dateRange } from '../../common/dateRange';
import { checkQty, round3 } from '../../common/units';
import { authenticate, authorize, getStoreId, requireModule } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { AppError, asyncHandler } from '../../utils/errors';
import { resolveImage } from '../images/image.service';
import { notify } from '../notifications/notification.service';
import { Product, StockMovement } from './product.model';
import { resolveCategory, exactCI } from './category.service';
import { assertNoProductDuplicate, cleanStock, findProductDuplicates } from './product.service';

const base = z.object({
  name: z.string().trim().min(1),
  sku: z.string().trim().min(1),
  barcode: z.string().optional(),
  category: z.string().optional(),
  unit: z.enum(['pcs', 'kg']).optional(),
  costPrice: z.number().min(0), // per pcs or per kg
  salePrice: z.number().min(0), // per pcs or per kg
  lowStockThreshold: z.number().min(0).optional(),
  imageToken: z.string().max(64).nullable().optional(),
});
const createSchema = base.extend({ stock: z.number().min(0).default(0) });
// unit cannot be changed after creation (it would corrupt existing stock numbers)
const updateSchema = base.partial().omit({ unit: true }).extend({ isActive: z.boolean().optional() });
const stockSchema = z.object({
  type: z.enum(['in', 'out', 'adjustment']),
  quantity: z.number().min(0), // for 'adjustment' this is the new absolute stock level
  note: z.string().optional(),
});

export const productRoutes = Router();
productRoutes.use(authenticate, requireModule('products'));
const canWrite = authorize('superuser', 'admin', 'manager');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

productRoutes.get('/', asyncHandler(async (req, res) => {
  const { q, category, lowStock, unit, stock, page = '1', limit = '20' } = req.query as Record<string, string>;
  const filter: Record<string, any> = { storeId: getStoreId(req), isActive: true };
  if (category) filter.category = exactCI(category);
  if (unit === 'pcs' || unit === 'kg') filter.unit = unit;
  if (stock === 'out') filter.stock = 0;
  if (stock === 'in') filter.stock = { $gt: 0 };
  if (q) filter.$or = [{ name: new RegExp(escapeRe(q), 'i') }, { sku: new RegExp(escapeRe(q), 'i') }];
  if (lowStock === 'true') filter.$expr = { $lte: ['$stock', '$lowStockThreshold'] };
  const p = Math.max(+page, 1), l = Math.min(+limit, 100);
  const [items, total] = await Promise.all([Product.find(filter).sort('name').skip((p - 1) * l).limit(l), Product.countDocuments(filter)]);
  res.json({ items, total, page: p, pages: Math.ceil(total / l) });
}));

// Live duplicate check used by the Add/Edit form: ?sku=&name=&exclude=<productId>
productRoutes.get('/check', asyncHandler(async (req, res) => {
  const { sku, name, exclude } = req.query as Record<string, string>;
  const { bySku, byName } = await findProductDuplicates(getStoreId(req), { sku, name }, exclude);
  const pick = (p: typeof bySku) => (p ? { id: String(p._id), name: p.name, sku: p.sku, isActive: p.isActive } : null);
  res.json({ sku: pick(bySku), name: pick(byName) });
}));

// Bring a deleted product back (used when the SKU/name of a deleted product is typed again)
productRoutes.post('/:id/restore', canWrite, asyncHandler(async (req, res) => {
  const p = await Product.findOneAndUpdate({ _id: req.params.id, storeId: getStoreId(req) }, { isActive: true }, { new: true });
  if (!p) throw new AppError(404, 'Product not found', 'NOT_FOUND');
  res.json(p);
}));

// Stock information across the whole inventory
productRoutes.get('/stock-summary', asyncHandler(async (req, res) => {
  const storeId = getStoreId(req);
  const [totals] = await Product.aggregate([
    { $match: { storeId: new Types.ObjectId(storeId), isActive: true } },
    { $group: {
      _id: null,
      products: { $sum: 1 },
      pcs: { $sum: { $cond: [{ $eq: ['$unit', 'pcs'] }, '$stock', 0] } },
      kg: { $sum: { $cond: [{ $eq: ['$unit', 'kg'] }, '$stock', 0] } },
      costValue: { $sum: { $multiply: ['$stock', '$costPrice'] } },
      retailValue: { $sum: { $multiply: ['$stock', '$salePrice'] } },
    } },
  ]);
  const lowStock = await Product.find({ storeId, isActive: true, $expr: { $lte: ['$stock', '$lowStockThreshold'] } }).select('name sku unit stock lowStockThreshold');
  res.json({ totals: totals ?? { products: 0, pcs: 0, kg: 0, costValue: 0, retailValue: 0 }, outOfStock: lowStock.filter((p) => p.stock === 0).length, lowStock });
}));

productRoutes.get('/:id', asyncHandler(async (req, res) => {
  const p = await Product.findOne({ _id: req.params.id, storeId: getStoreId(req) });
  if (!p) throw new AppError(404, 'Product not found', 'NOT_FOUND');
  res.json(p);
}));

productRoutes.post('/', canWrite, validate(createSchema), asyncHandler(async (req, res) => {
  const storeId = getStoreId(req);
  const unit = req.body.unit ?? 'pcs';
  checkQty(unit, req.body.stock, 'Opening stock');
  checkQty(unit, req.body.lowStockThreshold ?? 5, 'Low-stock level');
  await assertNoProductDuplicate(storeId, req.body);
  const category = await resolveCategory(storeId, req.body.category);
  const imageToken = await resolveImage(storeId, 'product', req.body.imageToken, undefined);
  const p = await Product.create({ ...req.body, category, unit, storeId, imageToken: imageToken ?? undefined });
  if (p.stock > 0) await StockMovement.create({ storeId, productId: p._id, type: 'in', quantity: p.stock, stockAfter: p.stock, note: 'Opening stock', createdBy: req.user!.id });
  res.status(201).json(p);
}));

productRoutes.patch('/:id', canWrite, validate(updateSchema), asyncHandler(async (req, res) => {
  const storeId = getStoreId(req);
  const existing = await Product.findOne({ _id: req.params.id, storeId });
  if (!existing) throw new AppError(404, 'Product not found', 'NOT_FOUND');
  if (req.body.lowStockThreshold !== undefined) checkQty(existing.unit, req.body.lowStockThreshold, 'Low-stock level');
  if (req.body.sku || req.body.name) await assertNoProductDuplicate(storeId, { sku: req.body.sku, name: req.body.name }, String(existing._id));
  const update = { ...req.body };
  if (req.body.category !== undefined) update.category = (await resolveCategory(storeId, req.body.category)) ?? '';
  if (req.body.imageToken !== undefined) update.imageToken = await resolveImage(storeId, 'product', req.body.imageToken, existing.imageToken);
  res.json(await Product.findOneAndUpdate({ _id: existing._id }, update, { new: true }));
}));

// Soft delete keeps sales history intact
productRoutes.delete('/:id', canWrite, asyncHandler(async (req, res) => {
  const p = await Product.findOneAndUpdate({ _id: req.params.id, storeId: getStoreId(req) }, { isActive: false }, { new: true });
  if (!p) throw new AppError(404, 'Product not found', 'NOT_FOUND');
  res.json({ message: 'Product deleted' });
}));

// Stock in / out / manual adjustment (atomic)
productRoutes.post('/:id/stock', canWrite, validate(stockSchema), asyncHandler(async (req, res) => {
  const storeId = getStoreId(req);
  const { type, note } = req.body;
  const current = await Product.findOne({ _id: req.params.id, storeId });
  if (!current) throw new AppError(404, 'Product not found', 'NOT_FOUND');

  const quantity = round3(req.body.quantity);
  if (type !== 'adjustment' && quantity <= 0) throw new AppError(400, 'Quantity must be greater than zero');
  checkQty(current.unit, quantity);

  let product;
  let delta: number;
  if (type === 'adjustment') {
    delta = round3(quantity - current.stock);
    product = await Product.findOneAndUpdate({ _id: current._id }, { stock: quantity }, { new: true });
  } else {
    delta = type === 'in' ? quantity : -quantity;
    product = await Product.findOneAndUpdate(
      { _id: current._id, ...(type === 'out' ? { stock: { $gte: quantity - 0.0005 } } : {}) },
      { $inc: { stock: delta } },
      { new: true },
    );
  }
  if (!product) throw new AppError(409, 'Product not found or insufficient stock', 'INSUFFICIENT_STOCK_GENERIC');

  product.stock = await cleanStock(product);
  await StockMovement.create({ storeId, productId: product._id, type, quantity: delta, stockAfter: product.stock, note, createdBy: req.user!.id });
  if (product.stock <= product.lowStockThreshold) await notify(storeId, 'low_stock', `Low stock: ${product.name}`, `Only ${product.stock} ${product.unit} left`, `/products/${product._id}`, { code: 'low_stock', params: { name: product.name, stock: product.stock, unit: product.unit } });
  res.json(product);
}));

// Stock history for one product. Filters: date range (preset/month/year/from/to) and type
productRoutes.get('/:id/movements', asyncHandler(async (req, res) => {
  const filter: Record<string, any> = { storeId: getStoreId(req), productId: req.params.id };
  const range = dateRange(req.query);
  if (range) filter.createdAt = range;
  const type = req.query.type as string | undefined;
  if (type && ['in', 'out', 'adjustment', 'sale', 'sale_return'].includes(type)) filter.type = type;
  res.json(await StockMovement.find(filter).sort('-createdAt').limit(500));
}));
