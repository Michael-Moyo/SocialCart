import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { notificationService } from '../services/notification.service';

const router = Router();

// Track active SSE clients per tenant
const clients = new Map<string, Set<Response>>();

function addClient(tenantId: string, res: Response) {
  if (!clients.has(tenantId)) clients.set(tenantId, new Set());
  clients.get(tenantId)!.add(res);
}

function removeClient(tenantId: string, res: Response) {
  clients.get(tenantId)?.delete(res);
  if (clients.get(tenantId)?.size === 0) clients.delete(tenantId);
}

/** Push an event to all SSE clients of a tenant */
export function pushToTenant(tenantId: string, event: string, data: unknown) {
  const tenantClients = clients.get(tenantId);
  if (!tenantClients || tenantClients.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of tenantClients) {
    try { res.write(payload); } catch { /* client disconnected */ }
  }
}

// SSE-specific auth: EventSource can't set headers, so accept token from query param OR Authorization header
async function sseAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const secret = process.env['JWT_SECRET'];
  if (!secret) { res.status(500).end(); return; }

  const token =
    (req.query['token'] as string | undefined) ??
    req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) {
    res.status(401).json({ success: false, error: 'Missing token' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as { tenantId: string };
    const tenant = await prisma.tenant.findUnique({ where: { id: payload.tenantId } });
    if (!tenant || !tenant.isActive) {
      res.status(401).json({ success: false, error: 'Tenant not found or inactive' });
      return;
    }
    req.tenantId = tenant.id;
    req.tenant = tenant;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

// GET /api/v1/sse — establish SSE stream
router.get('/', sseAuth, (req: Request, res: Response) => {
  const tenantId = req.tenantId!;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  // Send initial ping to confirm connection
  res.write(`event: connected\ndata: ${JSON.stringify({ tenantId })}\n\n`);

  // Heartbeat every 25s (keeps connection alive through proxies)
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
  }, 25000);

  addClient(tenantId, res);

  // Forward notification service events to this SSE stream
  function onDispatched(payload: unknown) {
    const p = payload as { tenantId: string };
    if (p.tenantId === tenantId) {
      pushToTenant(tenantId, 'notification', payload);
    }
  }
  notificationService.on('dispatched', onDispatched);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(tenantId, res);
    notificationService.off('dispatched', onDispatched);
  });
});

export default router;
