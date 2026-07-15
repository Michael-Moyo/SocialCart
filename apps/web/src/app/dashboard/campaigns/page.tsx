'use client';

import { useState } from 'react';
import {
  Megaphone, Plus, Play, Pause, Trash2, Send, Users,
  Mail, ShoppingCart, Gift, RefreshCw, BarChart2,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import {
  useCampaigns, useCreateCampaign, useLaunchCampaign,
  usePauseCampaign, useDeleteCampaign, type Campaign,
} from '@/lib/api';
import { cn, formatDateTime } from '@/lib/utils';

const STATUS_FILTERS = ['all', 'DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED'];

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  BROADCAST:     { label: 'Broadcast',      icon: Send,         color: 'text-blue-600 bg-blue-50' },
  DRIP:          { label: 'Drip',           icon: Mail,         color: 'text-purple-600 bg-purple-50' },
  ABANDONED_CART:{ label: 'Abandoned Cart', icon: ShoppingCart, color: 'text-orange-600 bg-orange-50' },
  LOYALTY:       { label: 'Loyalty',        icon: Gift,         color: 'text-pink-600 bg-pink-50' },
  REORDER:       { label: 'Reorder',        icon: RefreshCw,    color: 'text-teal-600 bg-teal-50' },
};

const CAMPAIGN_TYPES = Object.keys(TYPE_META) as (keyof typeof TYPE_META)[];

function TypeBadge({ type }: { type: string }) {
  const meta = TYPE_META[type] ?? TYPE_META['BROADCAST']!;
  const Icon = meta.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', meta.color)}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function StatBar({
  stats,
}: {
  stats: Campaign['stats'];
}) {
  const total = stats.sent || 1;
  return (
    <div className="flex items-center gap-3 text-xs text-gray-500">
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
        {stats.sent} sent
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
        {stats.delivered} delivered ({total ? Math.round((stats.delivered / total) * 100) : 0}%)
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
        {stats.read} read
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
        {stats.replied} replied
      </span>
    </div>
  );
}

// ─── Create Campaign Modal ────────────────────────────────────────────────────

function CreateCampaignModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateCampaign();
  const [form, setForm] = useState({
    name: '',
    type: 'BROADCAST',
    message: '',
    scheduledAt: '',
    templateName: '',
  });
  const [error, setError] = useState('');

  function set(k: string, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function submit() {
    if (!form.name.trim() || !form.message.trim()) {
      setError('Name and message are required');
      return;
    }
    try {
      await create.mutateAsync({
        name: form.name,
        type: form.type,
        message: form.message,
        templateName: form.templateName || undefined,
        scheduledAt: form.scheduledAt || undefined,
      });
      setForm({ name: '', type: 'BROADCAST', message: '', scheduledAt: '', templateName: '' });
      setError('');
      onClose();
    } catch {
      setError('Failed to create campaign');
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]';

  return (
    <Modal open={open} onOpenChange={onClose} title="New Campaign" description="Set up a WhatsApp broadcast or automated campaign" maxWidth="lg">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Campaign name</label>
          <input className={inputCls} placeholder="e.g. Weekend Sale Blast" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
          <div className="grid grid-cols-3 gap-2">
            {CAMPAIGN_TYPES.map((t) => {
              const meta = TYPE_META[t]!;
              const Icon = meta.icon;
              return (
                <button
                  key={t}
                  onClick={() => set('type', t)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-medium transition-colors',
                    form.type === t
                      ? 'border-[#25D366] bg-green-50 text-[#128C7E]'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea
            rows={4}
            className={inputCls}
            placeholder="Hi {{name}}! 🎉 We have an exclusive offer just for you..."
            value={form.message}
            onChange={(e) => set('message', e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">Use {'{{name}}'} for customer name personalisation</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Template Name <span className="text-gray-400 font-normal">(optional)</span></label>
          <input className={inputCls} placeholder="e.g. weekend_sale_v2" value={form.templateName} onChange={(e) => set('templateName', e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Schedule for later <span className="text-gray-400 font-normal">(leave blank to save as draft)</span></label>
          <input type="datetime-local" className={inputCls} value={form.scheduledAt} onChange={(e) => set('scheduledAt', e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2 pt-2">
          <Button onClick={submit} loading={create.isPending} className="flex-1">
            Create campaign
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Campaign Card ────────────────────────────────────────────────────────────

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const launch = useLaunchCampaign();
  const pause = usePauseCampaign();
  const del = useDeleteCampaign();

  const canLaunch = ['DRAFT', 'SCHEDULED', 'PAUSED'].includes(campaign.status);
  const canPause = campaign.status === 'RUNNING';
  const canDelete = !['RUNNING', 'COMPLETED'].includes(campaign.status);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold text-gray-900 truncate">{campaign.name}</h3>
            <TypeBadge type={campaign.type} />
          </div>
          <p className="text-sm text-gray-500 line-clamp-2">{campaign.message}</p>
        </div>
        <Badge status={campaign.status} />
      </div>

      {/* Stats */}
      {campaign.status !== 'DRAFT' && <StatBar stats={campaign.stats} />}

      {/* Schedule */}
      {campaign.scheduledAt && (
        <p className="text-xs text-gray-400">
          Scheduled: {formatDateTime(campaign.scheduledAt)}
        </p>
      )}
      {campaign.sentAt && (
        <p className="text-xs text-gray-400">
          Sent: {formatDateTime(campaign.sentAt)}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
        {canLaunch && (
          <Button size="sm" onClick={() => launch.mutate(campaign.id)} loading={launch.isPending}>
            <Play className="h-3.5 w-3.5" />
            {campaign.status === 'PAUSED' ? 'Resume' : 'Launch'}
          </Button>
        )}
        {canPause && (
          <Button size="sm" variant="secondary" onClick={() => pause.mutate(campaign.id)} loading={pause.isPending}>
            <Pause className="h-3.5 w-3.5" />
            Pause
          </Button>
        )}
        {canDelete && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={() => {
              if (confirm('Delete this campaign?')) del.mutate(campaign.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
        {campaign.status === 'COMPLETED' && (
          <div className="ml-auto flex items-center gap-1 text-xs text-gray-400">
            <BarChart2 className="h-3.5 w-3.5" />
            Completed
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useCampaigns({ page, limit: 12, status });
  const campaigns = data?.data ?? [];

  const totalSent = campaigns.reduce((s, c) => s + (c.stats?.sent ?? 0), 0);
  const totalDelivered = campaigns.reduce((s, c) => s + (c.stats?.delivered ?? 0), 0);
  const totalRead = campaigns.reduce((s, c) => s + (c.stats?.read ?? 0), 0);

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="Campaigns" description="Broadcast messages and automated WhatsApp campaigns" />

      <div className="p-6 space-y-6">
        {/* Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total campaigns', value: data?.meta?.total ?? 0, icon: Megaphone },
            { label: 'Messages sent', value: totalSent.toLocaleString(), icon: Send },
            { label: 'Delivered', value: totalDelivered.toLocaleString(), icon: Users },
            { label: 'Read', value: totalRead.toLocaleString(), icon: BarChart2 },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center text-[#25D366]">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-xl font-bold text-gray-900">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => { setStatus(s); setPage(1); }}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors',
                  status === s
                    ? 'bg-[#25D366] text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-[#25D366]/50'
                )}
              >
                {s === 'all' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' ')}
              </button>
            ))}
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            New campaign
          </Button>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 h-48 animate-pulse" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Megaphone className="h-7 w-7 opacity-50" />
            </div>
            <p className="text-sm font-medium">No campaigns yet</p>
            <p className="text-xs mt-1 text-center max-w-xs">
              Create your first broadcast to reach all your WhatsApp customers at once
            </p>
            <Button className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              Create campaign
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {campaigns.map((c) => <CampaignCard key={c.id} campaign={c} />)}
          </div>
        )}

        {/* Pagination */}
        {data?.meta && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-gray-500">
              Page {page} of {data.meta.totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      <CreateCampaignModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
