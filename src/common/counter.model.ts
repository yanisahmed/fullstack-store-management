import { Schema, model } from 'mongoose';

const Counter = model('Counter', new Schema({ key: { type: String, unique: true }, seq: { type: Number, default: 0 } }));

export async function nextSeq(key: string) {
  const c = await Counter.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return c!.seq;
}
