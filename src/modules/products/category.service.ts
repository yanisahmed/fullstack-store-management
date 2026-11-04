import { Types } from 'mongoose';
import { Category } from './category.model';
import { Product } from './product.model';

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const exactCI = (s: string) => new RegExp(`^${escapeRe(s.trim())}$`, 'i');

/** Returns the canonical category name (creating the category if it is new). */
export async function resolveCategory(storeId: string, raw?: string | null) {
  const name = raw?.trim().replace(/\s+/g, ' ');
  if (!name) return undefined;
  const existing = await Category.findOne({ storeId, name: exactCI(name) });
  if (existing) return existing.name;
  try {
    return (await Category.create({ storeId, name })).name;
  } catch (e: any) {
    if (e?.code === 11000) return (await Category.findOne({ storeId, name: exactCI(name) }))?.name ?? name; // lost a race
    throw e;
  }
}

/** Older products have free-text categories. Make sure each one has a Category record. */
export async function syncCategoriesFromProducts(storeId: string) {
  const used: string[] = await Product.distinct('category', { storeId, category: { $nin: [null, ''] } });
  if (!used.length) return;
  const have = new Set((await Category.find({ storeId }).select('name')).map((c) => c.name.toLowerCase()));
  for (const u of used) {
    const n = u.trim();
    if (n && !have.has(n.toLowerCase())) {
      try { await Category.create({ storeId, name: n }); have.add(n.toLowerCase()); } catch { /* duplicate: ignore */ }
    }
  }
}

export async function categoryCounts(storeId: string) {
  const rows = await Product.aggregate([
    { $match: { storeId: new Types.ObjectId(storeId), isActive: true, category: { $nin: [null, ''] } } },
    { $group: { _id: { $toLower: '$category' }, n: { $sum: 1 } } },
  ]);
  return new Map<string, number>(rows.map((r) => [r._id as string, r.n as number]));
}
