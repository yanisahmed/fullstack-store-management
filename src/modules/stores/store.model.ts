import { Schema, model, Types } from 'mongoose';
import { MODULES } from '../../common/constants';

const storeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: String,
    address: String,
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    enabledModules: { type: [{ type: String, enum: MODULES }], default: [] },
    subscription: {
      planId: { type: Types.ObjectId, ref: 'Plan' },
      status: { type: String, enum: ['trial', 'active', 'expired'], default: 'trial' },
      startsAt: Date,
      expiresAt: Date,
    },
  },
  { timestamps: true },
);

export const Store = model('Store', storeSchema);
