import { createApp } from './app';
import prisma from './lib/prisma';
import { integrationService } from './services/integration.service';
import { startCartRecoveryCron } from './services/cart-recovery.service';
import { runScheduledCampaigns } from './services/campaign.service';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);

async function main() {
  // Connect to database
  await prisma.$connect();
  console.log('[DB] Connected to PostgreSQL');

  // Load integrations from DB into memory
  await integrationService.loadAll();

  // Start abandoned cart recovery cron (every 15 min)
  startCartRecoveryCron();

  // Check for due scheduled campaigns every minute
  setInterval(() => { void runScheduledCampaigns(); }, 60_000);

  // Start HTTP server
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[API] SocialCart API running on http://localhost:${PORT}`);
    console.log(`[API] Environment: ${process.env['NODE_ENV'] ?? 'development'}`);
  });
}

// Graceful shutdown
async function shutdown() {
  console.log('[API] Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err);
  shutdown().catch(() => process.exit(1));
});
process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

main().catch((err) => {
  console.error('[Fatal]', err);
  process.exit(1);
});
