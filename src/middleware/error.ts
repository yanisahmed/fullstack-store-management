import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ message: 'Route not found' });
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ message: 'Validation failed', errors: err.flatten().fieldErrors });
  }
  if (err instanceof AppError) return res.status(err.status).json({ message: err.message });
  if (err?.code === 11000) return res.status(409).json({ message: 'Duplicate value', fields: Object.keys(err.keyPattern || {}) });
  if (err?.name === 'CastError') return res.status(400).json({ message: 'Invalid id' });
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
}
