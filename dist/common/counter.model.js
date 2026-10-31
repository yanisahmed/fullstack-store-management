"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextSeq = nextSeq;
const mongoose_1 = require("mongoose");
const Counter = (0, mongoose_1.model)('Counter', new mongoose_1.Schema({ key: { type: String, unique: true }, seq: { type: Number, default: 0 } }));
async function nextSeq(key) {
    const c = await Counter.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { new: true, upsert: true });
    return c.seq;
}
