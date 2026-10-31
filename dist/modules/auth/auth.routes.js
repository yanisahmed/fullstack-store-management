"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const express_1 = require("express");
const zod_1 = require("zod");
const constants_1 = require("../../common/constants");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const errors_1 = require("../../utils/errors");
const jwt_1 = require("../../utils/jwt");
const store_model_1 = require("../stores/store.model");
const user_model_1 = require("../users/user.model");
const user_service_1 = require("../users/user.service");
const TRIAL_DAYS = 14;
const tokens = (id) => ({ accessToken: (0, jwt_1.signAccess)(id), refreshToken: (0, jwt_1.signRefresh)(id) });
exports.authRoutes = (0, express_1.Router)();
// Self-service signup: creates a store (14-day trial, all modules) + its first admin
exports.authRoutes.post('/register-store', (0, validate_1.validate)(zod_1.z.object({
    storeName: zod_1.z.string().min(2),
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    phone: zod_1.z.string().optional(),
    password: zod_1.z.string().min(8),
})), (0, errors_1.asyncHandler)(async (req, res) => {
    const { storeName, name, email, phone, password } = req.body;
    if (await user_model_1.User.exists({ email: email.toLowerCase() }))
        throw new errors_1.AppError(409, 'Email already registered');
    const now = new Date();
    const store = await store_model_1.Store.create({
        name: storeName, phone,
        enabledModules: [...constants_1.MODULES],
        subscription: { status: 'trial', startsAt: now, expiresAt: new Date(now.getTime() + TRIAL_DAYS * 864e5) },
    });
    const user = await (0, user_service_1.createUser)({ storeId: String(store._id), name, email, phone, password, roles: ['admin'] });
    res.status(201).json({ ...tokens(String(user._id)), user: { id: user._id, name, email, roles: user.roles, storeId: store._id } });
}));
exports.authRoutes.post('/login', (0, validate_1.validate)(zod_1.z.object({ email: zod_1.z.string().email(), password: zod_1.z.string() })), (0, errors_1.asyncHandler)(async (req, res) => {
    const user = await user_model_1.User.findOne({ email: req.body.email.toLowerCase() }).select('+passwordHash');
    if (!user || !user.isActive || !(await bcryptjs_1.default.compare(req.body.password, user.passwordHash)))
        throw new errors_1.AppError(401, 'Invalid email or password');
    res.json({ ...tokens(String(user._id)), user: { id: user._id, name: user.name, email: user.email, roles: user.roles, storeId: user.storeId } });
}));
exports.authRoutes.post('/refresh', (0, validate_1.validate)(zod_1.z.object({ refreshToken: zod_1.z.string() })), (0, errors_1.asyncHandler)(async (req, res) => {
    let sub;
    try {
        sub = (0, jwt_1.verifyRefresh)(req.body.refreshToken).sub;
    }
    catch {
        throw new errors_1.AppError(401, 'Invalid refresh token');
    }
    const user = await user_model_1.User.findById(sub);
    if (!user?.isActive)
        throw new errors_1.AppError(401, 'Account disabled');
    res.json(tokens(sub));
}));
exports.authRoutes.get('/me', auth_1.authenticate, (0, errors_1.asyncHandler)(async (req, res) => {
    res.json(await user_model_1.User.findById(req.user.id));
}));
