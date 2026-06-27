'use client';

import { ShoppingCart, Users, TrendingUp, Plug, Package, MessageSquare } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { StatCard } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOrders, useCustomers, useIntegrations } from '@/lib/api';
import { formatCurrency, formatDateTime, platformLabel } from '@/lib/utils';

export default function DashboardPage() {
  const { data: ordersData } = useOrders({ limit: 5 });
  const { data: customersData } = useCustomers({ limit: 5 });
  const { data: integrations } = useIntegrations();

  const totalRevenue = ordersData?.data?.reduce((sum, o) => sum + parseFloat(o.total), 0) ?? 0;
  const totalOrders = ordersData?.meta?.total ?? 0;
  const totalCustomers = customersData?.meta?.total ?? 0;
  const activeIntegrations = integrations?.filter((i) => i.status === 'ACTIVE').length ?? 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <Header
        title="Dashboard"
        description="Welcome back. Here's what's happening with your store."
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Orders"
            value={totalOrders.toLocaleString()}
            icon={<ShoppingCart className="h-5 w-5" />}
          />
          <StatCard
            title="Revenue"
            value={formatCurrency(totalRevenue)}
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <StatCard
            title="Customers"
            value={totalCustomers.toLocaleString()}
            icon={<Users className="h-5 w-5" />}
          />
          <StatCard
            title="Active Integrations"
            value={activeIntegrations}
            icon={<Plug className="h-5 w-5" />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Orders */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-gray-500" />
                Recent Orders
              </h2>
            </div>
            <div className="divide-y divide-gray-50">
              {ordersData?.data?.map((order) => (
                <div key={order.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {order.customer?.name ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {order.source ? platformLabel(order.source) : 'Manual'} · {formatDateTime(order.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(parseFloat(order.total))}</p>
                    <Badge status={order.status} className="mt-1" />
                  </div>
                </div>
              ))}
              {!ordersData?.data?.length && (
                <p className="px-5 py-8 text-center text-sm text-gray-400">No orders yet</p>
              )}
            </div>
          </div>

          {/* Connected Integrations */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Plug className="h-4 w-4 text-gray-500" />
                Connected Platforms
              </h2>
            </div>
            <div className="divide-y divide-gray-50">
              {integrations?.map((integration) => (
                <div key={integration.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm">
                      {integration.type === 'shopify' ? '🛍️' : integration.type === 'woocommerce' ? '🛒' : '⚙️'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{platformLabel(integration.type)}</p>
                      <p className="text-xs text-gray-400">
                        {integration.lastSyncAt
                          ? `Last sync: ${formatDateTime(integration.lastSyncAt)}`
                          : 'Never synced'}
                      </p>
                    </div>
                  </div>
                  <Badge status={integration.status} />
                </div>
              ))}
              {!integrations?.length && (
                <p className="px-5 py-8 text-center text-sm text-gray-400">
                  No integrations connected yet
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
