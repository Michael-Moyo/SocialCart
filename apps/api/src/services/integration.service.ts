import { IntegrationType } from '@prisma/client';
import { integrationManager, ConnectorConfig, PlatformType } from '@socialcart/integrations';
import prisma from '../lib/prisma';
import { encryptObject, decryptObject } from '../lib/encryption';

export interface RegisterIntegrationInput {
  tenantId: string;
  type: PlatformType;
  credentials: Record<string, string>;
  webhookSecret?: string;
  syncInterval?: number;
}

export const integrationService = {
  async register(input: RegisterIntegrationInput) {
    const encryptedCredentials = encryptObject(input.credentials as Record<string, unknown>);

    // Upsert in DB
    const integration = await prisma.integration.upsert({
      where: { tenantId_type: { tenantId: input.tenantId, type: input.type as IntegrationType } },
      create: {
        tenantId: input.tenantId,
        type: input.type as IntegrationType,
        credentials: encryptedCredentials,
        config: { webhookSecret: input.webhookSecret, syncInterval: input.syncInterval ?? 60 },
        status: 'ACTIVE',
      },
      update: {
        credentials: encryptedCredentials,
        config: { webhookSecret: input.webhookSecret, syncInterval: input.syncInterval ?? 60 },
        status: 'ACTIVE',
        errorMessage: null,
      },
    });

    // Register in memory manager
    const config: ConnectorConfig = {
      type: input.type,
      credentials: input.credentials,
      webhookSecret: input.webhookSecret,
      syncInterval: input.syncInterval ?? 60,
    };

    try {
      await integrationManager.registerConnector(input.tenantId, config);
    } catch (err) {
      // Mark as error if connection test fails
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          status: 'ERROR',
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }

    return integration;
  },

  async listForTenant(tenantId: string) {
    return prisma.integration.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        status: true,
        lastSyncAt: true,
        syncCount: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        // Exclude credentials from list response
      },
    });
  },

  async remove(tenantId: string, integrationId: string) {
    const integration = await prisma.integration.findFirst({
      where: { id: integrationId, tenantId },
    });
    if (!integration) throw new Error('Integration not found');

    integrationManager.removeConnector(tenantId, integration.type as PlatformType);
    await prisma.integration.delete({ where: { id: integrationId } });
  },

  async triggerSync(tenantId: string, platform?: PlatformType) {
    const results = platform
      ? { [platform]: await integrationManager.syncProducts(tenantId, platform) }
      : await integrationManager.syncAll(tenantId);

    // Update lastSyncAt
    const types = platform ? [platform] : Object.keys(results).map((k) => k.split(':')[0] as PlatformType);
    for (const type of [...new Set(types)]) {
      await prisma.integration.updateMany({
        where: { tenantId, type: type as IntegrationType },
        data: { lastSyncAt: new Date(), syncCount: { increment: 1 }, status: 'ACTIVE' },
      });
    }

    return results;
  },

  /**
   * Load all integrations from DB into memory on startup
   */
  async loadAll() {
    const integrations = await prisma.integration.findMany({
      where: { status: { in: ['ACTIVE', 'SYNCING'] } },
    });

    for (const integration of integrations) {
      try {
        const credentials = decryptObject<Record<string, string>>(integration.credentials);
        const config = integration.config as Record<string, unknown> | null;
        const connectorConfig: ConnectorConfig = {
          type: integration.type as PlatformType,
          credentials,
          webhookSecret: (config?.['webhookSecret'] as string) ?? undefined,
          syncInterval: (config?.['syncInterval'] as number) ?? 60,
        };
        integrationManager.registerConnectorUnchecked(integration.tenantId, connectorConfig);
      } catch (err) {
        console.error(`Failed to load integration ${integration.id}:`, err);
      }
    }

    console.log(`[IntegrationService] Loaded ${integrations.length} integrations`);
  },
};
