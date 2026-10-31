"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tzString = exports.PRESETS = void 0;
exports.dateRange = dateRange;
const env_1 = require("../config/env");
const errors_1 = require("../utils/errors");
/**
 * Turns query params into a MongoDB date condition, interpreted in the SHOP's timezone
 * (default Asia/Dhaka, UTC+6) so "today" means the shop's today, not the server's.
 *
 * Supported (checked in this order):
 *   from=YYYY-MM-DD&to=YYYY-MM-DD   custom range (either may be omitted)
 *   month=YYYY-MM                   one calendar month
 *   year=YYYY                       one calendar year
 *   preset=today|yesterday|this_week|last_7_days|last_30_days|this_month|last_month|this_year
 */
exports.PRESETS = ['today', 'yesterday', 'this_week', 'last_7_days', 'last_30_days', 'this_month', 'last_month', 'this_year'];
const OFFSET_MS = env_1.env.TZ_OFFSET_MINUTES * 60_000;
// Build the real instant for a wall-clock time in the shop timezone
const at = (y, m, d, h = 0, mi = 0, s = 0, ms = 0) => new Date(Date.UTC(y, m, d, h, mi, s, ms) - OFFSET_MS);
const startOfDay = (y, m, d) => at(y, m, d);
const endOfDay = (y, m, d) => at(y, m, d, 23, 59, 59, 999);
function parseDay(v, name) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (!m)
        throw new errors_1.AppError(400, `${name} must look like YYYY-MM-DD`);
    return { y: +m[1], m: +m[2] - 1, d: +m[3] };
}
function dateRange(q) {
    const str = (k) => (typeof q[k] === 'string' && q[k] !== '' ? q[k] : undefined);
    const from = str('from'), to = str('to'), month = str('month'), year = str('year'), preset = str('preset');
    if (from || to) {
        const cond = {};
        if (from) {
            const f = parseDay(from, 'from');
            cond.$gte = startOfDay(f.y, f.m, f.d);
        }
        if (to) {
            const t = parseDay(to, 'to');
            cond.$lte = endOfDay(t.y, t.m, t.d);
        }
        if (cond.$gte && cond.$lte && cond.$gte > cond.$lte)
            throw new errors_1.AppError(400, '"from" must be before "to"');
        return cond;
    }
    if (month) {
        const m = /^(\d{4})-(\d{2})$/.exec(month);
        if (!m || +m[2] < 1 || +m[2] > 12)
            throw new errors_1.AppError(400, 'month must look like YYYY-MM');
        const y = +m[1], mo = +m[2] - 1;
        return { $gte: startOfDay(y, mo, 1), $lte: endOfDay(y, mo + 1, 0) };
    }
    if (year) {
        if (!/^\d{4}$/.test(year))
            throw new errors_1.AppError(400, 'year must look like YYYY');
        return { $gte: startOfDay(+year, 0, 1), $lte: endOfDay(+year, 11, 31) };
    }
    if (preset && preset !== 'all') {
        const n = new Date(Date.now() + OFFSET_MS); // wall-clock "now" in UTC fields
        const y = n.getUTCFullYear(), mo = n.getUTCMonth(), d = n.getUTCDate(), dow = n.getUTCDay();
        switch (preset) {
            case 'today': return { $gte: startOfDay(y, mo, d), $lte: endOfDay(y, mo, d) };
            case 'yesterday': return { $gte: startOfDay(y, mo, d - 1), $lte: endOfDay(y, mo, d - 1) };
            case 'this_week': { // Bangladesh weeks start on Saturday
                const back = (dow + 1) % 7;
                return { $gte: startOfDay(y, mo, d - back), $lte: endOfDay(y, mo, d - back + 6) };
            }
            case 'last_7_days': return { $gte: startOfDay(y, mo, d - 6), $lte: endOfDay(y, mo, d) };
            case 'last_30_days': return { $gte: startOfDay(y, mo, d - 29), $lte: endOfDay(y, mo, d) };
            case 'this_month': return { $gte: startOfDay(y, mo, 1), $lte: endOfDay(y, mo + 1, 0) };
            case 'last_month': return { $gte: startOfDay(y, mo - 1, 1), $lte: endOfDay(y, mo, 0) };
            case 'this_year': return { $gte: startOfDay(y, 0, 1), $lte: endOfDay(y, 11, 31) };
            default: throw new errors_1.AppError(400, `Unknown preset "${preset}"`);
        }
    }
    return undefined;
}
/** "+06:00" style offset, for Mongo's $dateToString timezone option */
const tzString = () => {
    const m = env_1.env.TZ_OFFSET_MINUTES, sign = m < 0 ? '-' : '+', a = Math.abs(m);
    return `${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
};
exports.tzString = tzString;
