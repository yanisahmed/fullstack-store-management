"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const constants_1 = require("../../common/constants");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const errors_1 = require("../../utils/errors");
const user_service_1 = require("../users/user.service");
const store_model_1 = require("./store.model");
exports.storeRoutes = (0, express_1.Router)();
exports.storeRoutes.use(auth_1.authenticate);
// Current user's store (shows enabled modules + expiry so the UI can render the menu)
exports.storeRoutes.get('/me', (0, errors_1.asyncHandler)(async (req, res) => {
    res.json(await store_model_1.Store.findById((0, auth_1.getStoreId)(req)).populate('subscription.planId', 'name code'));
}));
// ---- Superuser only ----
exports.storeRoutes.use((0, auth_1.authorize)('superuser'));
exports.storeRoutes.get('/', (0, errors_1.asyncHandler)(async (_req, res) => {
    res.json(await store_model_1.Store.find().sort('-createdAt'));
}));
exports.storeRoutes.post('/', (0, validate_1.validate)(zod_1.z.object({
    name: zod_1.z.string().min(2),
    phone: zod_1.z.string().optional(),
    adminName: zod_1.z.string().min(2),
    adminEmail: zod_1.z.string().email(),
    adminPassword: zod_1.z.string().min(8),
    enabledModules: zod_1.z.array(zod_1.z.enum(constants_1.MODULES)).default([]),
    validDays: zod_1.z.number().int().positive().default(30),
})), (0, errors_1.asyncHandler)(async (req, res) => {
    const { adminName, adminEmail, adminPassword, validDays, ...rest } = req.body;
    const now = new Date();
    const store = await store_model_1.Store.create({ ...rest, subscription: { status: 'active', startsAt: now, expiresAt: new Date(now.getTime() + validDays * 864e5) } });
    const admin = await (0, user_service_1.createUser)({ storeId: String(store._id), name: adminName, email: adminEmail, password: adminPassword, roles: ['admin'] });
    res.status(201).json({ store, adminId: admin._id });
}));
// Superuser decides exactly which modules a store may use
exports.storeRoutes.patch('/:id/modules', (0, validate_1.validate)(zod_1.z.object({ enabledModules: zod_1.z.array(zod_1.z.enum(constants_1.MODULES)) })), (0, errors_1.asyncHandler)(async (req, res) => {
    const store = await store_model_1.Store.findByIdAndUpdate(req.params.id, { enabledModules: req.body.enabledModules }, { new: true });
    if (!store)
        throw new errors_1.AppError(404, 'Store not found');
    res.json(store);
}));
exports.storeRoutes.patch('/:id/status', (0, validate_1.validate)(zod_1.z.object({ status: zod_1.z.enum(['active', 'suspended']) })), (0, errors_1.asyncHandler)(async (req, res) => {
    const store = await store_model_1.Store.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!store)
        throw new errors_1.AppError(404, 'Store not found');
    res.json(store);
}));
