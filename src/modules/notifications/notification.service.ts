import { Notification } from './notification.model';

/** Fire-and-forget helper used by other modules. Never throws. */
export async function notify(storeId: unknown, type: string, title: string, message?: string, link?: string) {
  try {
    await Notification.create({ storeId, type, title, message, link });
  } catch (e) {
    console.error('notify failed', e);
  }
}
