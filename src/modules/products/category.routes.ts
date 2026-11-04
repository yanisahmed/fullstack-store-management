import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, getStoreId, requireModule } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { AppError, asyncHandler } from '../../utils/errors';
import { Category } from './category.model';
import { categoryCounts, exactCI, syncCategoriesFromProducts } from './category.service';
import { Product } from './product.model';

const nameSchema = z.object({ name: z.string().trim().min(1).max(60) });

export const categoryRoutes = Router();
categoryRoutes.use(authenticate, requireModule('products'));
const canWrite = authorize('superuser', 'admin', 'manager');

categoryRoutes.get('/', asyncHandler(async (req, res) => {
  const storeId = getStoreId(req);
  await syncCategoriesFromProducts(storeId);
  const [cats, counts] = await Promise.all([Category.find({ storeId }).sort('name').collation({ locale: 'en', strength: 2 }), categoryCounts(storeId)]);
  res.json(cats.map((c) => ({ _id: c._id, name: c.name, productCount: counts.get(c.name.toLowerCase()) ?? 0 })));
}));

categoryRoutes.post('/', canWrite, validate(nameSchema), asyncHandler(async (req, res) => {
  const storeId = getStoreId(req);
  const name = req.body.name.replace(/\s+/g, ' ');
  const dup = await Category.findOne({ storeId, name: exactCI(name) });
  if (dup) throw new AppError(409, `Category "${dup.name}" already exists`, 'CATEGORY_EXISTS', { name: dup.name });
  res.status(201).json(await Category.create({ storeId, name }));
}));

// Renaming also renames the category on every product that uses it
categoryRoutes.patch('/:id', canWrite, validate(nameSchema), asyncHandler(async (req, res) => {
  const storeId = getStoreId(req);
  const cat = await Category.findOne({ _id: req.params.id, storeId });
  if (!cat) throw new AppError(404, 'Category not found', 'NOT_FOUND');
  const name = req.body.name.replace(/\s+/g, ' ');
  const dup = await Category.findOne({ storeId, name: exactCI(name), _id: { $ne: cat._id } });
  if (dup) throw new AppError(409, `Category "${dup.name}" already exists`, 'CATEGORY_EXISTS', { name: dup.name });
  const old = cat.name;
  cat.name = name;
  await cat.save();
  await Product.updateMany({ storeId, category: exactCI(old) }, { category: name });
  res.json(cat);
}));

categoryRoutes.delete('/:id', canWrite, asyncHandler(async (req, res) => {
  const storeId = getStoreId(req);
  const cat = await Category.findOne({ _id: req.params.id, storeId });
  if (!cat) throw new AppError(404, 'Category not found', 'NOT_FOUND');
  const count = await Product.countDocuments({ storeId, isActive: true, category: exactCI(cat.name) });
  if (count > 0) throw new AppError(409, `${count} products still use this category`, 'CATEGORY_IN_USE', { count });
  await cat.deleteOne();
  res.json({ message: 'Category deleted' });
}));
