"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const db_1 = require("./config/db");
const error_1 = require("./middleware/error");
const auth_routes_1 = require("./modules/auth/auth.routes");
const customer_routes_1 = require("./modules/customers/customer.routes");
const notification_routes_1 = require("./modules/notifications/notification.routes");
const product_routes_1 = require("./modules/products/product.routes");
const sale_routes_1 = require("./modules/sales/sale.routes");
const store_routes_1 = require("./modules/stores/store.routes");
const subscription_routes_1 = require("./modules/subscriptions/subscription.routes");
const user_routes_1 = require("./modules/users/user.routes");
exports.app = (0, express_1.default)();
exports.app.use((0, helmet_1.default)());
/* app.use(cors({ origin: env.CLIENT_URL, credentials: true })); */
exports.app.use((0, cors_1.default)({
    origin: [
        "http://localhost:3000",
        "https://abhanis.vercel.app",
    ],
    credentials: true,
}));
exports.app.use(express_1.default.json());
exports.app.use((0, morgan_1.default)('dev'));
exports.app.get('/health', (_req, res) => res.json({ ok: true }));
const v1 = express_1.default.Router();
// Connect to MongoDB on demand (needed on Vercel, harmless locally)
v1.use(async (_req, _res, next) => {
    try {
        await (0, db_1.connectDB)();
        next();
    }
    catch (e) {
        next(e);
    }
});
v1.use('/auth', auth_routes_1.authRoutes);
v1.use('/users', user_routes_1.userRoutes);
v1.use('/stores', store_routes_1.storeRoutes);
v1.use('/subscriptions', subscription_routes_1.subscriptionRoutes);
v1.use('/products', product_routes_1.productRoutes);
v1.use('/customers', customer_routes_1.customerRoutes);
v1.use('/sales', sale_routes_1.saleRoutes);
v1.use('/notifications', notification_routes_1.notificationRoutes);
exports.app.use('/api/v1', v1);
exports.app.use(error_1.notFound);
exports.app.use(error_1.errorHandler);
exports.default = exports.app;
