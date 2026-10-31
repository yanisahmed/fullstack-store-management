"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productRoutes = void 0;
const express_1 = require("express");
const mongoose_1 = require("mongoose");
const zod_1 = require("zod");
const dateRange_1 = require("../../common/dateRange");
const units_1 = require("../../common/units");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const errors_1 = require("../../utils/errors");
const notification_service_1 = require("../notifications/notification.service");
const product_model_1 = require("./product.model");
const product_service_1 = require("./product.service");
const base = zod_1.z.object({
    name: zod_1.z.string().min(1),
    sku: zod_1.z.string().min(1),
    barcode: zod_1.z.string().optional(),
    category: zod_1.z.string().optional(),
    unit: zod_1.z.enum(['pcs', 'kg']).optional(),
    costPrice: zod_1.z.number().min(0), // per pcs or per kg
    salePrice: zod_1.z.number().min(0), // per pcs or per kg
    lowStockThreshold: zod_1.z.number().min(0).optional(),
});
const createSchema = base.extend({ stock: zod_1.z.number().min(0).default(0) });
// unit cannot be changed after creation (it would corrupt existing stock numbers)
const updateSchema = base.partial().omit({ unit: true }).extend({ isActive: zod_1.z.boolean().optional() });
const stockSchema = zod_1.z.object({
    type: zod_1.z.enum(['in', 'out', 'adjustment']),
    quantity: zod_1.z.number().min(0), // for 'adjustment' this is the new absolute stock level
    note: zod_1.z.string().optional(),
});
exports.productRoutes = (0, express_1.Router)();
exports.productRoutes.use(auth_1.authenticate, (0, auth_1.requireModule)('products'));
const canWrite = (0, auth_1.authorize)('superuser', 'admin', 'manager');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
exports.productRoutes.get('/', (0, errors_1.asyncHandler)(async (req, res) => {
    const { q, category, lowStock, unit, stock, page = '1', limit = '20' } = req.query;
    const filter = { storeId: (0, auth_1.getStoreId)(req), isActive: true };
    if (category)
        filter.category = category;
    if (unit === 'pcs' || unit === 'kg')
        filter.unit = unit;
    if (stock === 'out')
        filter.stock = 0;
    if (stock === 'in')
        filter.stock = { $gt: 0 };
    if (q)
        filter.$or = [{ name: new RegExp(escapeRe(q), 'i') }, { sku: new RegExp(escapeRe(q), 'i') }];
    if (lowStock === 'true')
        filter.$expr = { $lte: ['$stock', '$lowStockThreshold'] };
    const p = Math.max(+page, 1), l = Math.min(+limit, 100);
    const [items, total] = await Promise.all([product_model_1.Product.find(filter).sort('name').skip((p - 1) * l).limit(l), product_model_1.Product.countDocuments(filter)]);
    res.json({ items, total, page: p, pages: Math.ceil(total / l) });
}));
// Distinct categories, for the category filter
exports.productRoutes.get('/categories', (0, errors_1.asyncHandler)(async (req, res) => {
    const cats = await product_model_1.Product.distinct('category', { storeId: (0, auth_1.getStoreId)(req), isActive: true, category: { $nin: [null, ''] } });
    res.json(cats.sort());
}));
// Stock information across the whole inventory
exports.productRoutes.get('/stock-summary', (0, errors_1.asyncHandler)(async (req, res) => {
    const storeId = (0, auth_1.getStoreId)(req);
    const [totals] = await product_model_1.Product.aggregate([
        { $match: { storeId: new mongoose_1.Types.ObjectId(storeId), isActive: true } },
        { $group: {
                _id: null,
                products: { $sum: 1 },
                pcs: { $sum: { $cond: [{ $eq: ['$unit', 'pcs'] }, '$stock', 0] } },
                kg: { $sum: { $cond: [{ $eq: ['$unit', 'kg'] }, '$stock', 0] } },
                costValue: { $sum: { $multiply: ['$stock', '$costPrice'] } },
                retailValue: { $sum: { $multiply: ['$stock', '$salePrice'] } },
            } },
    ]);
    const lowStock = await product_model_1.Product.find({ storeId, isActive: true, $expr: { $lte: ['$stock', '$lowStockThreshold'] } }).select('name sku unit stock lowStockThreshold');
    res.json({ totals: totals ?? { products: 0, pcs: 0, kg: 0, costValue: 0, retailValue: 0 }, outOfStock: lowStock.filter((p) => p.stock === 0).length, lowStock });
}));
exports.productRoutes.get('/:id', (0, errors_1.asyncHandler)(async (req, res) => {
    const p = await product_model_1.Product.findOne({ _id: req.params.id, storeId: (0, auth_1.getStoreId)(req) });
    if (!p)
        throw new errors_1.AppError(404, 'Product not found');
    res.json(p);
}));
exports.productRoutes.post('/', canWrite, (0, validate_1.validate)(createSchema), (0, errors_1.asyncHandler)(async (req, res) => {
    const storeId = (0, auth_1.getStoreId)(req);
    const unit = req.body.unit ?? 'pcs';
    (0, units_1.checkQty)(unit, req.body.stock, 'Opening stock');
    (0, units_1.checkQty)(unit, req.body.lowStockThreshold ?? 5, 'Low-stock level');
    const p = await product_model_1.Product.create({ ...req.body, unit, storeId });
    if (p.stock > 0)
        await product_model_1.StockMovement.create({ storeId, productId: p._id, type: 'in', quantity: p.stock, stockAfter: p.stock, note: 'Opening stock', createdBy: req.user.id });
    res.status(201).json(p);
}));
exports.productRoutes.patch('/:id', canWrite, (0, validate_1.validate)(updateSchema), (0, errors_1.asyncHandler)(async (req, res) => {
    const storeId = (0, auth_1.getStoreId)(req);
    const existing = await product_model_1.Product.findOne({ _id: req.params.id, storeId });
    if (!existing)
        throw new errors_1.AppError(404, 'Product not found');
    if (req.body.lowStockThreshold !== undefined)
        (0, units_1.checkQty)(existing.unit, req.body.lowStockThreshold, 'Low-stock level');
    res.json(await product_model_1.Product.findOneAndUpdate({ _id: existing._id }, req.body, { new: true }));
}));
// Soft delete keeps sales history intact
exports.productRoutes.delete('/:id', canWrite, (0, errors_1.asyncHandler)(async (req, res) => {
    const p = await product_model_1.Product.findOneAndUpdate({ _id: req.params.id, storeId: (0, auth_1.getStoreId)(req) }, { isActive: false }, { new: true });
    if (!p)
        throw new errors_1.AppError(404, 'Product not found');
    res.json({ message: 'Product deleted' });
}));
// Stock in / out / manual adjustment (atomic)
exports.productRoutes.post('/:id/stock', canWrite, (0, validate_1.validate)(stockSchema), (0, errors_1.asyncHandler)(async (req, res) => {
    const storeId = (0, auth_1.getStoreId)(req);
    const { type, note } = req.body;
    const current = await product_model_1.Product.findOne({ _id: req.params.id, storeId });
    if (!current)
        throw new errors_1.AppError(404, 'Product not found');
    const quantity = (0, units_1.round3)(req.body.quantity);
    if (type !== 'adjustment' && quantity <= 0)
        throw new errors_1.AppError(400, 'Quantity must be greater than zero');
    (0, units_1.checkQty)(current.unit, quantity);
    let product;
    let delta;
    if (type === 'adjustment') {
        delta = (0, units_1.round3)(quantity - current.stock);
        product = await product_model_1.Product.findOneAndUpdate({ _id: current._id }, { stock: quantity }, { new: true });
    }
    else {
        delta = type === 'in' ? quantity : -quantity;
        product = await product_model_1.Product.findOneAndUpdate({ _id: current._id, ...(type === 'out' ? { stock: { $gte: quantity - 0.0005 } } : {}) }, { $inc: { stock: delta } }, { new: true });
    }
    if (!product)
        throw new errors_1.AppError(409, 'Product not found or insufficient stock');
    product.stock = await (0, product_service_1.cleanStock)(product);
    await product_model_1.StockMovement.create({ storeId, productId: product._id, type, quantity: delta, stockAfter: product.stock, note, createdBy: req.user.id });
    if (product.stock <= product.lowStockThreshold)
        await (0, notification_service_1.notify)(storeId, 'low_stock', `Low stock: ${product.name}`, `Only ${product.stock} ${product.unit} left`, `/products/${product._id}`);
    res.json(product);
}));
// Stock history for one product. Filters: date range (preset/month/year/from/to) and type
exports.productRoutes.get('/:id/movements', (0, errors_1.asyncHandler)(async (req, res) => {
    const filter = { storeId: (0, auth_1.getStoreId)(req), productId: req.params.id };
    const range = (0, dateRange_1.dateRange)(req.query);
    if (range)
        filter.createdAt = range;
    const type = req.query.type;
    if (type && ['in', 'out', 'adjustment', 'sale', 'sale_return'].includes(type))
        filter.type = type;
    res.json(await product_model_1.StockMovement.find(filter).sort('-createdAt').limit(500));
}));
