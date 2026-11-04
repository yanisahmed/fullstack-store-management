import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { Customer } from '../modules/customers/customer.model';
import { normalizePhone } from '../modules/customers/customer.service';
import { syncCategoriesFromProducts } from '../modules/products/category.service';
import { Image } from '../modules/images/image.model';
import { Product } from '../modules/products/product.model';
import { Store } from '../modules/stores/store.model';

/** Safe to run any number of times. Fills in data needed by the duplicate checks and categories. */
(async () => {
  await connectDB();
  let fixed = 0;
  for await (const c of Customer.find({ phone: { $nin: [null, ''] }, phoneNormalized: { $exists: false } })) {
    c.phoneNormalized = normalizePhone(c.phone);
    await c.save();
    fixed++;
  }
  console.log(`Customers updated: ${fixed}`);
  for (const s of await Store.find().select('_id')) await syncCategoriesFromProducts(String(s._id));
  console.log('Categories created from existing products');

  // Remove photos that were uploaded but never saved onto a product/customer (older than 24h)
  const used = [...(await Product.distinct('imageToken', { imageToken: { $type: 'string' } })), ...(await Customer.distinct('imageToken', { imageToken: { $type: 'string' } }))];
  const del = await Image.deleteMany({ createdAt: { $lt: new Date(Date.now() - 864e5) }, token: { $nin: used } });
  console.log(`Unused photos removed: ${del.deletedCount}`);

  // Report (do not delete) customers that now share a phone number
  const dups = await Customer.aggregate([
    { $match: { isActive: true, phoneNormalized: { $type: 'string' } } },
    { $group: { _id: { s: '$storeId', p: '$phoneNormalized' }, names: { $push: '$name' }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  if (dups.length) console.log('Customers sharing a phone number (please review):', JSON.stringify(dups.map((d) => ({ phone: d._id.p, names: d.names })), null, 1));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
