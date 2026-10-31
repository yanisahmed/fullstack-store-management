"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerEntry = exports.Customer = void 0;
const mongoose_1 = require("mongoose");
const customerSchema = new mongoose_1.Schema({
    storeId: { type: mongoose_1.Types.ObjectId, ref: 'Store', required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    address: String,
    note: String,
    dueBalance: { type: Number, default: 0 }, // what the customer currently owes
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
customerSchema.index({ storeId: 1, phone: 1 });
exports.Customer = (0, mongoose_1.model)('Customer', customerSchema);
// Per-customer ledger: every purchase, payment and manual adjustment
const ledgerSchema = new mongoose_1.Schema({
    storeId: { type: mongoose_1.Types.ObjectId, required: true, index: true },
    customerId: { type: mongoose_1.Types.ObjectId, ref: 'Customer', required: true, index: true },
    type: { type: String, enum: ['sale', 'payment', 'adjustment'], required: true },
    amount: { type: Number, required: true }, // sale: +total, payment: +paid, adjustment: signed
    balanceAfter: Number,
    saleId: mongoose_1.Types.ObjectId,
    note: String,
    createdBy: { type: mongoose_1.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
exports.LedgerEntry = (0, mongoose_1.model)('LedgerEntry', ledgerSchema);
