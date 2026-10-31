"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notification = void 0;
const mongoose_1 = require("mongoose");
const schema = new mongoose_1.Schema({
    storeId: { type: mongoose_1.Types.ObjectId, ref: 'Store', required: true, index: true },
    type: { type: String, enum: ['low_stock', 'customer_due', 'payment_received', 'subscription', 'system'], required: true },
    title: { type: String, required: true },
    message: String,
    link: String,
    isRead: { type: Boolean, default: false },
}, { timestamps: true });
exports.Notification = (0, mongoose_1.model)('Notification', schema);
