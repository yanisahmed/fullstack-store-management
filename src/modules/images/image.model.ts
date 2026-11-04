import { Schema, model, Types } from 'mongoose';

const imageSchema = new Schema(
  {
    storeId: { type: Types.ObjectId, ref: 'Store', required: true, index: true },
    token: { type: String, required: true, unique: true }, // random, unguessable id used in the image URL
    kind: { type: String, enum: ['product', 'customer'], required: true },
    contentType: { type: String, required: true },
    size: Number,
    data: { type: Buffer, required: true },
  },
  { timestamps: true },
);

export const Image = model('Image', imageSchema);
