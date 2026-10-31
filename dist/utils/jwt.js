"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRefresh = exports.verifyAccess = exports.signRefresh = exports.signAccess = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const signAccess = (sub) => jsonwebtoken_1.default.sign({ sub }, env_1.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
exports.signAccess = signAccess;
const signRefresh = (sub) => jsonwebtoken_1.default.sign({ sub }, env_1.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
exports.signRefresh = signRefresh;
const verifyAccess = (t) => jsonwebtoken_1.default.verify(t, env_1.env.JWT_ACCESS_SECRET);
exports.verifyAccess = verifyAccess;
const verifyRefresh = (t) => jsonwebtoken_1.default.verify(t, env_1.env.JWT_REFRESH_SECRET);
exports.verifyRefresh = verifyRefresh;
