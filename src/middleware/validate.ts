import { NextFunction, Request, Response } from 'express';
import { ZodTypeAny } from 'zod';

export const validate =
  (schema: ZodTypeAny, source: 'body' | 'query' = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      (req as any)[source] = schema.parse(req[source]);
      next();
    } catch (e) {
      next(e);
    }
  };
