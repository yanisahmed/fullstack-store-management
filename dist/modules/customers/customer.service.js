"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postLedger = postLedger;
exports.customerSummary = customerSummary;
exports.toWhatsAppNumber = toWhatsAppNumber;
const mongoose_1 = require("mongoose");
const errors_1 = require("../../utils/errors");
const customer_model_1 = require("./customer.model");
/** Atomically moves the customer's due balance and writes a ledger row. */
async function postLedger(p) {
    const c = await customer_model_1.Customer.findOneAndUpdate({ _id: p.customerId, storeId: p.storeId }, { $inc: { dueBalance: p.dueDelta } }, { new: true });
    if (!c)
        throw new errors_1.AppError(404, 'Customer not found');
    await customer_model_1.LedgerEntry.create({ storeId: p.storeId, customerId: p.customerId, type: p.type, amount: p.amount, balanceAfter: c.dueBalance, saleId: p.saleId, note: p.note, createdBy: p.userId });
    return c;
}
async function customerSummary(storeId, customerId) {
    const rows = await customer_model_1.LedgerEntry.aggregate([
        { $match: { storeId: new mongoose_1.Types.ObjectId(storeId), customerId: new mongoose_1.Types.ObjectId(customerId) } },
        { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    const get = (t) => rows.find((r) => r._id === t)?.total ?? 0;
    return { totalPurchased: get('sale'), totalPaid: get('payment'), purchases: rows.find((r) => r._id === 'sale')?.count ?? 0 };
}
/** Bangladesh-friendly: 01XXXXXXXXX -> 8801XXXXXXXXX */
function toWhatsAppNumber(phone) {
    const d = phone.replace(/\D/g, '');
    if (d.startsWith('880'))
        return d;
    if (d.startsWith('0'))
        return '88' + d;
    return d;
}
