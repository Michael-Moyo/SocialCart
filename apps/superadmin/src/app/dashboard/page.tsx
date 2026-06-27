'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Building2, Users, ShoppingCart, MessageSquare, TrendingUp, Clock } from 'lucide-react';
import axios from 'axios';

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001' });

api.interceptors.request.use((c) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('sa_token') : null;
  if (t) c.headers['Authorization'] = `Bearer ${t}`;
  return c;
});

interface RecentTenant { id: string; name: string; phone: string; plan: string; createdAt: string }
interface RecentOrder { id: string; total: number; currency: string; status: string; createdAt: string; tenant: { name: string }; customer: { name: string } }
interface Activity { recentTenants: RecentTenant[]; recentOrders: RecentOrder[] }

const PLAN_COLORS: Record<string, string> = {
  FREE: 'text-gray-400 bg-gray-800',
  STARTER: 'text-blue-400 bg-blue-900/30',
  PRO: 'text-purple-400 bg-purple-900/30',
  ENTERPRISE: 'text-green-400 bg-green-900/30',
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

interface Stats {
  totalTenants: number;
  activeTenants: number;
  totalCustomers: number;
  totalOrders: number;
  totalConversations: number;
  plans: Record<string, number>;
}

function StatCard({ label, value, sub, icon: Icon, accent = false }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-5 border ${accent ? 'bg-[#25D366]/10 border-[#25D366]/30' : 'bg-gray-900 border-gray-800'}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-400 font-medium">{label}</p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent ? 'bg-[#25D366]/20' : 'bg-gray-800'}`}>
          <Icon className={`h-4 w-4 ${accent ? 'text-[#25D366]' : 'text-gray-400'}`} />
        </div>
      </div>
      <p className="text-3xl font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();

  const { data: activity } = useQuery({
    queryKey: ['sa-activity'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Activity }>('/api/v1/superadmin/activity');
      return res.data.data;
    },
    refetchInterval: 30_000,
  });

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['sa-stats'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Stats }>('/api/v1/superadmin/stats');
      return res.data.data;
    },
  });

  useEffect(() => {
    if (error) router.replace('/login');
  }, [error, router]);

  const plans = stats?.plans ?? {};
  const planOrder = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
        <p className="text-gray-400 text-sm mt-1">Real-time stats across all SocialCart tenants</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total tenants" value={stats?.totalTenants ?? 0} sub={`${stats?.activeTenants ?? 0} active`} icon={Building2} accent />
        <StatCard label="Customers" value={stats?.totalCustomers ?? 0} icon={Users} />
        <StatCard label="Orders" value={stats?.totalOrders ?? 0} icon={ShoppingCart} />
        <StatCard label="Conversations" value={stats?.totalConversations ?? 0} icon={MessageSquare} />
      </div>

      {/* Activity + Plan breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Recent signups */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#25D366]" />
            Recent signups
          </h2>
          <div className="space-y-3">
            {(activity?.recentTenants ?? []).slice(0, 6).map((t) => (
              <div key={t.id} className="flex items-center justify-between">
                <Link href={`/dashboard/tenants/${t.id}`} className="flex items-center gap-2 group">
                  <div className="w-7 h-7 rounded-lg bg-gray-800 flex items-center justify-center">
                    <Building2 className="h-3.5 w-3.5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium group-hover:text-[#25D366] transition-colors leading-none">{t.name}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{t.phone}</p>
                  </div>
                </Link>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${PLAN_COLORS[t.plan] ?? PLAN_COLORS['FREE']}`}>{t.plan}</span>
                  <span className="text-xs text-gray-600">{timeAgo(t.createdAt)}</span>
                </div>
              </div>
            ))}
            {!activity?.recentTenants?.length && (
              <p className="text-sm text-gray-600 text-center py-4">No signups yet</p>
            )}
          </div>
        </div>

        {/* Recent orders */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-[#25D366]" />
            Recent orders
          </h2>
          <div className="space-y-3">
            {(activity?.recentOrders ?? []).slice(0, 6).map((o) => (
              <div key={o.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white font-medium leading-none">{o.customer.name}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{o.tenant.name}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm text-white font-semibold">
                    {o.currency} {Number(o.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-gray-600">{timeAgo(o.createdAt)}</p>
                </div>
              </div>
            ))}
            {!activity?.recentOrders?.length && (
              <p className="text-sm text-gray-600 text-center py-4">No orders yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Plan breakdown */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#25D366]" />
          Plan distribution
        </h2>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {planOrder.map((plan) => {
              const count = plans[plan] ?? 0;
              const total = stats?.totalTenants || 1;
              const pct = Math.round((count / total) * 100);
              const colors: Record<string, string> = {
                FREE: 'bg-gray-600', STARTER: 'bg-blue-500', PRO: 'bg-purple-500', ENTERPRISE: 'bg-[#25D366]',
              };
              return (
                <div key={plan}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300 font-medium">{plan}</span>
                    <span className="text-gray-400">{count} tenants ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${colors[plan]}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
