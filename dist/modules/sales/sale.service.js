"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSale = createSale;
const counter_model_1 = require("../../common/counter.model");
const units_1 = require("../../common/units");
const product_service_1 = require("../products/product.service");
const errors_1 = require("../../utils/errors");
const customer_model_1 = require("../customers/customer.model");
const customer_service_1 = require("../customers/customer.service");
const notification_service_1 = require("../notifications/notification.service");
const product_model_1 = require("../products/product.model");
const sale_model_1 = require("./sale.model");
async function createSale(storeId, userId, input) {
    // 1. Validate customer (needed whenever the sale leaves a due)
    const customer = input.customerId ? await customer_model_1.Customer.findOne({ _id: input.customerId, storeId, isActive: true }) : null;
    if (input.customerId && !customer)
        throw new errors_1.AppError(404, 'Customer not found');
    // 2. Price the cart from the DB (never trust client prices unless explicitly overridden)
    const products = await product_model_1.Product.find({ _id: { $in: input.items.map((i) => i.productId) }, storeId, isActive: true });
    const byId = new Map(products.map((p) => [String(p._id), p]));
    const lines = input.items.map((i) => {
        const p = byId.get(i.productId);
        if (!p)
            throw new errors_1.AppError(404, `Product ${i.productId} not found`);
        const quantity = (0, units_1.round3)(i.quantity);
        (0, units_1.checkQty)(p.unit, quantity, `Quantity for ${p.name}`);
        return { productId: p._id, name: p.name, sku: p.sku, unit: p.unit, quantity, unitPrice: i.unitPrice ?? p.salePrice, costPrice: p.costPrice };
    });
    const subtotal = (0, units_1.round2)(lines.reduce((s, l) => s + (0, units_1.round2)(l.quantity * l.unitPrice), 0));
    const discount = input.discount ?? 0;
    const total = (0, units_1.round2)(Math.max(subtotal - discount, 0));
    const paidAmount = input.paidAmount ?? total;
    if (paidAmount > total + 0.001)
        throw new errors_1.AppError(400, 'Paid amount cannot exceed total');
    const dueAmount = (0, units_1.round2)(Math.max(total - paidAmount, 0));
    if (dueAmount > 0 && !customer)
        throw new errors_1.AppError(400, 'Select a customer to sell on due');
    // 3. Reserve stock atomically; roll back on any failure
    const reserved = [];
    const lowStock = [];
    const after = new Map();
    try {
        for (const l of lines) {
            const p = await product_model_1.Product.findOneAndUpdate({ _id: l.productId, storeId, stock: { $gte: l.quantity - 0.0005 } }, { $inc: { stock: -l.quantity } }, { new: true });
            if (!p)
                throw new errors_1.AppError(409, `Insufficient stock for ${l.name}`);
            reserved.push(l);
            const stock = await (0, product_service_1.cleanStock)(p);
            after.set(String(p._id), stock);
            if (stock <= p.lowStockThreshold)
                lowStock.push({ name: p.name, stock, unit: p.unit });
        }
    }
    catch (e) {
        await Promise.all(reserved.map((l) => product_model_1.Product.updateOne({ _id: l.productId }, { $inc: { stock: l.quantity } })));
        throw e;
    }
    // 4. Persist sale, stock movements, ledger
    const invoiceNo = `INV-${String(await (0, counter_model_1.nextSeq)(`invoice:${storeId}`)).padStart(6, '0')}`;
    const sale = await sale_model_1.Sale.create({ storeId, invoiceNo, customerId: customer?._id, items: lines, subtotal, discount, total, paidAmount, dueAmount, paymentMethod: input.paymentMethod, createdBy: userId });
    await product_model_1.StockMovement.insertMany(lines.map((l) => ({ storeId, productId: l.productId, type: 'sale', quantity: -l.quantity, stockAfter: after.get(String(l.productId)), refId: sale._id, note: invoiceNo, createdBy: userId })));
    if (customer) {
        await (0, customer_service_1.postLedger)({ storeId, customerId: customer._id, type: 'sale', amount: total, dueDelta: total, saleId: sale._id, note: invoiceNo, userId });
        if (paidAmount > 0)
            await (0, customer_service_1.postLedger)({ storeId, customerId: customer._id, type: 'payment', amount: paidAmount, dueDelta: -paidAmount, saleId: sale._id, note: `Paid at ${invoiceNo}`, userId });
        if (dueAmount > 0)
            await (0, notification_service_1.notify)(storeId, 'customer_due', `Due added: ${customer.name}`, `৳${dueAmount} unpaid on ${invoiceNo}`, `/customers/${customer._id}`);
    }
    for (const p of lowStock)
        await (0, notification_service_1.notify)(storeId, 'low_stock', `Low stock: ${p.name}`, `Only ${p.stock} ${p.unit} left`);
    return sale;
}
