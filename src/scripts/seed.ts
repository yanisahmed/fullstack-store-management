import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { env } from '../config/env';
import { Plan } from '../modules/subscriptions/subscription.model';
import { User } from '../modules/users/user.model';
import { createSuperuser } from '../modules/users/user.service';

(async () => {
  await connectDB();

  if (await User.exists({ roles: 'superuser' })) {
    console.log('Superuser already exists, skipping (it can only be created once).');
  } else {
    if (!env.SUPERUSER_EMAIL || !env.SUPERUSER_PASSWORD) throw new Error('Set SUPERUSER_EMAIL and SUPERUSER_PASSWORD in .env');
    await createSuperuser(env.SUPERUSER_NAME, env.SUPERUSER_EMAIL, env.SUPERUSER_PASSWORD);
    console.log(`Superuser created: ${env.SUPERUSER_EMAIL}`);
  }

  const plans = [
    { code: 'basic', name: 'Basic', priceBDT: 499, durationDays: 30, modules: ['products', 'sales'] },
    { code: 'standard', name: 'Standard', priceBDT: 999, durationDays: 30, modules: ['products', 'sales', 'customers', 'notifications'] },
    { code: 'standard-yearly', name: 'Standard (Yearly)', priceBDT: 9990, durationDays: 365, modules: ['products', 'sales', 'customers', 'notifications'] },
  ];
  for (const p of plans) await Plan.updateOne({ code: p.code }, { $setOnInsert: p }, { upsert: true });
  console.log('Plans ready');

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
