'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useConversations, getMessageText, type ConversationSummary } from '@/lib/agent-api';

type Filter = 'all' | 'mine' | 'open' | 'bot';

const STATUS_COLOR: Record<string, string> = {
  OPEN: 'bg-blue-500',
  BOT: 'bg-[#25D366]',
  PENDING: 'bg-orange-400',
  RESOLVED: 'bg-gray-300',
};

const FILTER_LABELS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'mine', label: 'Mine' },
  { key: 'open', label: 'Open' },
  { key: 'bot', label: 'Bot' },
];

export default function AgentConversationsPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const { data: conversations = [], isLoading } = useConversations(filter);

  const filtered = search.trim()
    ? conversations.filter(
        (c) =>
          c.customer.name.toLowerCase().includes(search.toLowerCase()) ||
          c.customer.phone.includes(search)
      )
    : conversations;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="bg-[#075E54] pt-safe px-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-white text-xl font-bold">Conversations</h1>
          <div className="flex items-center gap-1 text-white opacity-80">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 13h2v2H9zm0-4h2v2H9zm4 0h2v2h-2zm0 4h2v2h-2zM1 3h22v18l-4-4H1V3zm2 2v11h15.17l1.83 1.83V5H3z" />
            </svg>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full pl-9 pr-4 py-2 bg-[#1a7e6e] text-white placeholder-[#a8d5c8] rounded-lg text-sm focus:outline-none"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-gray-100 bg-white">
        {FILTER_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
              filter === key
                ? 'text-[#075E54] border-b-2 border-[#25D366]'
                : 'text-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-0 divide-y divide-gray-50">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex gap-3 px-4 py-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-gray-100 shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <svg className="w-12 h-12 mb-2 opacity-30" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
            </svg>
            <p className="text-sm">No conversations</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((c) => (
              <ConversationRow key={c.id} conversation={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationRow({ conversation: c }: { conversation: ConversationSummary }) {
  const lastMsg = c.messages[0];
  const lastText = lastMsg ? getMessageText(lastMsg as never) : '';
  const isInbound = lastMsg?.direction === 'INBOUND';
  const initials = c.customer.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Link href={`/agent/conversation/${c.id}`} className="flex gap-3 px-4 py-3 active:bg-gray-50 transition-colors">
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="w-12 h-12 rounded-full bg-[#DFE5E7] flex items-center justify-center text-[#54656F] font-semibold text-sm">
          {initials || '?'}
        </div>
        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${STATUS_COLOR[c.status] ?? 'bg-gray-300'}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold text-sm text-[#111B21] truncate">{c.customer.name}</span>
          <span className="text-[11px] text-gray-400 shrink-0">
            {formatDistanceToNow(new Date(c.updatedAt), { addSuffix: false })}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {lastMsg && !isInbound && (
            <svg className="w-3.5 h-3.5 text-[#53BDEB] shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
            </svg>
          )}
          <p className="text-xs text-gray-500 truncate">
            {c.status === 'BOT' && !lastText ? '🤖 Bot handling' : lastText || c.customer.phone}
          </p>
        </div>
      </div>
    </Link>
  );
}
