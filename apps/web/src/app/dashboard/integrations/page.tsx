'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { IntegrationCard } from '@/components/integrations/integration-card';
import { AddIntegrationModal } from '@/components/integrations/add-integration-modal';
import { useIntegrations, useSyncIntegration, useDeleteIntegration } from '@/lib/api';

export default function IntegrationsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const { data: integrations, isLoading } = useIntegrations();
  const { mutate: syncIntegration } = useSyncIntegration();
  const { mutate: deleteIntegration } = useDeleteIntegration();

  const handleSync = (id: string) => {
    setSyncingId(id);
    syncIntegration(id, {
      onSettled: () => setSyncingId(null),
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to remove this integration?')) return;
    deleteIntegration(id);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <Header
        title="Integrations"
        description="Connect your eCommerce platforms and ERP systems"
      />

      <div className="p-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">
            {integrations?.length ?? 0} platform{(integrations?.length ?? 0) !== 1 ? 's' : ''} connected
          </p>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Integration
          </Button>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 h-48 animate-pulse" />
            ))}
          </div>
        ) : integrations?.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                onSync={handleSync}
                onDelete={handleDelete}
                isSyncing={syncingId === integration.id}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-2xl flex items-center justify-center text-3xl mb-4">
              🔌
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No integrations yet</h3>
            <p className="text-sm text-gray-500 mt-2 mb-6 max-w-sm mx-auto">
              Connect Shopify, WooCommerce, Odoo, ERPNext, or RetailMan to start selling on WhatsApp.
            </p>
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Your First Integration
            </Button>
          </div>
        )}
      </div>

      <AddIntegrationModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
