'use client';

import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, FunnelChart, Funnel, LabelList, Cell,
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, MessageSquare,
  Users, CreditCard, Package, ArrowUpRight,
} from 'lucide-react';
import {
  useAnalyticsOverview,
  useRevenueChart,
  useConversionFunnel,
  useTopProducts,
  usePaymentStats,
  type OverviewMetric,
} from '@/lib/api';

const PERIOD_OPTIONS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

const FUNNEL_COLORS = ['#25D366', '#1db954', '#17a348', '#128c3c', '#0d6631'];

function MetricCard({
  label,
  metric,
  icon: Icon,
  prefix = '',
  color,
}: {
  label: string;
  metric: OverviewMetric | undefined;
  icon: React.ElementType;
  prefix?: string;
  color: string;
}) {
  const isPositive = (metric?.change ?? 0) >= 0;
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {Math.abs(metric?.change ?? 0)}%
        </div>
      </div>
      <p className="text-2xl font-bold text-white">
        {metric ? `${prefix}${metric.value.toLocaleString()}` : '—'}
      </p>
      <p className="text-sm text-gray-400 mt-1">{label}</p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">{children}</h2>;
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const { data: overview } = useAnalyticsOverview(days);
  const { data: revenueChart = [] } = useRevenueChart(days);
  const { data: funnel = [] } = useConversionFunnel();
  const { data: topProducts = [] } = useTopProducts();
  const { data: paymentStats } = usePaymentStats();

  // Format revenue chart dates
  const chartData = revenueChart.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
  }));

  const maxRevenue = Math.max(...revenueChart.map((d) => d.revenue), 1);
  const topFunnelCount = funnel[0]?.count ?? 1;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-gray-400 text-sm mt-1">Performance overview for your store</p>
        </div>
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {PERIOD_OPTIONS.map(({ label, days: d }) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                days === d ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard label="Revenue" metric={overview?.revenue} icon={DollarSign} prefix="₦" color="bg-green-600" />
        <MetricCard label="Orders" metric={overview?.orders} icon={ShoppingCart} color="bg-blue-600" />
        <MetricCard label="Conversations" metric={overview?.conversations} icon={MessageSquare} color="bg-purple-600" />
        <MetricCard label="New Customers" metric={overview?.newCustomers} icon={Users} color="bg-orange-600" />
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Revenue chart — spans 2 cols */}
        <div className="col-span-2 bg-gray-900 rounded-2xl border border-gray-800 p-6">
          <SectionTitle>Revenue over time</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#25D366" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#25D366" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false}
                interval={Math.floor(chartData.length / 6)} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false}
                tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px', color: '#f9fafb' }}
                formatter={(v: number) => [`₦${v.toLocaleString()}`, 'Revenue']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#25D366" strokeWidth={2} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Payment stats */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
          <SectionTitle>Payment links</SectionTitle>
          {paymentStats ? (
            <>
              <div className="space-y-3 mb-5">
                {[
                  { label: 'Total sent', value: paymentStats.total, color: 'bg-gray-700' },
                  { label: 'Paid', value: paymentStats.paid, color: 'bg-green-600' },
                  { label: 'Pending', value: paymentStats.pending, color: 'bg-yellow-600' },
                  { label: 'Expired', value: paymentStats.expired, color: 'bg-red-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                      <span className="text-sm text-gray-400">{label}</span>
                    </div>
                    <span className="text-sm font-semibold text-white">{value}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-800 pt-4">
                <p className="text-xs text-gray-500 mb-1">Conversion rate</p>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold text-white">{paymentStats.conversionRate}%</span>
                  <span className="text-xs text-gray-500 mb-1">of links paid</span>
                </div>
                <div className="mt-2 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#25D366] rounded-full"
                    style={{ width: `${paymentStats.conversionRate}%` }}
                  />
                </div>
              </div>
              {Object.entries(paymentStats.revenueByProvider).length > 0 && (
                <div className="mt-4 space-y-1">
                  <p className="text-xs text-gray-500 mb-2">Revenue by provider</p>
                  {Object.entries(paymentStats.revenueByProvider).map(([p, v]) => (
                    <div key={p} className="flex justify-between text-xs">
                      <span className="text-gray-400">{p}</span>
                      <span className="text-white font-medium">₦{Number(v).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Conversion funnel */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
          <SectionTitle>Conversion funnel (30d)</SectionTitle>
          {funnel.length > 0 ? (
            <div className="space-y-2">
              {funnel.map((stage, i) => {
                const pct = topFunnelCount > 0 ? (stage.count / topFunnelCount) * 100 : 0;
                return (
                  <div key={stage.stage}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">{stage.stage}</span>
                      <span className="text-white font-medium">{stage.count.toLocaleString()}</span>
                    </div>
                    <div className="h-7 bg-gray-800 rounded-lg overflow-hidden">
                      <div
                        className="h-full rounded-lg flex items-center px-3 text-xs text-white font-medium transition-all"
                        style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: FUNNEL_COLORS[i] ?? '#25D366' }}
                      >
                        {pct.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-600 text-sm">No data yet</div>
          )}
        </div>

        {/* Top products */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
          <SectionTitle>Top products (30d)</SectionTitle>
          {topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.slice(0, 8).map((p, i) => {
                const maxRev = topProducts[0]?.revenue ?? 1;
                return (
                  <div key={p.sku} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300 truncate">{p.name}</span>
                        <span className="text-white font-medium ml-2 shrink-0">₦{p.revenue.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#25D366] rounded-full"
                          style={{ width: `${(p.revenue / maxRev) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">{p.units} sold</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-gray-600">
              <Package className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">No orders yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
