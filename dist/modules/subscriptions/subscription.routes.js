"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const constants_1 = require("../../common/constants");
const env_1 = require("../../config/env");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const errors_1 = require("../../utils/errors");
const counter_model_1 = require("../../common/counter.model");
const notification_service_1 = require("../notifications/notification.service");
const store_model_1 = require("../stores/store.model");
const bkash = __importStar(require("./bkash.service"));
const subscription_model_1 = require("./subscription.model");
exports.subscriptionRoutes = (0, express_1.Router)();
// ---- bKash redirects the customer's browser here (no auth header available) ----
exports.subscriptionRoutes.get('/bkash/callback', (0, errors_1.asyncHandler)(async (req, res) => {
    const { paymentID, status } = req.query;
    const back = (s) => res.redirect(`${env_1.env.CLIENT_URL}/billing?status=${s}`);
    const payment = await subscription_model_1.Payment.findOne({ bkashPaymentID: paymentID });
    if (!payment)
        return back('invalid');
    if (payment.status === 'completed')
        return back('success'); // idempotent
    if (status === 'cancel') {
        payment.status = 'cancelled';
        await payment.save();
        return back('cancelled');
    }
    if (status === 'failure') {
        payment.status = 'failed';
        await payment.save();
        return back('failed');
    }
    // status === 'success' only means the customer approved: we MUST execute to actually take the money
    let result = await bkash.executePayment(paymentID);
    if (result.statusCode !== '0000')
        result = await bkash.queryPayment(paymentID); // may already be executed
    const ok = result.transactionStatus === 'Completed' && Number(result.amount) === payment.amount;
    payment.raw = result;
    if (!ok) {
        payment.status = 'failed';
        await payment.save();
        return back('failed');
    }
    payment.status = 'completed';
    payment.trxID = result.trxID;
    await payment.save();
    const plan = await subscription_model_1.Plan.findById(payment.planId);
    const store = await store_model_1.Store.findById(payment.storeId);
    if (plan && store) {
        const now = new Date();
        const current = store.subscription?.expiresAt;
        const startFrom = current && current > now ? current : now; // renewing early extends, not overwrites
        store.enabledModules = plan.modules;
        store.subscription = { planId: plan._id, status: 'active', startsAt: now, expiresAt: new Date(startFrom.getTime() + plan.durationDays * 864e5) };
        await store.save();
        await (0, notification_service_1.notify)(store._id, 'subscription', 'Subscription activated', `${plan.name} is active until ${store.subscription.expiresAt.toDateString()}`);
    }
    back('success');
}));
exports.subscriptionRoutes.use(auth_1.authenticate);
exports.subscriptionRoutes.get('/plans', (0, errors_1.asyncHandler)(async (_req, res) => {
    res.json(await subscription_model_1.Plan.find({ isActive: true }).sort('priceBDT'));
}));
// ---- Store admin: pay for a plan with bKash ----
exports.subscriptionRoutes.post('/checkout', (0, auth_1.authorize)('admin'), (0, validate_1.validate)(zod_1.z.object({ planId: zod_1.z.string() })), (0, errors_1.asyncHandler)(async (req, res) => {
    const storeId = (0, auth_1.getStoreId)(req);
    const plan = await subscription_model_1.Plan.findOne({ _id: req.body.planId, isActive: true });
    if (!plan)
        throw new errors_1.AppError(404, 'Plan not found');
    const invoice = `SUB-${Date.now()}-${await (0, counter_model_1.nextSeq)('subscription-invoice')}`;
    const created = await bkash.createPayment({ amount: plan.priceBDT, invoice, payerReference: storeId, callbackURL: `${env_1.env.API_URL}/api/v1/subscriptions/bkash/callback` });
    await subscription_model_1.Payment.create({ storeId, planId: plan._id, amount: plan.priceBDT, invoiceNumber: invoice, bkashPaymentID: created.paymentID });
    res.json({ bkashURL: created.bkashURL, paymentID: created.paymentID });
}));
exports.subscriptionRoutes.get('/payments', (0, auth_1.authorize)('admin', 'superuser'), (0, errors_1.asyncHandler)(async (req, res) => {
    const filter = req.user.roles.includes('superuser') && !req.header('x-store-id') ? {} : { storeId: (0, auth_1.getStoreId)(req) };
    res.json(await subscription_model_1.Payment.find(filter).populate('planId', 'name').sort('-createdAt').limit(100));
}));
// ---- Superuser: manage plans ----
const planSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    code: zod_1.z.string().min(2),
    priceBDT: zod_1.z.number().min(0),
    durationDays: zod_1.z.number().int().positive(),
    modules: zod_1.z.array(zod_1.z.enum(constants_1.MODULES)),
    isActive: zod_1.z.boolean().optional(),
});
exports.subscriptionRoutes.post('/plans', (0, auth_1.authorize)('superuser'), (0, validate_1.validate)(planSchema), (0, errors_1.asyncHandler)(async (req, res) => {
    res.status(201).json(await subscription_model_1.Plan.create(req.body));
}));
exports.subscriptionRoutes.patch('/plans/:id', (0, auth_1.authorize)('superuser'), (0, validate_1.validate)(planSchema.partial()), (0, errors_1.asyncHandler)(async (req, res) => {
    const plan = await subscription_model_1.Plan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!plan)
        throw new errors_1.AppError(404, 'Plan not found');
    res.json(plan);
}));
