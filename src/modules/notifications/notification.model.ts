import { Schema, model, Types } from 'mongoose';

const schema = new Schema(
  {
    storeId: { type: Types.ObjectId, ref: 'Store', required: true, index: true },
    type: { type: String, enum: ['low_stock', 'customer_due', 'payment_received', 'subscription', 'system'], required: true },
    title: { type: String, required: true },
    message: String,
    link: String,
    code: String, // lets the web app translate the message
    params: Schema.Types.Mixed,
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Notification = model('Notification', schema);
