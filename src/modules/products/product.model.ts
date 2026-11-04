import { Schema, model, Types } from 'mongoose';

const productSchema = new Schema(
  {
    storeId: { type: Types.ObjectId, ref: 'Store', required: true, index: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    barcode: String,
    imageToken: String, // points at an Image (see modules/images)
    category: { type: String, trim: true, index: true },
    unit: { type: String, enum: ['pcs', 'kg'], default: 'pcs' },
    costPrice: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
productSchema.index({ storeId: 1, sku: 1 }, { unique: true });
productSchema.index({ name: 'text', sku: 'text' });

export const Product = model('Product', productSchema);

const movementSchema = new Schema(
  {
    storeId: { type: Types.ObjectId, required: true, index: true },
    productId: { type: Types.ObjectId, ref: 'Product', required: true, index: true },
    type: { type: String, enum: ['in', 'out', 'adjustment', 'sale', 'sale_return'], required: true },
    quantity: { type: Number, required: true }, // signed: + adds stock, - removes
    stockAfter: Number,
    note: String,
    refId: Types.ObjectId, // e.g. sale id
    createdBy: { type: Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const StockMovement = model('StockMovement', movementSchema);
