"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireModule = exports.authorize = void 0;
exports.authenticate = authenticate;
exports.getStoreId = getStoreId;
const mongoose_1 = require("mongoose");
const errors_1 = require("../utils/errors");
const jwt_1 = require("../utils/jwt");
const user_model_1 = require("../modules/users/user.model");
const store_model_1 = require("../modules/stores/store.model");
async function authenticate(req, _res, next) {
    try {
        const header = req.headers.authorization;
        if (!header?.startsWith('Bearer '))
            throw new errors_1.AppError(401, 'Authentication required');
        let payload;
        try {
            payload = (0, jwt_1.verifyAccess)(header.slice(7));
        }
        catch {
            throw new errors_1.AppError(401, 'Invalid or expired token');
        }
        const user = await user_model_1.User.findById(payload.sub).select('roles storeId isActive');
        if (!user || !user.isActive)
            throw new errors_1.AppError(401, 'Account disabled or not found');
        req.user = { id: String(user._id), roles: user.roles, storeId: user.storeId ? String(user.storeId) : undefined };
        next();
    }
    catch (e) {
        next(e);
    }
}
const authorize = (...allowed) => (req, _res, next) => {
    if (!req.user?.roles.some((r) => allowed.includes(r)))
        return next(new errors_1.AppError(403, 'Insufficient permissions'));
    next();
};
exports.authorize = authorize;
/** Tenant id for the current request. Superuser must send `x-store-id` to act inside a store. */
function getStoreId(req) {
    const id = req.user?.storeId || (req.user?.roles.includes('superuser') ? req.header('x-store-id') : undefined);
    if (!id || !mongoose_1.Types.ObjectId.isValid(id))
        throw new errors_1.AppError(400, 'Store context missing');
    return id;
}
/** Blocks the route unless the store has the module enabled AND an unexpired subscription. */
const requireModule = (mod) => async (req, _res, next) => {
    try {
        if (req.user?.roles.includes('superuser'))
            return next();
        const store = await store_model_1.Store.findById(getStoreId(req));
        if (!store || store.status !== 'active')
            throw new errors_1.AppError(403, 'Store is suspended');
        const expired = !store.subscription?.expiresAt || store.subscription.expiresAt < new Date();
        if (expired)
            throw new errors_1.AppError(402, 'Subscription expired. Please renew.');
        if (!store.enabledModules.includes(mod))
            throw new errors_1.AppError(403, `The "${mod}" module is not part of your subscription`);
        next();
    }
    catch (e) {
        next(e);
    }
};
exports.requireModule = requireModule;
