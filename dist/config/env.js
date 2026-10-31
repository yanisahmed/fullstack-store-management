"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
require("dotenv/config");
const zod_1 = require("zod");
const schema = zod_1.z.object({
    NODE_ENV: zod_1.z.string().default('development'),
    PORT: zod_1.z.coerce.number().default(5000),
    CLIENT_URL: zod_1.z.string().default('https://abhanis.vercel.app'),
    API_URL: zod_1.z.string().default('https://fullstack-store-management.onrender.com'),
    MONGODB_URI: zod_1.z.string().min(1),
    JWT_ACCESS_SECRET: zod_1.z.string().min(16),
    JWT_REFRESH_SECRET: zod_1.z.string().min(16),
    TZ_OFFSET_MINUTES: zod_1.z.coerce.number().default(360), // Bangladesh = UTC+6
    SUPERUSER_NAME: zod_1.z.string().default('Super Admin'),
    SUPERUSER_EMAIL: zod_1.z.string().optional(),
    SUPERUSER_PASSWORD: zod_1.z.string().optional(),
    BKASH_BASE_URL: zod_1.z.string().default('https://tokenized.sandbox.bka.sh/v1.2.0-beta'),
    BKASH_APP_KEY: zod_1.z.string().default(''),
    BKASH_APP_SECRET: zod_1.z.string().default(''),
    BKASH_USERNAME: zod_1.z.string().default(''),
    BKASH_PASSWORD: zod_1.z.string().default(''),
});
exports.env = schema.parse(process.env);
