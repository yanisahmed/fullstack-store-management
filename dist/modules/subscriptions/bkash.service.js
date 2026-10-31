"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPayment = createPayment;
exports.executePayment = executePayment;
exports.queryPayment = queryPayment;
const env_1 = require("../../config/env");
const errors_1 = require("../../utils/errors");
let cached = null;
async function post(path, body, token) {
    const res = await fetch(`${env_1.env.BKASH_BASE_URL}/tokenized/checkout${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(token ? { Authorization: token, 'X-APP-Key': env_1.env.BKASH_APP_KEY } : { username: env_1.env.BKASH_USERNAME, password: env_1.env.BKASH_PASSWORD }),
        },
        body: JSON.stringify(body),
    });
    return res.json();
}
// bKash asks merchants to cache the token (valid ~1 hour) rather than grant one per request
async function getToken() {
    if (cached && cached.expiresAt > Date.now() + 60_000)
        return cached.token;
    const r = await post('/token/grant', { app_key: env_1.env.BKASH_APP_KEY, app_secret: env_1.env.BKASH_APP_SECRET });
    if (!r.id_token)
        throw new errors_1.AppError(502, `bKash auth failed: ${r.statusMessage ?? 'unknown error'}`);
    cached = { token: r.id_token, expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 };
    return cached.token;
}
async function createPayment(p) {
    const r = await post('/create', { mode: '0011', payerReference: p.payerReference, callbackURL: p.callbackURL, amount: p.amount.toFixed(2), currency: 'BDT', intent: 'sale', merchantInvoiceNumber: p.invoice }, await getToken());
    if (r.statusCode !== '0000')
        throw new errors_1.AppError(502, `bKash create failed: ${r.statusMessage}`);
    return r;
}
async function executePayment(paymentID) {
    return post('/execute', { paymentID }, await getToken());
}
async function queryPayment(paymentID) {
    return post('/payment/status', { paymentID }, await getToken());
}
