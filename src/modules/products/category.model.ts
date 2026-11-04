import { Schema, model, Types } from 'mongoose';

const categorySchema = new Schema(
  { storeId: { type: Types.ObjectId, ref: 'Store', required: true, index: true }, name: { type: String, required: true, trim: true } },
  { timestamps: true },
);
// Case-insensitive uniqueness per store: "Rice" and "rice" are the same category
categorySchema.index({ storeId: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export const Category = model('Category', categorySchema);
