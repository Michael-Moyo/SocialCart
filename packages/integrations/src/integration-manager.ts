import { BaseConnector } from './base-connector';
import { ConnectorConfig, ConnectorError, PlatformType, SyncResult } from './types';
import { ShopifyConnector } from './connectors/shopify';
import { WooCommerceConnector } from './connectors/woocommerce';
import { OdooConnector } from './connectors/odoo';
import { ERPNextConnector } from './connectors/erpnext';
import { RetailManConnector } from './connectors/retailman';

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createConnector(config: ConnectorConfig): BaseConnector {
  switch (config.type) {
    case 'shopify':
      return new ShopifyConnector(config);
    case 'woocommerce':
      return new WooCommerceConnector(config);
    case 'odoo':
      return new OdooConnector(config);
    case 'erpnext':
      return new ERPNextConnector(config);
    case 'retailman':
      return new RetailManConnector(config);
    default: {
      const _exhaustive: never = config.type;
      throw new ConnectorError(`Unknown platform type: ${String(_exhaustive)}`, 'INVALID_CONFIG');
    }
  }
}

// ─── IntegrationManager ───────────────────────────────────────────────────────

export class IntegrationManager {
  private readonly connectors = new Map<string, BaseConnector>();

  /**
   * Register and initialize a connector for a tenant.
   * Throws if connection test fails.
   */
  async registerConnector(tenantId: string, config: ConnectorConfig): Promise<BaseConnector> {
    const connector = createConnector(config);

    const connected = await connector.testConnection();
    if (!connected) {
      throw new ConnectorError(
        `Failed to connect to ${config.type} for tenant ${tenantId}`,
        'CONNECTION_FAILED',
        undefined,
        undefined,
        config.type
      );
    }

    this.connectors.set(this.connectorKey(tenantId, config.type), connector);
    return connector;
  }

  /**
   * Register without testing connection (for initialization from DB).
   */
  registerConnectorUnchecked(tenantId: string, config: ConnectorConfig): BaseConnector {
    const connector = createConnector(config);
    this.connectors.set(this.connectorKey(tenantId, config.type), connector);
    return connector;
  }

  getConnector(tenantId: string, platform?: PlatformType): BaseConnector {
    if (platform) {
      const key = this.connectorKey(tenantId, platform);
      const connector = this.connectors.get(key);
      if (!connector) {
        throw new ConnectorError(
          `No ${platform} connector registered for tenant ${tenantId}`,
          'CONNECTOR_NOT_FOUND'
        );
      }
      return connector;
    }

    // Return the first connector for the tenant
    for (const [key, connector] of this.connectors) {
      if (key.startsWith(`${tenantId}:`)) return connector;
    }

    throw new ConnectorError(
      `No connector registered for tenant ${tenantId}`,
      'CONNECTOR_NOT_FOUND'
    );
  }

  hasConnector(tenantId: string, platform?: PlatformType): boolean {
    if (platform) {
      return this.connectors.has(this.connectorKey(tenantId, platform));
    }
    for (const key of this.connectors.keys()) {
      if (key.startsWith(`${tenantId}:`)) return true;
    }
    return false;
  }

  removeConnector(tenantId: string, platform?: PlatformType): void {
    if (platform) {
      this.connectors.delete(this.connectorKey(tenantId, platform));
      return;
    }
    for (const key of this.connectors.keys()) {
      if (key.startsWith(`${tenantId}:`)) {
        this.connectors.delete(key);
      }
    }
  }

  listTenantConnectors(tenantId: string): { platform: PlatformType; connector: BaseConnector }[] {
    const result: { platform: PlatformType; connector: BaseConnector }[] = [];
    for (const [key, connector] of this.connectors) {
      if (key.startsWith(`${tenantId}:`)) {
        const platform = key.split(':')[1] as PlatformType;
        result.push({ platform, connector });
      }
    }
    return result;
  }

  async syncProducts(tenantId: string, platform?: PlatformType): Promise<SyncResult> {
    const startedAt = new Date();
    const connector = this.getConnector(tenantId, platform);

    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: SyncResult['errors'] = [];

    try {
      const products = await connector.getProducts({ status: 'all', limit: 250 });

      for (const product of products) {
        try {
          // In a real app, upsert to DB here.
          // This layer just returns the data — the service layer handles persistence.
          updated++; // treat all as updated for now
        } catch (err) {
          failed++;
          errors.push({
            externalId: product.externalId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (err) {
      failed++;
      errors.push({
        externalId: 'bulk',
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const completedAt = new Date();
    return {
      success: failed === 0,
      entity: 'products',
      created,
      updated,
      failed,
      errors,
      startedAt,
      completedAt,
      duration: completedAt.getTime() - startedAt.getTime(),
    };
  }

  async syncOrders(tenantId: string, platform?: PlatformType): Promise<SyncResult> {
    const startedAt = new Date();
    const connector = this.getConnector(tenantId, platform);

    let updated = 0;
    let failed = 0;
    const errors: SyncResult['errors'] = [];

    try {
      // Connectors expose listOrders via their sub-clients; call getProducts as proxy for now
      // The service layer calls connector sub-clients directly for order sync
      updated = 0;
    } catch (err) {
      failed++;
      errors.push({
        externalId: 'bulk',
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const completedAt = new Date();
    return {
      success: failed === 0,
      entity: 'orders',
      created: 0,
      updated,
      failed,
      errors,
      startedAt,
      completedAt,
      duration: completedAt.getTime() - startedAt.getTime(),
    };
  }

  async syncAll(tenantId: string): Promise<Record<string, SyncResult>> {
    const connectorList = this.listTenantConnectors(tenantId);
    const results: Record<string, SyncResult> = {};

    await Promise.allSettled(
      connectorList.map(async ({ platform }) => {
        const [productsResult, ordersResult] = await Promise.allSettled([
          this.syncProducts(tenantId, platform),
          this.syncOrders(tenantId, platform),
        ]);

        results[`${platform}:products`] =
          productsResult.status === 'fulfilled'
            ? productsResult.value
            : {
                success: false,
                entity: 'products',
                created: 0,
                updated: 0,
                failed: 1,
                errors: [{ externalId: 'bulk', error: String((productsResult as PromiseRejectedResult).reason) }],
                startedAt: new Date(),
                completedAt: new Date(),
                duration: 0,
              };

        results[`${platform}:orders`] =
          ordersResult.status === 'fulfilled'
            ? ordersResult.value
            : {
                success: false,
                entity: 'orders',
                created: 0,
                updated: 0,
                failed: 1,
                errors: [{ externalId: 'bulk', error: String((ordersResult as PromiseRejectedResult).reason) }],
                startedAt: new Date(),
                completedAt: new Date(),
                duration: 0,
              };
      })
    );

    return results;
  }

  private connectorKey(tenantId: string, platform: PlatformType): string {
    return `${tenantId}:${platform}`;
  }
}

// Singleton export
export const integrationManager = new IntegrationManager();
