import { env } from '../../config/env';
import { AppError } from '../../utils/errors';

let cached: { token: string; expiresAt: number } | null = null;

async function post(path: string, body: unknown, token?: string): Promise<any> {
  const res = await fetch(`${env.BKASH_BASE_URL}/tokenized/checkout${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: token, 'X-APP-Key': env.BKASH_APP_KEY } : { username: env.BKASH_USERNAME, password: env.BKASH_PASSWORD }),
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// bKash asks merchants to cache the token (valid ~1 hour) rather than grant one per request
async function getToken() {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const r = await post('/token/grant', { app_key: env.BKASH_APP_KEY, app_secret: env.BKASH_APP_SECRET });
  if (!r.id_token) throw new AppError(502, `bKash auth failed: ${r.statusMessage ?? 'unknown error'}`);
  cached = { token: r.id_token, expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 };
  return cached.token;
}

export async function createPayment(p: { amount: number; invoice: string; payerReference: string; callbackURL: string }) {
  const r = await post('/create', { mode: '0011', payerReference: p.payerReference, callbackURL: p.callbackURL, amount: p.amount.toFixed(2), currency: 'BDT', intent: 'sale', merchantInvoiceNumber: p.invoice }, await getToken());
  if (r.statusCode !== '0000') throw new AppError(502, `bKash create failed: ${r.statusMessage}`);
  return r as { paymentID: string; bkashURL: string };
}

export async function executePayment(paymentID: string) {
  return post('/execute', { paymentID }, await getToken());
}

export async function queryPayment(paymentID: string) {
  return post('/payment/status', { paymentID }, await getToken());
}
