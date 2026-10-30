import { Schema, model, Types } from 'mongoose';
import { ROLES } from '../../common/constants';

const userSchema = new Schema(
  {
    storeId: { type: Types.ObjectId, ref: 'Store', index: true }, // absent for the superuser
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    roles: { type: [{ type: String, enum: ROLES }], default: ['viewer'] }, // a user can hold several roles
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// DB-level guarantee: only ONE document can ever contain the 'superuser' role
userSchema.index({ roles: 1 }, { unique: true, partialFilterExpression: { roles: 'superuser' } });

export const User = model('User', userSchema);
