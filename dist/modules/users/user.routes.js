"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const constants_1 = require("../../common/constants");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const errors_1 = require("../../utils/errors");
const user_model_1 = require("./user.model");
const user_service_1 = require("./user.service");
const assignable = constants_1.ROLES.filter((r) => r !== 'superuser');
const createSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    phone: zod_1.z.string().optional(),
    password: zod_1.z.string().min(8),
    roles: zod_1.z.array(zod_1.z.enum(assignable)).min(1),
});
const updateSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    phone: zod_1.z.string().optional(),
    password: zod_1.z.string().min(8).optional(),
    roles: zod_1.z.array(zod_1.z.enum(assignable)).min(1).optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.userRoutes = (0, express_1.Router)();
exports.userRoutes.use(auth_1.authenticate, (0, auth_1.authorize)('superuser', 'admin'));
exports.userRoutes.get('/', (0, errors_1.asyncHandler)(async (req, res) => {
    res.json(await user_model_1.User.find({ storeId: (0, auth_1.getStoreId)(req) }).sort('-createdAt'));
}));
// Add a user (with one or more roles) to the store
exports.userRoutes.post('/', (0, validate_1.validate)(createSchema), (0, errors_1.asyncHandler)(async (req, res) => {
    const user = await (0, user_service_1.createUser)({ ...req.body, storeId: (0, auth_1.getStoreId)(req) });
    res.status(201).json({ id: user._id, name: user.name, email: user.email, roles: user.roles });
}));
exports.userRoutes.patch('/:id', (0, validate_1.validate)(updateSchema), (0, errors_1.asyncHandler)(async (req, res) => {
    const { password, ...rest } = req.body;
    const update = { ...rest };
    if (password)
        update.passwordHash = await (0, user_service_1.hashPassword)(password);
    if (req.params.id === req.user.id && (rest.isActive === false || rest.roles))
        throw new errors_1.AppError(400, 'You cannot change your own roles or status');
    const user = await user_model_1.User.findOneAndUpdate({ _id: req.params.id, storeId: (0, auth_1.getStoreId)(req) }, update, { new: true });
    if (!user)
        throw new errors_1.AppError(404, 'User not found');
    res.json(user);
}));
// Soft delete: deactivate
exports.userRoutes.delete('/:id', (0, errors_1.asyncHandler)(async (req, res) => {
    if (req.params.id === req.user.id)
        throw new errors_1.AppError(400, 'You cannot deactivate yourself');
    const user = await user_model_1.User.findOneAndUpdate({ _id: req.params.id, storeId: (0, auth_1.getStoreId)(req) }, { isActive: false }, { new: true });
    if (!user)
        throw new errors_1.AppError(404, 'User not found');
    res.json({ message: 'User deactivated' });
}));
