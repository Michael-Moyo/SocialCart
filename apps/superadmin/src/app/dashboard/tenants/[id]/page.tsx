'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Building2, Users, ShoppingCart, MessageSquare,
  CheckCircle, XCircle, Zap, ExternalLink, ChevronUp, ChevronDown, Loader2,
} from 'lucide-react';
import axios from 'axios';

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001' });
api.interceptors.request.use((c) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('sa_token') : null;
  if (t) c.headers['Authorization'] = `Bearer ${t}`;
  return c;
});

interface TenantDetail {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  plan: string;
  isActive: boolean;
  whatsappBusinessId: string | null;
  whatsappPhoneNumberId: string | null;
  createdAt: string;
  _count: { customers: number; orders: number; conversations: number; teamMembers: number; integrations: number };
}

const PLAN_ORDER = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'] as const;
const PLAN_COLORS: Record<string, string> = {
  FREE: 'text-gray-400 bg-gray-800 border-gray-700',
  STARTER: 'text-blue-400 bg-blue-900/30 border-blue-800',
  PRO: 'text-purple-400 bg-purple-900/30 border-purple-800',
  ENTERPRISE: 'text-green-400 bg-green-900/30 border-green-800',
};

function StatTile({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-gray-400" />
      </div>
      <div>
        <p className="text-xl font-bold text-white">{value.toLocaleString()}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: tenant, isLoading } = useQuery<TenantDetail>({
    queryKey: ['sa-tenant', id],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: TenantDetail }>(`/api/v1/superadmin/tenants/${id}`);
      return res.data.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (patch: { plan?: string; isActive?: boolean }) => {
      const res = await api.patch(`/api/v1/superadmin/tenants/${id}`, patch);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sa-tenant', id] });
      void qc.invalidateQueries({ queryKey: ['sa-tenants'] });
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ success: boolean; data: { token: string; tenant: { name: string } } }>(
        `/api/v1/superadmin/tenants/${id}/impersonate`
      );
      return res.data.data;
    },
    onSuccess: ({ token }) => {
      const url = `${process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'}/dashboard?impersonate=${token}`;
      window.open(url, '_blank');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>Tenant not found.</p>
        <button onClick={() => router.back()} className="mt-2 text-sm text-[#25D366] hover:underline">Go back</button>
      </div>
    );
  }

  const planIdx = PLAN_ORDER.indexOf(tenant.plan as typeof PLAN_ORDER[number]);

  return (
    <div className="p-8 max-w-4xl">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All tenants
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center">
            <Building2 className="h-7 w-7 text-gray-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{tenant.name}</h1>
            <p className="text-gray-400 text-sm mt-0.5">{tenant.email ?? tenant.phone}</p>
            <p className="text-gray-600 text-xs mt-0.5">
              Joined {new Date(tenant.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Impersonate */}
          <button
            onClick={() => impersonateMutation.mutate()}
            disabled={impersonateMutation.isPending}
            className="flex items-center gap-2 px-3 py-2 bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] rounded-xl text-sm font-medium hover:bg-[#25D366]/20 transition-colors disabled:opacity-50"
          >
            <Zap className="h-4 w-4" />
            Impersonate
            <ExternalLink className="h-3 w-3" />
          </button>

          {/* Suspend / activate */}
          <button
            onClick={() => updateMutation.mutate({ isActive: !tenant.isActive })}
            disabled={updateMutation.isPending}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50 ${
              tenant.isActive
                ? 'bg-red-900/20 border-red-800 text-red-400 hover:bg-red-900/40'
                : 'bg-green-900/20 border-green-800 text-green-400 hover:bg-green-900/40'
            }`}
          >
            {tenant.isActive ? <><XCircle className="h-4 w-4" /> Suspend</> : <><CheckCircle className="h-4 w-4" /> Activate</>}
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        <StatTile icon={Users} label="Customers" value={tenant._count.customers} />
        <StatTile icon={ShoppingCart} label="Orders" value={tenant._count.orders} />
        <StatTile icon={MessageSquare} label="Conversations" value={tenant._count.conversations} />
        <StatTile icon={Users} label="Team members" value={tenant._count.teamMembers} />
        <StatTile icon={Building2} label="Integrations" value={tenant._count.integrations} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Plan management */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white mb-4">Plan</h2>
          <div className="space-y-2">
            {PLAN_ORDER.map((p, i) => (
              <div
                key={p}
                className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                  tenant.plan === p
                    ? PLAN_COLORS[p]
                    : 'border-gray-800 text-gray-600'
                }`}
              >
                <span className={`text-sm font-semibold ${tenant.plan === p ? '' : 'text-gray-600'}`}>{p}</span>
                {tenant.plan === p ? (
                  <span className="text-xs opacity-70">Current</span>
                ) : (
                  <button
                    onClick={() => updateMutation.mutate({ plan: p })}
                    disabled={updateMutation.isPending}
                    className="text-xs px-2 py-0.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-40"
                  >
                    {i > planIdx ? 'Upgrade' : 'Downgrade'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* WhatsApp / connection info */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white mb-4">WhatsApp Connection</h2>
          <div className="space-y-3">
            {[
              { label: 'Phone', value: tenant.phone },
              { label: 'Business ID', value: tenant.whatsappBusinessId ?? '—' },
              { label: 'Phone Number ID', value: tenant.whatsappPhoneNumberId ?? '—' },
              { label: 'Status', value: tenant.isActive ? 'Active' : 'Suspended' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <span className="text-sm text-gray-500">{label}</span>
                <span className={`text-sm font-medium ${
                  value === 'Active' ? 'text-green-400' :
                  value === 'Suspended' ? 'text-red-400' :
                  value === '—' ? 'text-gray-600' : 'text-gray-300'
                }`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
