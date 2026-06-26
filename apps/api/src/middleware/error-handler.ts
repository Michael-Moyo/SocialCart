import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { ConnectorError } from '@socialcart/integrations';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[ErrorHandler]', err);

  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
    return;
  }

  // Connector errors
  if (err instanceof ConnectorError) {
    res.status(err.statusCode ?? 502).json({
      success: false,
      error: err.message,
      code: err.code,
      platform: err.platform,
    });
    return;
  }

  // Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        res.status(409).json({
          success: false,
          error: 'A record with these details already exists',
          field: (err.meta?.['target'] as string[])?.join(', '),
        });
        return;
      case 'P2025':
        res.status(404).json({ success: false, error: 'Record not found' });
        return;
      case 'P2003':
        res.status(400).json({ success: false, error: 'Foreign key constraint violation' });
        return;
      default:
        res.status(400).json({ success: false, error: 'Database error', code: err.code });
        return;
    }
  }

  // Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({ success: false, error: 'Database validation error' });
    return;
  }

  // Generic errors
  if (err instanceof Error) {
    const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
    res.status(statusCode).json({
      success: false,
      error: process.env['NODE_ENV'] === 'production' ? 'Internal server error' : err.message,
    });
    return;
  }

  res.status(500).json({ success: false, error: 'Internal server error' });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ success: false, error: 'Route not found' });
}
