"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = require("mongoose");
const constants_1 = require("../../common/constants");
const userSchema = new mongoose_1.Schema({
    storeId: { type: mongoose_1.Types.ObjectId, ref: 'Store', index: true }, // absent for the superuser
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    roles: { type: [{ type: String, enum: constants_1.ROLES }], default: ['viewer'] }, // a user can hold several roles
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
// DB-level guarantee: only ONE document can ever contain the 'superuser' role
userSchema.index({ roles: 1 }, { unique: true, partialFilterExpression: { roles: 'superuser' } });
exports.User = (0, mongoose_1.model)('User', userSchema);
