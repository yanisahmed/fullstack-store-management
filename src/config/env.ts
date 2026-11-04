import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(5000),
  CLIENT_URL: z.string().default('http://localhost:3000'),
  API_URL: z.string().default('http://localhost:5000'),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  TZ_OFFSET_MINUTES: z.coerce.number().default(360), // Bangladesh = UTC+6
  SUPERUSER_NAME: z.string().default('Super Admin'),
  SUPERUSER_EMAIL: z.string().optional(),
  SUPERUSER_PASSWORD: z.string().optional(),
  BKASH_BASE_URL: z.string().default('https://tokenized.sandbox.bka.sh/v1.2.0-beta'),
  BKASH_APP_KEY: z.string().default(''),
  BKASH_APP_SECRET: z.string().default(''),
  BKASH_USERNAME: z.string().default(''),
  BKASH_PASSWORD: z.string().default(''),
});

export const env = schema.parse(process.env);
