"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Payment = exports.Plan = void 0;
const mongoose_1 = require("mongoose");
const constants_1 = require("../../common/constants");
exports.Plan = (0, mongoose_1.model)('Plan', new mongoose_1.Schema({
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    priceBDT: { type: Number, required: true, min: 0 },
    durationDays: { type: Number, required: true, min: 1 },
    modules: { type: [{ type: String, enum: constants_1.MODULES }], default: [] },
    isActive: { type: Boolean, default: true },
}, { timestamps: true }));
exports.Payment = (0, mongoose_1.model)('Payment', new mongoose_1.Schema({
    storeId: { type: mongoose_1.Types.ObjectId, ref: 'Store', required: true, index: true },
    planId: { type: mongoose_1.Types.ObjectId, ref: 'Plan', required: true },
    amount: { type: Number, required: true },
    method: { type: String, default: 'bkash' },
    status: { type: String, enum: ['pending', 'completed', 'failed', 'cancelled'], default: 'pending' },
    invoiceNumber: { type: String, unique: true },
    bkashPaymentID: { type: String, index: true },
    trxID: String,
    raw: mongoose_1.Schema.Types.Mixed,
}, { timestamps: true }));
