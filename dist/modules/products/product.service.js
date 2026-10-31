"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanStock = cleanStock;
const units_1 = require("../../common/units");
const product_model_1 = require("./product.model");
/** Removes floating-point dust (e.g. 0.30000000000000004) left behind by $inc */
async function cleanStock(p) {
    const clean = Math.max((0, units_1.round3)(p.stock), 0);
    if (clean !== p.stock)
        await product_model_1.Product.updateOne({ _id: p._id }, { stock: clean });
    return clean;
}
