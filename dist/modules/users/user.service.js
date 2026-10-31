"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = void 0;
exports.createUser = createUser;
exports.createSuperuser = createSuperuser;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const errors_1 = require("../../utils/errors");
const user_model_1 = require("./user.model");
const hashPassword = (p) => bcryptjs_1.default.hash(p, 12);
exports.hashPassword = hashPassword;
async function createUser(input) {
    if (input.roles.includes('superuser'))
        throw new errors_1.AppError(403, 'Superuser can only be created by the seed script');
    const { password, ...rest } = input;
    const user = await user_model_1.User.create({ ...rest, passwordHash: await (0, exports.hashPassword)(password) });
    return user;
}
async function createSuperuser(name, email, password) {
    if (await user_model_1.User.exists({ roles: 'superuser' }))
        throw new errors_1.AppError(409, 'Superuser already exists');
    return user_model_1.User.create({ name, email, passwordHash: await (0, exports.hashPassword)(password), roles: ['superuser'] });
}
