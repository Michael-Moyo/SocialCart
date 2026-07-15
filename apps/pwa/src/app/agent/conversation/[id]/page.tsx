'use client';

import { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  useConversation,
  useReply,
  useResolve,
  useTakeOver,
  useAgentSSE,
  useCustomerOrders,
  getMessageText,
  getAgentProfile,
  type Message,
} from '@/lib/agent-api';

interface PageProps {
  params: { id: string };
}

const STATUS_LABEL: Record<string, string> = {
  BOT: '🤖 Bot',
  OPEN: '💬 Open',
  PENDING: '⏳ Pending',
  RESOLVED: '✓ Resolved',
};

function MessageBubble({ msg }: { msg: Message }) {
  const isOut = msg.direction === 'OUTBOUND';
  const text = getMessageText(msg);
  const timeStr = msg.sentAt ? format(new Date(msg.sentAt), 'HH:mm') : format(new Date(msg.createdAt), 'HH:mm');

  // Interactive content (bot messages)
  const interactive = msg.content['interactive'] as Record<string, unknown> | undefined;
  const buttons = msg.content['buttons'] as Array<{ id: string; title: string }> | undefined;
  const listRows = msg.content['listRows'] as Array<{ id: string; title: string; description?: string }> | undefined;

  return (
    <div className={`flex ${isOut ? 'justify-end' : 'justify-start'} px-3 mb-1`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm relative ${
          isOut ? 'bg-[#DCF8C6] rounded-tr-sm' : 'bg-white rounded-tl-sm'
        }`}
      >
        {text && <p className="text-sm text-[#111B21] whitespace-pre-wrap leading-relaxed">{text}</p>}

        {buttons && buttons.map((b) => (
          <div key={b.id} className="mt-1 border border-[#25D366] rounded-lg px-3 py-1.5 text-center text-xs text-[#25D366]">
            {b.title}
          </div>
        ))}

        {listRows && listRows.map((r) => (
          <div key={r.id} className="mt-1 border border-gray-200 rounded-lg px-3 py-2">
            <div className="text-xs font-medium text-[#111B21]">{r.title}</div>
            {r.description && <div className="text-[11px] text-gray-400 mt-0.5">{r.description}</div>}
          </div>
        ))}

        <div className={`flex items-center gap-1 justify-end mt-1 ${isOut ? '' : 'opacity-60'}`}>
          <span className="text-[10px] text-gray-400">{timeStr}</span>
          {isOut && (
            <svg
              className={`w-3.5 h-3.5 ${msg.status === 'READ' ? 'text-[#53BDEB]' : 'text-gray-400'}`}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              {msg.status === 'SENT' ? (
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              ) : (
                <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
              )}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center justify-center my-3 px-4">
      <span className="bg-[#E1F2FB] text-[#54656F] text-[11px] font-medium px-3 py-1 rounded-full shadow-sm">
        {format(new Date(date), 'MMMM d, yyyy')}
      </span>
    </div>
  );
}

export default function ConversationPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = params;
  const [text, setText] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const { data: convo, isLoading } = useConversation(id);
  const reply = useReply(id);
  const resolve = useResolve(id);
  const takeOver = useTakeOver(id);
  useAgentSSE(id);
  const { data: customerOrders = [] } = useCustomerOrders(showInfo ? convo?.customer.id : undefined);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const profile = getAgentProfile();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [convo?.messages.length]);

  async function handleSend() {
    const t = text.trim();
    if (!t || reply.isPending) return;
    setText('');
    await reply.mutateAsync(t);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Group messages by day
  const groups = convo?.messages.reduce<{ date: string; msgs: Message[] }[]>((acc, msg) => {
    const d = format(new Date(msg.createdAt), 'yyyy-MM-dd');
    const last = acc[acc.length - 1];
    if (last && last.date === d) { last.msgs.push(msg); } else { acc.push({ date: d, msgs: [msg] }); }
    return acc;
  }, []) ?? [];

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-[#ECE5DD]">
        <div className="bg-[#075E54] h-16 animate-pulse" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!convo) return null;

  const isResolved = convo.status === 'RESOLVED';
  const isBot = convo.status === 'BOT';

  return (
    <div className="flex flex-col h-full bg-[#ECE5DD]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c0c0c0' fill-opacity='0.07'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}>
      {/* Header */}
      <div className="bg-[#075E54] flex items-center gap-3 px-3 py-2.5 shadow-md">
        <button onClick={() => router.back()} className="text-white p-1 -ml-1 active:opacity-70">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>

        <button onClick={() => setShowInfo((v) => !v)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left active:opacity-80">
          <div className="w-9 h-9 rounded-full bg-[#DFE5E7] flex items-center justify-center text-[#54656F] font-semibold text-sm shrink-0">
            {convo.customer.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight truncate">{convo.customer.name}</p>
            <p className="text-[#25D366] text-[11px] leading-tight">{STATUS_LABEL[convo.status] ?? convo.status}</p>
          </div>
        </button>

        <div className="flex items-center gap-2 text-white">
          {/* Take over / resolve actions */}
          {isBot && (
            <button
              onClick={() => takeOver.mutate(profile?.id ?? '')}
              disabled={takeOver.isPending}
              className="text-[10px] font-semibold bg-[#25D366] px-2.5 py-1.5 rounded-full active:opacity-70"
            >
              Take over
            </button>
          )}
          {!isResolved && !isBot && (
            <button
              onClick={() => resolve.mutate()}
              disabled={resolve.isPending}
              className="text-[10px] font-semibold bg-white/20 px-2.5 py-1.5 rounded-full active:opacity-70"
            >
              Resolve
            </button>
          )}
          {isResolved && (
            <span className="text-[10px] text-[#25D366] font-semibold">✓ Resolved</span>
          )}
        </div>
      </div>

      {/* Customer info drawer */}
      {showInfo && (
        <div className="bg-white border-b border-gray-100 px-4 py-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Phone</span>
            <span className="font-medium text-gray-900">{convo.customer.phone}</span>
          </div>
          {convo.customer.email && (
            <div className="flex justify-between">
              <span className="text-gray-400">Email</span>
              <span className="font-medium text-gray-900">{convo.customer.email}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-400">Orders</span>
            <span className="font-medium text-gray-900">{convo.customer.totalOrders}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Total spent</span>
            <span className="font-medium text-gray-900">{convo.customer.totalSpent}</span>
          </div>
          {convo.customer.tags.length > 0 && (
            <div className="flex justify-between items-start">
              <span className="text-gray-400">Tags</span>
              <div className="flex flex-wrap gap-1 justify-end">
                {convo.customer.tags.map((t) => (
                  <span key={t} className="bg-gray-100 text-gray-600 text-[11px] px-2 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
            </div>
          )}
          {convo.currentFlow && (
            <div className="flex justify-between">
              <span className="text-gray-400">Current flow</span>
              <span className="font-medium text-gray-700 font-mono text-xs">{convo.currentFlow}</span>
            </div>
          )}
          {customerOrders.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recent orders</p>
              <div className="space-y-1.5">
                {customerOrders.slice(0, 3).map((order) => (
                  <div key={order.id} className="bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">
                        {order.items.map((i) => `${i.qty}× ${i.name}`).join(', ') || 'Order'}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-gray-900">
                        ₦{parseFloat(order.total).toLocaleString()}
                      </p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        order.status === 'PAID' ? 'bg-green-100 text-green-700' :
                        order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bot banner */}
      {isBot && (
        <div className="bg-[#FFF9C4] text-[#7A6500] text-xs text-center py-1.5 px-4 shadow-sm">
          🤖 Bot is handling this conversation — tap <strong>Take over</strong> to reply manually
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-3">
        {groups.map((g) => (
          <div key={g.date}>
            <DateSeparator date={g.date} />
            {g.msgs.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
          </div>
        ))}
        {reply.isPending && (
          <div className="flex justify-end px-3 mb-1">
            <div className="bg-[#DCF8C6] rounded-2xl rounded-tr-sm px-3 py-2 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply input */}
      <div className={`bg-[#F0F0F0] px-3 py-2 flex items-end gap-2 ${isResolved ? 'opacity-60 pointer-events-none' : ''}`}>
        <div className="flex-1 bg-white rounded-3xl px-4 py-2.5 shadow-sm min-h-[44px] flex items-center">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isResolved ? 'Conversation resolved' : isBot ? 'Take over to reply…' : 'Type a message…'}
            disabled={isResolved || (isBot && !takeOver.isSuccess)}
            rows={1}
            className="w-full resize-none text-sm text-[#111B21] placeholder-gray-400 outline-none bg-transparent max-h-28 leading-relaxed"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!text.trim() || reply.isPending || isResolved || (isBot && !takeOver.isSuccess)}
          className="w-11 h-11 bg-[#25D366] rounded-full flex items-center justify-center shrink-0 disabled:opacity-40 active:scale-95 transition-transform shadow-sm"
        >
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
