import { Schema, model, Types } from 'mongoose';
import { MODULES } from '../../common/constants';

export const Plan = model(
  'Plan',
  new Schema(
    {
      name: { type: String, required: true },
      code: { type: String, required: true, unique: true },
      priceBDT: { type: Number, required: true, min: 0 },
      durationDays: { type: Number, required: true, min: 1 },
      modules: { type: [{ type: String, enum: MODULES }], default: [] },
      isActive: { type: Boolean, default: true },
    },
    { timestamps: true },
  ),
);

export const Payment = model(
  'Payment',
  new Schema(
    {
      storeId: { type: Types.ObjectId, ref: 'Store', required: true, index: true },
      planId: { type: Types.ObjectId, ref: 'Plan', required: true },
      amount: { type: Number, required: true },
      method: { type: String, default: 'bkash' },
      status: { type: String, enum: ['pending', 'completed', 'failed', 'cancelled'], default: 'pending' },
      invoiceNumber: { type: String, unique: true },
      bkashPaymentID: { type: String, index: true },
      trxID: String,
      raw: Schema.Types.Mixed,
    },
    { timestamps: true },
  ),
);
