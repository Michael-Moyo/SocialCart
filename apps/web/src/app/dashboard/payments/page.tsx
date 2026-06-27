'use client';

import { useState } from 'react';
import { CheckCircle, Clock, XCircle, ExternalLink, Plus, Loader2, Copy, Check } from 'lucide-react';
import { usePaymentLinks, useCreatePaymentLink, type PaymentLink } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

const STATUS_CONFIG = {
  PAID: { label: 'Paid', icon: CheckCircle, color: 'text-green-400 bg-green-400/10' },
  PENDING: { label: 'Pending', icon: Clock, color: 'text-yellow-400 bg-yellow-400/10' },
  EXPIRED: { label: 'Expired', icon: XCircle, color: 'text-gray-500 bg-gray-500/10' },
  CANCELLED: { label: 'Cancelled', icon: XCircle, color: 'text-red-400 bg-red-400/10' },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1 rounded text-gray-500 hover:text-gray-300"
      title="Copy link"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function CreateLinkModal({ onClose }: { onClose: () => void }) {
  const { data: customers = [] } = useQuery({
    queryKey: ['customers-select'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Array<{ id: string; name: string; phone: string }> }>('/api/v1/customers?limit=200');
      return res.data.data;
    },
  });

  const { data: config } = useQuery({
    queryKey: ['payment-config'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { activeProvider: string } }>('/api/v1/payments/config');
      return res.data.data;
    },
  });

  const createLink = useCreatePaymentLink();
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [description, setDescription] = useState('');
  const [result, setResult] = useState<{ url: string; reference: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = await createLink.mutateAsync({
      customerId,
      amount: parseFloat(amount),
      currency,
      description,
    });
    setResult(data);
  }

  if (result) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="h-7 w-7 text-green-400" />
            </div>
            <h2 className="text-lg font-bold text-white">Payment Link Created</h2>
            <p className="text-gray-400 text-sm mt-1">Share this link with your customer via WhatsApp</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 mb-4">
            <p className="text-xs text-gray-500 mb-1">Payment URL</p>
            <div className="flex items-center gap-2">
              <p className="text-sm text-[#25D366] truncate flex-1">{result.url}</p>
              <CopyButton text={result.url} />
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 mb-6">
            <p className="text-xs text-gray-500 mb-1">Reference</p>
            <p className="text-sm text-white font-mono">{result.reference}</p>
          </div>
          <div className="flex gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Here is your payment link: ${result.url}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-[#1ea855] transition-colors"
            >
              Send via WhatsApp
            </a>
            <button onClick={onClose} className="px-4 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm hover:bg-gray-700">
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-md">
        <h2 className="text-lg font-bold text-white mb-1">Create Payment Link</h2>
        <p className="text-gray-400 text-sm mb-6">
          Provider: <span className="text-[#25D366] font-medium">{config?.activeProvider ?? '…'}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Customer</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-[#25D366]"
            >
              <option value="">Select customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Amount</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="5000"
                required
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-[#25D366]"
              />
            </div>
            <div className="w-24">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-[#25D366]"
              >
                {['NGN', 'KES', 'GHS', 'ZAR', 'USD'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Payment for Order #123"
              required
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-[#25D366]"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm hover:bg-gray-700 flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLink.isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-[#1ea855] disabled:opacity-50"
            >
              {createLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LinkRow({ link }: { link: PaymentLink }) {
  const cfg = STATUS_CONFIG[link.status] ?? STATUS_CONFIG.PENDING;
  const Icon = cfg.icon;
  const currencySymbol = link.currency === 'NGN' ? '₦' : link.currency === 'KES' ? 'KSh' : link.currency === 'ZAR' ? 'R' : '$';

  return (
    <tr className="hover:bg-gray-800/50 transition-colors">
      <td className="px-5 py-3">
        <p className="text-sm font-medium text-white">{link.customer.name}</p>
        <p className="text-xs text-gray-500">{link.customer.phone}</p>
      </td>
      <td className="px-5 py-3 text-sm font-semibold text-white">
        {currencySymbol}{Number(link.amount).toLocaleString()}
      </td>
      <td className="px-5 py-3">
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
          <Icon className="h-3 w-3" /> {cfg.label}
        </span>
      </td>
      <td className="px-5 py-3 text-xs text-gray-400">
        {link.paidAt ? new Date(link.paidAt).toLocaleDateString() : new Date(link.createdAt).toLocaleDateString()}
      </td>
      <td className="px-5 py-3">
        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded font-mono">{link.provider}</span>
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-1">
          <CopyButton text={link.url} />
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="p-1 rounded text-gray-500 hover:text-gray-300">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </td>
    </tr>
  );
}

export default function PaymentsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const { data: links = [], isLoading } = usePaymentLinks(statusFilter || undefined);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Payments</h1>
          <p className="text-gray-400 text-sm mt-1">Create and track payment links sent via WhatsApp</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#25D366] hover:bg-[#1ea855] text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
        >
          <Plus className="h-4 w-4" /> New Payment Link
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {[['', 'All'], ['PENDING', 'Pending'], ['PAID', 'Paid'], ['EXPIRED', 'Expired']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setStatusFilter(val ?? '')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === val
                ? 'bg-[#25D366] text-white'
                : 'bg-gray-900 text-gray-400 border border-gray-700 hover:border-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              {['Customer', 'Amount', 'Status', 'Date', 'Provider', 'Actions'].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(6)].map((__, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-gray-800 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : links.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-500 text-sm">
                  No payment links yet. Create one to get started.
                </td>
              </tr>
            ) : (
              links.map((l) => <LinkRow key={l.id} link={l} />)
            )}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateLinkModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
