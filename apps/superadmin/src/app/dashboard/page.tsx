'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Building2, Users, ShoppingCart, MessageSquare, TrendingUp } from 'lucide-react';
import axios from 'axios';

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001' });

api.interceptors.request.use((c) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('sa_token') : null;
  if (t) c.headers['Authorization'] = `Bearer ${t}`;
  return c;
});

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
