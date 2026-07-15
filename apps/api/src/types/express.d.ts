import { Tenant, TeamMember, SuperAdmin } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
      tenantId?: string;
      teamMember?: TeamMember;
      teamMemberId?: string;
      superAdmin?: SuperAdmin;
      rawBody?: Buffer;
    }
  }
}
