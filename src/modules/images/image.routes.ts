import crypto from 'crypto';
import express, { Router } from 'express';
import { authenticate, authorize, getStoreId, requireModule } from '../../middleware/auth';
import { AppError, asyncHandler } from '../../utils/errors';
import { Image } from './image.model';
import { ImageKind, sniffImage } from './image.service';

const MAX_BYTES = 1_000_000; // the web app shrinks photos to ~50 KB, this is just a safety net
const MAX_PER_STORE = 2000;

// Only parse the body as raw bytes when the client says it is a JPEG/PNG/WebP
const rawImage = express.raw({ type: (req) => /^image\/(jpeg|png|webp)$/i.test(req.headers['content-type'] ?? ''), limit: MAX_BYTES });

export const imageRoutes = Router();

function upload(kind: ImageKind) {
  return asyncHandler(async (req, res) => {
    const storeId = getStoreId(req);
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new AppError(400, 'Send a JPG, PNG or WebP image', 'IMAGE_INVALID');
    const contentType = sniffImage(req.body);
    if (!contentType) throw new AppError(400, 'Send a JPG, PNG or WebP image', 'IMAGE_INVALID');
    if ((await Image.countDocuments({ storeId })) >= MAX_PER_STORE) throw new AppError(409, 'Photo limit reached', 'IMAGE_LIMIT');
    const token = crypto.randomBytes(16).toString('hex');
    await Image.create({ storeId, token, kind, contentType, size: req.body.length, data: req.body });
    res.status(201).json({ token, size: req.body.length });
  });
}

// Upload: raw image bytes in the body, Content-Type: image/jpeg|png|webp
imageRoutes.post('/product', authenticate, requireModule('products'), authorize('superuser', 'admin', 'manager'), rawImage, upload('product'));
imageRoutes.post('/customer', authenticate, requireModule('customers'), authorize('superuser', 'admin', 'manager', 'cashier'), rawImage, upload('customer'));

// Public by design: <img> tags cannot send a login header. The 128-bit random token acts as the secret link.
imageRoutes.get('/:token', asyncHandler(async (req, res) => {
  const token = req.params.token;
  if (!/^[a-f0-9]{32}$/.test(token)) throw new AppError(404, 'Not found', 'NOT_FOUND');
  const etag = `"${token}"`;
  res.set({
    // helmet defaults to same-origin, which would block the web app (a different origin) from showing the picture
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Cache-Control': 'public, max-age=31536000, immutable', // a token never changes its picture
    'X-Content-Type-Options': 'nosniff',
    ETag: etag,
  });
  if (req.headers['if-none-match'] === etag) return void res.status(304).end(); // no database read needed
  const img = await Image.findOne({ token }).select('contentType data');
  if (!img) throw new AppError(404, 'Not found', 'NOT_FOUND');
  res.type(img.contentType).send(img.data);
}));
