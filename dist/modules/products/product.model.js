"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockMovement = exports.Product = void 0;
const mongoose_1 = require("mongoose");
const productSchema = new mongoose_1.Schema({
    storeId: { type: mongoose_1.Types.ObjectId, ref: 'Store', required: true, index: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    barcode: String,
    category: { type: String, trim: true, index: true },
    unit: { type: String, enum: ['pcs', 'kg'], default: 'pcs' },
    costPrice: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
productSchema.index({ storeId: 1, sku: 1 }, { unique: true });
productSchema.index({ name: 'text', sku: 'text' });
exports.Product = (0, mongoose_1.model)('Product', productSchema);
const movementSchema = new mongoose_1.Schema({
    storeId: { type: mongoose_1.Types.ObjectId, required: true, index: true },
    productId: { type: mongoose_1.Types.ObjectId, ref: 'Product', required: true, index: true },
    type: { type: String, enum: ['in', 'out', 'adjustment', 'sale', 'sale_return'], required: true },
    quantity: { type: Number, required: true }, // signed: + adds stock, - removes
    stockAfter: Number,
    note: String,
    refId: mongoose_1.Types.ObjectId, // e.g. sale id
    createdBy: { type: mongoose_1.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
exports.StockMovement = (0, mongoose_1.model)('StockMovement', movementSchema);
