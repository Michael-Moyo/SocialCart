'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useConversations, getMessageText } from '@/lib/agent-api';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const { data: all = [] } = useConversations('all');

  const results = query.trim()
    ? all.filter(
        (c) =>
          c.customer.name.toLowerCase().includes(query.toLowerCase()) ||
          c.customer.phone.includes(query) ||
          c.messages.some((m) => getMessageText(m as never).toLowerCase().includes(query.toLowerCase()))
      )
    : [];

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="bg-[#075E54] px-4 pt-safe pb-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, phone or message…"
            className="w-full pl-9 pr-4 py-2 bg-[#1a7e6e] text-white placeholder-[#a8d5c8] rounded-lg text-sm focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {query.trim() && results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-300">
            <p className="text-sm">No results for "{query}"</p>
          </div>
        ) : results.map((c) => {
          const lastMsg = c.messages[0];
          const text = lastMsg ? getMessageText(lastMsg as never) : '';
          return (
            <Link key={c.id} href={`/agent/conversation/${c.id}`} className="flex gap-3 px-4 py-3 active:bg-gray-50">
              <div className="w-10 h-10 rounded-full bg-[#DFE5E7] flex items-center justify-center text-[#54656F] font-semibold text-sm shrink-0">
                {c.customer.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{c.customer.name}</p>
                <p className="text-xs text-gray-400 truncate">{text || c.customer.phone}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
