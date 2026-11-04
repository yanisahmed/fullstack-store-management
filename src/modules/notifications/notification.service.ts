import { Notification } from './notification.model';

/** Fire-and-forget helper used by other modules. Never throws. */
export async function notify(storeId: unknown, type: string, title: string, message?: string, link?: string, i18n?: { code: string; params?: Record<string, unknown> }) {
  try {
    await Notification.create({ storeId, type, title, message, link, code: i18n?.code, params: i18n?.params });
  } catch (e) {
    console.error('notify failed', e);
  }
}
