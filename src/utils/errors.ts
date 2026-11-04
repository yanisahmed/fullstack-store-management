import { NextFunction, Request, Response } from 'express';

export class AppError extends Error {
  /** `code` + `params` let the web app show the message in the user's language */
  constructor(public status: number, message: string, public code?: string, public params?: Record<string, unknown>) {
    super(message);
  }
}

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);
