import { round3 } from '../../common/units';
import { Product } from './product.model';

/** Removes floating-point dust (e.g. 0.30000000000000004) left behind by $inc */
export async function cleanStock(p: { _id: unknown; stock: number }) {
  const clean = Math.max(round3(p.stock), 0);
  if (clean !== p.stock) await Product.updateOne({ _id: p._id }, { stock: clean });
  return clean;
}
