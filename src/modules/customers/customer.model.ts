import { Schema, model, Types } from 'mongoose';

const customerSchema = new Schema(
  {
    storeId: { type: Types.ObjectId, ref: 'Store', required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    address: String,
    note: String,
    dueBalance: { type: Number, default: 0 }, // what the customer currently owes
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
customerSchema.index({ storeId: 1, phone: 1 });

export const Customer = model('Customer', customerSchema);

// Per-customer ledger: every purchase, payment and manual adjustment
const ledgerSchema = new Schema(
  {
    storeId: { type: Types.ObjectId, required: true, index: true },
    customerId: { type: Types.ObjectId, ref: 'Customer', required: true, index: true },
    type: { type: String, enum: ['sale', 'payment', 'adjustment'], required: true },
    amount: { type: Number, required: true }, // sale: +total, payment: +paid, adjustment: signed
    balanceAfter: Number,
    saleId: Types.ObjectId,
    note: String,
    createdBy: { type: Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const LedgerEntry = model('LedgerEntry', ledgerSchema);
