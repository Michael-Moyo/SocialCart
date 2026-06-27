import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import type { TeamRole } from '@prisma/client';

interface TenantJwtPayload {
  tenantId: string;
  memberId?: string;   // set when a team member logs in on behalf of tenant
  role?: TeamRole;
  iat: number;
  exp: number;
}

interface SuperAdminJwtPayload {
  superAdminId: string;
  iat: number;
  exp: number;
}

function secret(): string {
  const s = process.env['JWT_SECRET'];
  if (!s) throw new Error('JWT_SECRET not configured');
  return s;
}

// ─── Tenant / Team-member auth ────────────────────────────────────────────────

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
    return;
  }

  try {
    const payload = jwt.verify(header.slice(7), secret()) as TenantJwtPayload;

    const tenant = await prisma.tenant.findUnique({ where: { id: payload.tenantId } });
    if (!tenant || !tenant.isActive) {
      res.status(401).json({ success: false, error: 'Tenant not found or inactive' });
      return;
    }

    req.tenant = tenant;
    req.tenantId = tenant.id;

    // If this token was issued for a team member, attach them too
    if (payload.memberId) {
      const member = await prisma.teamMember.findUnique({ where: { id: payload.memberId } });
      if (member && member.isActive) {
        req.teamMember = member;
        req.teamMemberId = member.id;
      }
    }

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

// Require a minimum role level (OWNER > MANAGER > AGENT = SALES_REP)
const ROLE_RANK: Record<TeamRole, number> = {
  OWNER: 4,
  MANAGER: 3,
  AGENT: 2,
  SALES_REP: 1,
};

export function requireRole(...roles: TeamRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const member = req.teamMember;
    // Tenant owner (no teamMember on request) is always permitted
    if (!member) { next(); return; }
    if (roles.some((r) => ROLE_RANK[member.role] >= ROLE_RANK[r])) {
      next();
    } else {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
  };
}

// ─── Super-admin auth ─────────────────────────────────────────────────────────

export async function superAdminMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing Authorization header' });
    return;
  }

  try {
    const payload = jwt.verify(header.slice(7), secret()) as SuperAdminJwtPayload;
    if (!payload.superAdminId) {
      res.status(401).json({ success: false, error: 'Not a super-admin token' });
      return;
    }

    const admin = await prisma.superAdmin.findUnique({ where: { id: payload.superAdminId } });
    if (!admin || !admin.isActive) {
      res.status(401).json({ success: false, error: 'Super admin not found or inactive' });
      return;
    }

    req.superAdmin = admin;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, error: 'Token expired' });
    } else {
      res.status(401).json({ success: false, error: 'Invalid token' });
    }
  }
}

// ─── Token generators ─────────────────────────────────────────────────────────

export function generateToken(tenantId: string): string {
  return jwt.sign({ tenantId }, secret(), {
    expiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d',
  });
}

export function generateMemberToken(tenantId: string, memberId: string, role: TeamRole): string {
  return jwt.sign({ tenantId, memberId, role }, secret(), {
    expiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d',
  });
}

export function generateSuperAdminToken(superAdminId: string): string {
  return jwt.sign({ superAdminId }, secret(), {
    expiresIn: '12h',
  });
}
