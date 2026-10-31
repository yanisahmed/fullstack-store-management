"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = notFound;
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
const errors_1 = require("../utils/errors");
function notFound(_req, res) {
    res.status(404).json({ message: 'Route not found' });
}
function errorHandler(err, _req, res, _next) {
    if (err instanceof zod_1.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: err.flatten().fieldErrors });
    }
    if (err instanceof errors_1.AppError)
        return res.status(err.status).json({ message: err.message });
    if (err?.code === 11000)
        return res.status(409).json({ message: 'Duplicate value', fields: Object.keys(err.keyPattern || {}) });
    if (err?.name === 'CastError')
        return res.status(400).json({ message: 'Invalid id' });
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
}
