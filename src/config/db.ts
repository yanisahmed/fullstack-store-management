import mongoose from 'mongoose';
import { env } from './env';

let pending: Promise<typeof mongoose> | null = null;

/** Safe to call on every request: it reuses one connection (important on serverless). */
export function connectDB() {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose);
  if (!pending) {
    pending = mongoose
      .connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
      .then((m) => {
        console.log('MongoDB connected');
        return m;
      })
      .catch((e) => {
        pending = null; // allow a retry on the next request
        throw e;
      });
  }
  return pending;
}
