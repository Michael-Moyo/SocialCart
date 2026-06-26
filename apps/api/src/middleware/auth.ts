import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

interface JwtPayload {
  tenantId: string;
  iat: number;
  exp: number;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    res.status(500).json({ success: false, error: 'Server configuration error' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;

    const tenant = await prisma.tenant.findUnique({ where: { id: payload.tenantId } });
    if (!tenant || !tenant.isActive) {
      res.status(401).json({ success: false, error: 'Tenant not found or inactive' });
      return;
    }

    req.tenant = tenant;
    req.tenantId = tenant.id;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, error: 'Token expired' });
    } else if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ success: false, error: 'Invalid token' });
    } else {
      next(err);
    }
  }
}

export function generateToken(tenantId: string): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ tenantId }, secret, {
    expiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d',
  });
}
