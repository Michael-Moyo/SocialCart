'use client';

import { RefreshCw, Trash2, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime, platformLabel } from '@/lib/utils';
import type { Integration } from '@/lib/api';

const PLATFORM_COLORS: Record<string, string> = {
  shopify: 'bg-green-100 text-green-800',
  woocommerce: 'bg-purple-100 text-purple-800',
  odoo: 'bg-blue-100 text-blue-800',
  erpnext: 'bg-orange-100 text-orange-800',
  retailman: 'bg-gray-100 text-gray-800',
};

const PLATFORM_ICONS: Record<string, string> = {
  shopify: '🛍️',
  woocommerce: '🛒',
  odoo: '⚙️',
  erpnext: '🏭',
  retailman: '🏪',
};

const STATUS_ICONS = {
  ACTIVE: CheckCircle,
  ERROR: XCircle,
  INACTIVE: Clock,
  SYNCING: RefreshCw,
};

interface IntegrationCardProps {
  integration: Integration;
  onSync?: (id: string) => void;
  onDelete?: (id: string) => void;
  isSyncing?: boolean;
}

export function IntegrationCard({ integration, onSync, onDelete, isSyncing }: IntegrationCardProps) {
  const StatusIcon = STATUS_ICONS[integration.status as keyof typeof STATUS_ICONS] ?? AlertCircle;
  const platformColor = PLATFORM_COLORS[integration.type] ?? 'bg-gray-100 text-gray-800';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${platformColor}`}>
            {PLATFORM_ICONS[integration.type] ?? '🔌'}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{platformLabel(integration.type)}</h3>
            <div className="flex items-center gap-1 mt-0.5">
              <StatusIcon className={`h-3.5 w-3.5 ${integration.status === 'ACTIVE' ? 'text-green-500' : integration.status === 'ERROR' ? 'text-red-500' : 'text-gray-400'} ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="text-xs text-gray-500 capitalize">{integration.status.toLowerCase()}</span>
            </div>
          </div>
        </div>
        <Badge status={integration.status} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500">Last sync</span>
          <p className="text-gray-900 font-medium mt-0.5">
            {integration.lastSyncAt ? formatDateTime(integration.lastSyncAt) : 'Never'}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Sync count</span>
          <p className="text-gray-900 font-medium mt-0.5">{integration.syncCount}</p>
        </div>
      </div>

      {/* Error */}
      {integration.errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
          {integration.errorMessage}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onSync?.(integration.id)}
          loading={isSyncing}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Sync Now
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-red-500 hover:bg-red-50 hover:text-red-600"
          onClick={() => onDelete?.(integration.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
