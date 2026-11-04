import { round3 } from '../../common/units';
import { AppError } from '../../utils/errors';
import { exactCI } from './category.service';
import { Product } from './product.model';

/** Removes floating-point dust (e.g. 0.30000000000000004) left behind by $inc */
export async function cleanStock(p: { _id: unknown; stock: number }) {
  const clean = Math.max(round3(p.stock), 0);
  if (clean !== p.stock) await Product.updateOne({ _id: p._id }, { stock: clean });
  return clean;
}

/** Finds another product (active OR deleted) with the same SKU or the same name in this store. */
export async function findProductDuplicates(storeId: string, p: { sku?: string; name?: string }, excludeId?: string) {
  const notSelf = excludeId ? { _id: { $ne: excludeId } } : {};
  const [bySku, byName] = await Promise.all([
    p.sku?.trim() ? Product.findOne({ storeId, sku: p.sku.trim().toUpperCase(), ...notSelf }).select('name sku isActive unit') : null,
    p.name?.trim() ? Product.findOne({ storeId, name: exactCI(p.name.replace(/\s+/g, ' ')), ...notSelf }).select('name sku isActive unit') : null,
  ]);
  return { bySku, byName };
}

export async function assertNoProductDuplicate(storeId: string, p: { sku?: string; name?: string }, excludeId?: string) {
  const { bySku, byName } = await findProductDuplicates(storeId, p, excludeId);
  if (bySku) throw new AppError(409, `SKU ${bySku.sku} is already used by "${bySku.name}"`, bySku.isActive ? 'DUPLICATE_SKU' : 'DUPLICATE_SKU_DELETED', { id: String(bySku._id), name: bySku.name, sku: bySku.sku });
  if (byName) throw new AppError(409, `A product named "${byName.name}" already exists`, byName.isActive ? 'DUPLICATE_NAME' : 'DUPLICATE_NAME_DELETED', { id: String(byName._id), name: byName.name, sku: byName.sku });
}
