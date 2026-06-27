'use client';

import Link from 'next/link';
import {
  ShoppingCart, Users, TrendingUp, Plug, MessageSquare,
  ArrowRight, Rocket, CheckCircle2, Circle, BarChart2,
  CreditCard, Zap,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { StatCard } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOrders, useCustomers, useIntegrations, useAnalyticsOverview } from '@/lib/api';
import { formatCurrency, formatDateTime, platformLabel } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useSSE } from '@/lib/use-sse';

interface OnboardingStatus {
  steps: Record<string, boolean>;
  completed: number;
  total: number;
  pct: number;
}

// ─── Onboarding Banner ────────────────────────────────────────────────────────

const STEP_LABELS: Record<string, string> = {
  profile: 'Profile',
  whatsapp: 'WhatsApp',
  integration: 'Store',
  products: 'Products',
  payments: 'Payments',
  team: 'Team',
};

function OnboardingBanner() {
  const { data } = useQuery<OnboardingStatus>({
    queryKey: ['onboarding'],
    queryFn: async () => {
      const res = await api.get<{ data: OnboardingStatus }>('/settings/onboarding');
      return res.data.data;
    },
  });

  if (!data || data.pct === 100) return null;

  return (
    <div className="bg-gradient-to-r from-[#25D366] to-[#128C7E] rounded-xl p-5 text-white">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Rocket className="h-4 w-4" />
            <span className="text-sm font-semibold">Set up SocialCart</span>
          </div>
          <p className="text-green-100 text-xs mb-3">
            Complete setup to start accepting WhatsApp orders. {data.completed} of {data.total} steps done.
          </p>

          {/* Mini step indicators */}
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(data.steps).map(([key, done]) => (
              <span
                key={key}
                className={cn(
                  'flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
                  done ? 'bg-white/20 text-white' : 'bg-white/10 text-green-200'
                )}
              >
                {done ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                {STEP_LABELS[key] ?? key}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {/* Progress ring */}
          <div className="w-14 h-14 relative">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke="white" strokeWidth="3"
                strokeDasharray={`${data.pct} ${100 - data.pct}`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{data.pct}%</span>
          </div>
          <Link
            href="/dashboard/onboarding"
            className="flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 transition-colors text-white rounded-lg px-3 py-1.5 font-medium"
          >
            Continue <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const qc = useQueryClient();
  const { data: ordersData } = useOrders({ limit: 5 });
  const { data: customersData } = useCustomers({ limit: 5 });
  const { data: integrations } = useIntegrations();
  const { data: analytics } = useAnalyticsOverview(7);

  useSSE({
    'order:created': () => {
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['analytics-overview'] });
    },
    'notification': () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const totalRevenue = analytics?.revenue?.value ?? ordersData?.data?.reduce((sum, o) => sum + parseFloat(o.total), 0) ?? 0;
  const totalOrders = analytics?.orders?.value ?? ordersData?.meta?.total ?? 0;
  const totalCustomers = analytics?.newCustomers?.value ?? customersData?.meta?.total ?? 0;
  const activeIntegrations = integrations?.filter((i) => i.status === 'ACTIVE').length ?? 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <Header
        title="Dashboard"
        description="Welcome back. Here's what's happening with your store."
      />

      <div className="p-6 space-y-6">
        {/* Onboarding banner — hidden once complete */}
        <OnboardingBanner />

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Orders (7d)"
            value={totalOrders.toLocaleString()}
            icon={<ShoppingCart className="h-5 w-5" />}
            change={analytics?.orders?.change}
          />
          <StatCard
            title="Revenue (7d)"
            value={formatCurrency(totalRevenue)}
            icon={<TrendingUp className="h-5 w-5" />}
            change={analytics?.revenue?.change}
          />
          <StatCard
            title="New Customers"
            value={totalCustomers.toLocaleString()}
            icon={<Users className="h-5 w-5" />}
            change={analytics?.newCustomers?.change}
          />
          <StatCard
            title="Conversations"
            value={analytics?.conversations?.value?.toLocaleString() ?? activeIntegrations.toString()}
            icon={analytics?.conversations ? <MessageSquare className="h-5 w-5" /> : <Plug className="h-5 w-5" />}
            change={analytics?.conversations?.change}
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
              <Link href="/dashboard/orders" className="text-xs text-[#25D366] hover:underline flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
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

          {/* Quick links */}
          <div className="space-y-3">
            {/* Connected Integrations */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Plug className="h-4 w-4 text-gray-500" />
                  Connected Platforms
                </h2>
                <Link href="/dashboard/integrations" className="text-xs text-[#25D366] hover:underline flex items-center gap-1">
                  Manage <ArrowRight className="h-3 w-3" />
                </Link>
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
                  <p className="px-5 py-6 text-center text-sm text-gray-400">
                    No integrations connected yet
                  </p>
                )}
              </div>
            </div>

            {/* Quick action tiles */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: '/dashboard/conversations', icon: MessageSquare, label: 'Conversations', color: 'bg-green-50 text-green-600' },
                { href: '/dashboard/analytics', icon: BarChart2, label: 'Analytics', color: 'bg-blue-50 text-blue-600' },
                { href: '/dashboard/payments', icon: CreditCard, label: 'Payments', color: 'bg-purple-50 text-purple-600' },
                { href: '/dashboard/campaigns', icon: Zap, label: 'Campaigns', color: 'bg-orange-50 text-orange-600' },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:shadow-sm hover:border-gray-300 transition-all group"
                >
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', item.color)}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
