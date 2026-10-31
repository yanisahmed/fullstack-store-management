import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { connectDB } from './config/db';
import { errorHandler, notFound } from './middleware/error';
import { authRoutes } from './modules/auth/auth.routes';
import { customerRoutes } from './modules/customers/customer.routes';
import { notificationRoutes } from './modules/notifications/notification.routes';
import { productRoutes } from './modules/products/product.routes';
import { saleRoutes } from './modules/sales/sale.routes';
import { storeRoutes } from './modules/stores/store.routes';
import { subscriptionRoutes } from './modules/subscriptions/subscription.routes';
import { userRoutes } from './modules/users/user.routes';

export const app = express();
app.use(helmet());
/* app.use(cors({ origin: env.CLIENT_URL, credentials: true })); */
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://abhanis.vercel.app",
  ],
  credentials: true,
}));
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ ok: true }));

const v1 = express.Router();
// Connect to MongoDB on demand (needed on Vercel, harmless locally)
v1.use(async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (e) {
    next(e);
  }
});
v1.use('/auth', authRoutes);
v1.use('/users', userRoutes);
v1.use('/stores', storeRoutes);
v1.use('/subscriptions', subscriptionRoutes);
v1.use('/products', productRoutes);
v1.use('/customers', customerRoutes);
v1.use('/sales', saleRoutes);
v1.use('/notifications', notificationRoutes);
app.use('/api/v1', v1);

app.use(notFound);
app.use(errorHandler);

export default app;
