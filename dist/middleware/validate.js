"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const validate = (schema, source = 'body') => (req, _res, next) => {
    try {
        req[source] = schema.parse(req[source]);
        next();
    }
    catch (e) {
        next(e);
    }
};
exports.validate = validate;
