'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { MessageSquare, User, CheckCircle, Clock, Search, RefreshCw, ChevronRight, Wifi, WifiOff, Send } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useConversations,
  useConversation,
  useResolveConversation,
  useReplyConversation,
  type ConversationListItem,
  type ConversationMessage,
} from '@/lib/api';
import { useSSE } from '@/lib/use-sse';
import { useQueryClient } from '@tanstack/react-query';
import { cn, formatDateTime, formatPhone, truncate } from '@/lib/utils';

const STATUS_FILTERS = ['all', 'OPEN', 'BOT', 'PENDING', 'RESOLVED'];

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getLastMessage(convo: ConversationListItem): string {
  const msg = convo.messages[0];
  if (!msg) return 'No messages yet';
  const text =
    (msg.content as { text?: string; body?: string }).text ??
    (msg.content as { body?: string }).body ??
    msg.type;
  return truncate(text, 60);
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ConversationMessage }) {
  const isOut = msg.direction === 'OUTBOUND';
  const text =
    (msg.content as { text?: string }).text ??
    (msg.content as { body?: string }).body ??
    JSON.stringify(msg.content);

  const buttons = (msg.content as { buttons?: { id: string; title: string }[] }).buttons;
  const sections = (
    msg.content as {
      sections?: { title?: string; rows: { id: string; title: string; description?: string }[] }[];
    }
  ).sections;

  return (
    <div className={cn('flex mb-2', isOut ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] px-3 py-2 rounded-2xl text-sm shadow-sm',
          isOut
            ? 'bg-[#dcf8c6] text-gray-900 rounded-br-sm'
            : 'bg-white text-gray-900 rounded-bl-sm border border-gray-100'
        )}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{text}</p>

        {sections && (
          <div className="mt-2 border-t border-gray-200 pt-2 space-y-1">
            {sections.map((sec, si) => (
              <div key={si}>
                {sec.title && <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{sec.title}</p>}
                {sec.rows.map((row) => (
                  <div key={row.id} className="text-xs bg-gray-50 rounded px-2 py-1 flex items-center justify-between gap-2">
                    <span className="font-medium">{row.title}</span>
                    {row.description && <span className="text-gray-400">{row.description}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {buttons && (
          <div className="mt-2 flex flex-wrap gap-1">
            {buttons.map((btn) => (
              <span
                key={btn.id}
                className="text-xs border border-[#25D366] text-[#128C7E] rounded-full px-2 py-0.5 font-medium"
              >
                {btn.title}
              </span>
            ))}
          </div>
        )}

        <p className={cn('text-[10px] mt-1', isOut ? 'text-gray-500 text-right' : 'text-gray-400')}>
          {formatDateTime(msg.sentAt)}
        </p>
      </div>
    </div>
  );
}

// ─── Conversation Thread ──────────────────────────────────────────────────────

function ConversationThread({ id }: { id: string }) {
  const { data: convo, isLoading } = useConversation(id);
  const resolve = useResolveConversation();
  const reply = useReplyConversation(id);
  const [replyText, setReplyText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [convo?.messages?.length]);

  function sendReply() {
    const text = replyText.trim();
    if (!text || reply.isPending) return;
    reply.mutate(text, {
      onSuccess: () => {
        setReplyText('');
        textareaRef.current?.focus();
      },
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!convo) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="px-5 py-3 border-b border-gray-100 bg-white flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center text-white font-semibold text-sm">
            {(convo.customer?.name ?? convo.waNumber)[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">
              {convo.customer?.name ?? 'Unknown'}
            </p>
            <p className="text-xs text-gray-400">{formatPhone(convo.waNumber)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge status={convo.status} />
          {convo.status !== 'RESOLVED' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => resolve.mutate(convo.id)}
              disabled={resolve.isPending}
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              Resolve
            </Button>
          )}
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#e5ddd5] space-y-0.5">
        {convo.messages.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-8">No messages yet</p>
        )}
        {convo.messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      {convo.status !== 'RESOLVED' && (
        <div className="px-4 py-3 border-t border-gray-200 bg-white flex items-end gap-2 flex-shrink-0">
          <textarea
            ref={textareaRef}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a reply… (Enter to send, Shift+Enter for newline)"
            rows={2}
            className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
          />
          <Button
            size="sm"
            onClick={sendReply}
            disabled={!replyText.trim() || reply.isPending}
            className="flex-shrink-0 h-10 w-10 p-0 rounded-xl"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Info footer */}
      <div className="px-5 py-2 border-t border-gray-100 bg-gray-50 flex items-center gap-4 text-xs text-gray-400 flex-shrink-0">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Started {formatDateTime(convo.createdAt)}
        </span>
        {convo.assignedTo && (
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            Assigned to {convo.assignedTo}
          </span>
        )}
        <span>{convo.messages.length} messages</span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ConversationsPage() {
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sseConnected, setSseConnected] = useState(false);
  const queryClient = useQueryClient();

  useSSE({
    'conversation:message': useCallback((data: unknown) => {
      const d = data as { conversationId: string };
      // Invalidate both the list and the specific thread
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (d.conversationId) {
        void queryClient.invalidateQueries({ queryKey: ['conversation', d.conversationId] });
      }
      setSseConnected(true);
    }, [queryClient]),
    'conversation:status': useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setSseConnected(true);
    }, [queryClient]),
  });

  const { data, isLoading, refetch, isFetching } = useConversations({
    page,
    limit: 30,
    status: status === 'all' ? undefined : status,
  });

  const conversations = data?.data ?? [];

  const filtered = search
    ? conversations.filter((c) => {
        const q = search.toLowerCase();
        return (
          c.waNumber.includes(q) ||
          (c.customer?.name ?? '').toLowerCase().includes(q)
        );
      })
    : conversations;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Conversations"
        description="Live WhatsApp conversations from your customers"
        actions={
          <span className={cn('flex items-center gap-1.5 text-xs', sseConnected ? 'text-green-600' : 'text-gray-400')}>
            {sseConnected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {sseConnected ? 'Live' : 'Connecting…'}
          </span>
        }
      />

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* ── Left: conversation list ── */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
          {/* Search + refresh */}
          <div className="px-3 pt-3 pb-2 border-b border-gray-100 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or number…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatus(s); setPage(1); setSelectedId(null); }}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                    status === s
                      ? 'bg-[#25D366] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {s === 'all' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
              <button
                onClick={() => void refetch()}
                className="ml-auto p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <div key={i} className="px-4 py-3 flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <MessageSquare className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No conversations</p>
              </div>
            ) : (
              filtered.map((convo) => (
                <button
                  key={convo.id}
                  onClick={() => setSelectedId(convo.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 transition-colors',
                    selectedId === convo.id && 'bg-green-50 border-r-2 border-[#25D366]'
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                    {(convo.customer?.name ?? convo.waNumber)[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-sm font-semibold text-gray-900 truncate">
                        {convo.customer?.name ?? formatPhone(convo.waNumber)}
                      </span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {timeAgo(convo.updatedAt)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{getLastMessage(convo)}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge status={convo.status} className="text-[10px] px-1.5 py-0" />
                      {(convo._count?.messages ?? 0) > 0 && (
                        <span className="text-[10px] text-gray-400">
                          {convo._count?.messages} msgs
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 self-center flex-shrink-0" />
                </button>
              ))
            )}
          </div>

          {/* Pagination */}
          {data?.pagination && data.pagination.pages > 1 && (
            <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                Page {page} of {data.pagination.pages}
              </span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  ←
                </Button>
                <Button size="sm" variant="outline" disabled={page >= data.pagination.pages} onClick={() => setPage((p) => p + 1)}>
                  →
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: thread ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#e5ddd5]">
          {selectedId ? (
            <ConversationThread id={selectedId} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
              <div className="w-16 h-16 rounded-full bg-white/60 flex items-center justify-center">
                <MessageSquare className="h-7 w-7 opacity-50" />
              </div>
              <p className="text-sm font-medium">Select a conversation</p>
              <p className="text-xs text-center max-w-xs">
                Click any conversation on the left to view the full message thread
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
