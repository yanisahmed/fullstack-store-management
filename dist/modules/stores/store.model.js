"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Store = void 0;
const mongoose_1 = require("mongoose");
const constants_1 = require("../../common/constants");
const storeSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    phone: String,
    address: String,
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    enabledModules: { type: [{ type: String, enum: constants_1.MODULES }], default: [] },
    subscription: {
        planId: { type: mongoose_1.Types.ObjectId, ref: 'Plan' },
        status: { type: String, enum: ['trial', 'active', 'expired'], default: 'trial' },
        startsAt: Date,
        expiresAt: Date,
    },
}, { timestamps: true });
exports.Store = (0, mongoose_1.model)('Store', storeSchema);
