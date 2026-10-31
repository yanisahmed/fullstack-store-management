"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sale = void 0;
const mongoose_1 = require("mongoose");
const itemSchema = new mongoose_1.Schema({
    productId: { type: mongoose_1.Types.ObjectId, ref: 'Product', required: true },
    name: String,
    sku: String,
    unit: String,
    quantity: { type: Number, required: true, min: 0.001 },
    unitPrice: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, default: 0 },
}, { _id: false });
const saleSchema = new mongoose_1.Schema({
    storeId: { type: mongoose_1.Types.ObjectId, ref: 'Store', required: true, index: true },
    invoiceNo: { type: String, required: true },
    customerId: { type: mongoose_1.Types.ObjectId, ref: 'Customer', index: true }, // optional: walk-in sales have none
    items: { type: [itemSchema], required: true },
    subtotal: Number,
    discount: { type: Number, default: 0 },
    total: Number,
    paidAmount: Number,
    dueAmount: Number,
    paymentMethod: { type: String, enum: ['cash', 'bkash', 'nagad', 'card', 'other'], default: 'cash' },
    createdBy: { type: mongoose_1.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
saleSchema.index({ storeId: 1, invoiceNo: 1 }, { unique: true });
exports.Sale = (0, mongoose_1.model)('Sale', saleSchema);
