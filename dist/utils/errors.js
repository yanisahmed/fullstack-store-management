"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.AppError = void 0;
class AppError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
exports.AppError = AppError;
const asyncHandler = (fn) => (req, res, next) => fn(req, res, next).catch(next);
exports.asyncHandler = asyncHandler;
