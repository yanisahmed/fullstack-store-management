"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notify = notify;
const notification_model_1 = require("./notification.model");
/** Fire-and-forget helper used by other modules. Never throws. */
async function notify(storeId, type, title, message, link) {
    try {
        await notification_model_1.Notification.create({ storeId, type, title, message, link });
    }
    catch (e) {
        console.error('notify failed', e);
    }
}
