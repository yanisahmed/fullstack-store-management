"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const db_1 = require("../config/db");
const env_1 = require("../config/env");
const subscription_model_1 = require("../modules/subscriptions/subscription.model");
const user_model_1 = require("../modules/users/user.model");
const user_service_1 = require("../modules/users/user.service");
(async () => {
    await (0, db_1.connectDB)();
    if (await user_model_1.User.exists({ roles: 'superuser' })) {
        console.log('Superuser already exists, skipping (it can only be created once).');
    }
    else {
        if (!env_1.env.SUPERUSER_EMAIL || !env_1.env.SUPERUSER_PASSWORD)
            throw new Error('Set SUPERUSER_EMAIL and SUPERUSER_PASSWORD in .env');
        await (0, user_service_1.createSuperuser)(env_1.env.SUPERUSER_NAME, env_1.env.SUPERUSER_EMAIL, env_1.env.SUPERUSER_PASSWORD);
        console.log(`Superuser created: ${env_1.env.SUPERUSER_EMAIL}`);
    }
    const plans = [
        { code: 'basic', name: 'Basic', priceBDT: 499, durationDays: 30, modules: ['products', 'sales'] },
        { code: 'standard', name: 'Standard', priceBDT: 999, durationDays: 30, modules: ['products', 'sales', 'customers', 'notifications'] },
        { code: 'standard-yearly', name: 'Standard (Yearly)', priceBDT: 9990, durationDays: 365, modules: ['products', 'sales', 'customers', 'notifications'] },
    ];
    for (const p of plans)
        await subscription_model_1.Plan.updateOne({ code: p.code }, { $setOnInsert: p }, { upsert: true });
    console.log('Plans ready');
    await mongoose_1.default.disconnect();
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
