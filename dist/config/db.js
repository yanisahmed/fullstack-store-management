"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("./env");
let pending = null;
/** Safe to call on every request: it reuses one connection (important on serverless). */
function connectDB() {
    if (mongoose_1.default.connection.readyState === 1)
        return Promise.resolve(mongoose_1.default);
    if (!pending) {
        pending = mongoose_1.default
            .connect(env_1.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
            .then((m) => {
            console.log('MongoDB connected');
            return m;
        })
            .catch((e) => {
            pending = null; // allow a retry on the next request
            throw e;
        });
    }
    return pending;
}
