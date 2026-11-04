import { AppError } from '../../utils/errors';
import { Image } from './image.model';

export type ImageKind = 'product' | 'customer';

/** Identify the real file type from its first bytes (never trust the Content-Type header). */
export function sniffImage(b: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

/**
 * Applies an image change coming from a create/update request.
 *   incoming undefined -> leave as is        (returns undefined)
 *   incoming null / '' -> remove the image   (returns null)
 *   incoming token     -> use that upload    (returns token; the previous image is deleted)
 */
export async function resolveImage(storeId: string, kind: ImageKind, incoming: string | null | undefined, current?: string | null) {
  if (incoming === undefined) return undefined;
  if (!incoming) {
    if (current) await Image.deleteOne({ storeId, token: current });
    return null;
  }
  if (incoming === current) return current;
  const img = await Image.findOne({ storeId, token: incoming, kind }).select('_id');
  if (!img) throw new AppError(400, 'Image not found', 'IMAGE_NOT_FOUND');
  if (current) await Image.deleteOne({ storeId, token: current });
  return incoming;
}
