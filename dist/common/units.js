"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.round3 = exports.round2 = exports.UNITS = void 0;
exports.checkQty = checkQty;
const errors_1 = require("../utils/errors");
exports.UNITS = ['pcs', 'kg'];
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
exports.round2 = round2;
const round3 = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000;
exports.round3 = round3;
/** pcs must be whole numbers; kg can go down to 1 gram (0.001) */
function checkQty(unit, qty, label = 'Quantity') {
    if (unit === 'pcs' && !Number.isInteger(qty))
        throw new errors_1.AppError(400, `${label} must be a whole number for pieces`);
    if (unit === 'kg' && Math.abs(qty * 1000 - Math.round(qty * 1000)) > 1e-6)
        throw new errors_1.AppError(400, `${label} cannot be smaller than 1 gram`);
}
