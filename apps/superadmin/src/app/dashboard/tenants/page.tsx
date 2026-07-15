'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, CheckCircle, XCircle, ChevronUp, ChevronDown, Zap } from 'lucide-react';
import axios from 'axios';

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001' });
api.interceptors.request.use((c) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('sa_token') : null;
  if (t) c.headers['Authorization'] = `Bearer ${t}`;
  return c;
});

interface Tenant {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  plan: string;
  isActive: boolean;
  createdAt: string;
  _count: { customers: number; orders: number; conversations: number; teamMembers: number };
}

const PLANS = ['all', 'FREE', 'STARTER', 'PRO', 'ENTERPRISE'];
const PLAN_COLORS: Record<string, string> = {
  FREE: 'text-gray-400 bg-gray-800',
  STARTER: 'text-blue-400 bg-blue-900/30',
  PRO: 'text-purple-400 bg-purple-900/30',
  ENTERPRISE: 'text-green-400 bg-green-900/30',
};

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${PLAN_COLORS[plan] ?? PLAN_COLORS['FREE']}`}>
      {plan}
    </span>
  );
}

export default function TenantsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState('all');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['sa-tenants', { search, plan, page }],
    queryFn: async () => {
      const res = await api.get<{
        success: boolean;
        data: Tenant[];
        meta: { total: number; page: number; totalPages: number };
      }>('/api/v1/superadmin/tenants', { params: { search: search || undefined, plan, page, limit: 20 } });
      return res.data;
    },
  });

  const updateTenant = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Tenant> & { id: string }) => {
      const res = await api.patch(`/api/v1/superadmin/tenants/${id}`, patch);
      return res.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['sa-tenants'] }),
  });

  const impersonate = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<{ success: boolean; data: { token: string; tenant: { name: string } } }>(
        `/api/v1/superadmin/tenants/${id}/impersonate`
      );
      return res.data.data;
    },
    onSuccess: ({ token, tenant }) => {
      // Open the tenant dashboard in a new tab with the impersonation token
      const url = `${process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'}/dashboard?impersonate=${token}`;
      window.open(url, '_blank');
      alert(`Impersonating ${tenant.name} — token copied to new tab`);
    },
  });

  const tenants = data?.data ?? [];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Tenants</h1>
        <p className="text-gray-400 text-sm mt-1">{data?.meta.total ?? 0} total stores on SocialCart</p>
      </div>

      {/* Toolbar */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, phone, email…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#25D366]"
          />
        </div>
        <div className="flex gap-1.5">
          {PLANS.map((p) => (
            <button
              key={p}
              onClick={() => { setPlan(p); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                plan === p ? 'bg-[#25D366] text-white' : 'bg-gray-900 text-gray-400 border border-gray-700 hover:border-gray-500'
              }`}
            >
              {p === 'all' ? 'All plans' : p}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              {['Store', 'Plan', 'Customers', 'Orders', 'Convos', 'Team', 'Status', 'Actions'].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(8)].map((__, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-gray-800 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : tenants.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-gray-500">No tenants found</td>
              </tr>
            ) : (
              tenants.map((t) => (
                <tr key={t.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/tenants/${t.id}`} className="group block">
                      <p className="text-sm font-semibold text-white group-hover:text-[#25D366] transition-colors">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.email ?? t.phone}</p>
                    </Link>
                  </td>
                  <td className="px-5 py-3"><PlanBadge plan={t.plan} /></td>
                  <td className="px-5 py-3 text-sm text-gray-300">{t._count.customers}</td>
                  <td className="px-5 py-3 text-sm text-gray-300">{t._count.orders}</td>
                  <td className="px-5 py-3 text-sm text-gray-300">{t._count.conversations}</td>
                  <td className="px-5 py-3 text-sm text-gray-300">{t._count.teamMembers}</td>
                  <td className="px-5 py-3">
                    {t.isActive ? (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <CheckCircle className="h-3.5 w-3.5" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <XCircle className="h-3.5 w-3.5" /> Suspended
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      {/* Upgrade/downgrade plan */}
                      <div className="flex gap-0.5">
                        <button
                          title="Upgrade plan"
                          onClick={() => {
                            const order = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];
                            const idx = order.indexOf(t.plan);
                            if (idx < order.length - 1) updateTenant.mutate({ id: t.id, plan: order[idx + 1] as never });
                          }}
                          className="p-1 rounded text-gray-500 hover:text-green-400 hover:bg-gray-700"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          title="Downgrade plan"
                          onClick={() => {
                            const order = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];
                            const idx = order.indexOf(t.plan);
                            if (idx > 0) updateTenant.mutate({ id: t.id, plan: order[idx - 1] as never });
                          }}
                          className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-gray-700"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {/* Suspend/activate */}
                      <button
                        title={t.isActive ? 'Suspend tenant' : 'Activate tenant'}
                        onClick={() => updateTenant.mutate({ id: t.id, isActive: !t.isActive })}
                        className={`p-1 rounded hover:bg-gray-700 ${t.isActive ? 'text-gray-500 hover:text-red-400' : 'text-gray-500 hover:text-green-400'}`}
                      >
                        {t.isActive ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                      </button>
                      {/* Impersonate */}
                      <button
                        title="Impersonate (open dashboard)"
                        onClick={() => impersonate.mutate(t.id)}
                        className="p-1 rounded text-gray-500 hover:text-[#25D366] hover:bg-gray-700"
                      >
                        <Zap className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Page {page} of {data.meta.totalPages}</p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 text-sm bg-gray-900 border border-gray-700 rounded-lg text-gray-300 hover:border-gray-500 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={page >= data.meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 text-sm bg-gray-900 border border-gray-700 rounded-lg text-gray-300 hover:border-gray-500 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
