'use client';

import { useState } from 'react';
import { Gift, Star, Award, TrendingUp, Plus, ChevronDown, ChevronUp, History } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useLoyaltyAccounts, useLoyaltyStats, useAwardPoints, type LoyaltyAccount } from '@/lib/api';
import { cn, formatPhone, formatDateTime } from '@/lib/utils';

const TIER_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  BRONZE:   { label: 'Bronze',   color: 'text-orange-700',  bg: 'bg-orange-100',  icon: '🥉' },
  SILVER:   { label: 'Silver',   color: 'text-gray-600',    bg: 'bg-gray-100',    icon: '🥈' },
  GOLD:     { label: 'Gold',     color: 'text-yellow-700',  bg: 'bg-yellow-100',  icon: '🥇' },
  PLATINUM: { label: 'Platinum', color: 'text-purple-700',  bg: 'bg-purple-100',  icon: '💎' },
};

const TIER_FILTERS = ['all', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

function TierBadge({ tier }: { tier: string }) {
  const meta = TIER_META[tier] ?? TIER_META['BRONZE']!;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold', meta.color, meta.bg)}>
      {meta.icon} {meta.label}
    </span>
  );
}

function ProgressBar({ points, next, threshold }: { points: number; next: string; threshold: number }) {
  const prev = threshold - (next === 'SILVER' ? 500 : next === 'GOLD' ? 1500 : next === 'PLATINUM' ? 3000 : threshold);
  const pct = threshold > 0 ? Math.min(100, Math.round(((points - prev) / (threshold - prev)) * 100)) : 100;
  return (
    <div>
      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
        <span>{points} pts</span>
        <span>{threshold} pts for {TIER_META[next]?.label ?? next}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#25D366] rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Award Points Modal ───────────────────────────────────────────────────────

function AwardModal({
  account,
  onClose,
}: {
  account: LoyaltyAccount;
  onClose: () => void;
}) {
  const award = useAwardPoints();
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  async function submit() {
    const p = parseInt(points, 10);
    if (!p || p <= 0) { setError('Enter a valid number of points'); return; }
    if (!reason.trim()) { setError('Reason is required'); return; }
    try {
      await award.mutateAsync({ customerId: account.customerId, points: p, reason });
      onClose();
    } catch {
      setError('Failed to award points');
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]';

  return (
    <Modal
      open
      onOpenChange={onClose}
      title={`Award points — ${account.customer.name}`}
      description={`Current balance: ${account.points} pts · ${TIER_META[account.tier]?.label} tier`}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Points to award</label>
          <input
            type="number"
            min="1"
            className={inputCls}
            placeholder="e.g. 100"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
          <input
            className={inputCls}
            placeholder="e.g. Purchase reward, referral bonus..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Button onClick={submit} loading={award.isPending} className="flex-1">Award points</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Account Row ──────────────────────────────────────────────────────────────

function AccountRow({
  account,
  onAward,
}: {
  account: LoyaltyAccount;
  onAward: (a: LoyaltyAccount) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = TIER_META[account.tier] ?? TIER_META['BRONZE']!;

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-5 py-3">
          <div className="flex items-center gap-3">
            <div
              className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold', meta.bg, meta.color)}
            >
              {(account.customer.name || account.customer.phone)[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{account.customer.name}</p>
              <p className="text-xs text-gray-400">{formatPhone(account.customer.phone)}</p>
            </div>
          </div>
        </td>
        <td className="px-5 py-3">
          <TierBadge tier={account.tier} />
        </td>
        <td className="px-5 py-3">
          <span className="text-sm font-bold text-gray-900">{account.points.toLocaleString()}</span>
          <span className="text-xs text-gray-400 ml-1">pts</span>
        </td>
        <td className="px-5 py-3 text-sm text-gray-500">
          {account.customer.totalOrders} orders
        </td>
        <td className="px-5 py-3">
          {account.pointsToNextTier != null && account.pointsToNextTier > 0 && account.nextTier && (
            <ProgressBar
              points={account.points}
              next={account.nextTier}
              threshold={account.points + account.pointsToNextTier}
            />
          )}
          {account.tier === 'PLATINUM' && (
            <span className="text-xs text-purple-600 font-medium">💎 Max tier</span>
          )}
        </td>
        <td className="px-5 py-3">
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => onAward(account)}>
              <Plus className="h-3.5 w-3.5" />
              Award
            </Button>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded history */}
      {expanded && account.history.length > 0 && (
        <tr>
          <td colSpan={6} className="px-5 pb-3">
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                <History className="h-3 w-3" /> Point history
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {[...account.history].reverse().map((h, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={h.points > 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                        {h.points > 0 ? '+' : ''}{h.points} pts
                      </span>
                      <span className="text-gray-500">{h.reason}</span>
                    </div>
                    <div className="text-right text-gray-400">
                      <span className="mr-3">Balance: {h.balance}</span>
                      <span>{formatDateTime(h.date)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LoyaltyPage() {
  const [tier, setTier] = useState('all');
  const [page, setPage] = useState(1);
  const [awardTarget, setAwardTarget] = useState<LoyaltyAccount | null>(null);

  const { data, isLoading } = useLoyaltyAccounts({ page, limit: 20, tier });
  const { data: stats } = useLoyaltyStats();

  const accounts = data?.data ?? [];
  const thresholds = stats?.thresholds ?? { BRONZE: 0, SILVER: 500, GOLD: 2000, PLATINUM: 5000 };

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="Loyalty Program" description="Track points, tiers, and reward your best customers" />

      <div className="p-6 space-y-6">
        {/* Tier stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const).map((t) => {
            const meta = TIER_META[t]!;
            const s = stats?.tiers[t];
            return (
              <div key={t} className={cn('rounded-xl border border-gray-200 shadow-sm p-4', meta.bg)}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg">{meta.icon}</span>
                  <Award className={cn('h-4 w-4', meta.color)} />
                </div>
                <p className={cn('text-xs font-semibold', meta.color)}>{meta.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{s?.count ?? 0}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {(s?.totalPoints ?? 0).toLocaleString()} total pts · from {thresholds[t]} pts
                </p>
              </div>
            );
          })}
        </div>

        {/* Summary bar */}
        <div className="bg-gradient-to-r from-[#25D366]/10 to-emerald-50 rounded-xl p-4 border border-[#25D366]/20 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center">
            <Star className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">{stats?.totalMembers ?? 0} loyalty members</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Total points in circulation:{' '}
              {Object.values(stats?.tiers ?? {}).reduce((s, t) => s + t.totalPoints, 0).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-[#128C7E] font-medium">
            <TrendingUp className="h-3.5 w-3.5" />
            Active programme
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 flex-wrap">
          {TIER_FILTERS.map((t) => {
            const meta = t !== 'all' ? TIER_META[t] : null;
            return (
              <button
                key={t}
                onClick={() => { setTier(t); setPage(1); }}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors flex items-center gap-1',
                  tier === t
                    ? 'bg-[#25D366] text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-[#25D366]/50'
                )}
              >
                {meta && <span>{meta.icon}</span>}
                {t === 'all' ? 'All members' : meta?.label}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Customer', 'Tier', 'Points', 'Orders', 'Progress to next tier', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((__, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <Gift className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No loyalty members yet</p>
                    <p className="text-xs text-gray-300 mt-1">Points are awarded automatically when customers place orders</p>
                  </td>
                </tr>
              ) : (
                accounts.map((a) => (
                  <AccountRow key={a.id} account={a} onAward={setAwardTarget} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data?.meta && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {data.meta.total} members · Page {page} of {data.meta.totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {awardTarget && <AwardModal account={awardTarget} onClose={() => setAwardTarget(null)} />}
    </div>
  );
}
