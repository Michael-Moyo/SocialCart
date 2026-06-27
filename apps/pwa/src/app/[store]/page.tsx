'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { ChatBubble, Message } from '@/components/chat-bubble';
import { ChatInput } from '@/components/chat-input';

interface StorePageProps {
  params: { store: string };
}

const PHONE_KEY = 'socialcart_phone';

function getOrCreatePhone(): string {
  if (typeof window === 'undefined') return '';
  const stored = localStorage.getItem(PHONE_KEY);
  if (stored) return stored;
  const generated = `+00${Math.floor(1_000_000_000 + Math.random() * 9_000_000_000)}`;
  localStorage.setItem(PHONE_KEY, generated);
  return generated;
}

interface StoreInfo { id: string; name: string; logoUrl: string | null; tagline: string | null; primaryColor: string }

type BotReply = { text: string; buttons?: Message['buttons']; listRows?: Message['listRows'] };

type HistoryMessage = {
  id: string;
  direction: string;
  type: string;
  content: Record<string, unknown>;
  sentAt: string | null;
  createdAt: string;
};

function historyToMessages(msgs: HistoryMessage[]): Message[] {
  return msgs.map((m) => ({
    id: m.id,
    text: (m.content['text'] as string | undefined) ?? '',
    direction: (m.direction === 'OUTBOUND' ? 'inbound' : 'outbound') as 'inbound' | 'outbound',
    sentAt: m.sentAt ?? m.createdAt,
    buttons: m.content['buttons'] as Message['buttons'] | undefined,
    listRows: m.content['listRows'] as Message['listRows'] | undefined,
  })).filter((m) => m.text);
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function StorePage({ params }: StorePageProps) {
  const { store } = params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [phone, setPhone] = useState('');
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPhone(getOrCreatePhone());
  }, []);

  useEffect(() => {
    axios.get<{ success: boolean; data: StoreInfo }>(`${API_BASE}/api/v1/public/stores/${store}`)
      .then((r) => setStoreInfo(r.data.data))
      .catch(() => setNotFound(true));
  }, [store]);

  // Load chat history once phone is known
  useEffect(() => {
    if (!phone || historyLoaded) return;
    axios.get<{ success: boolean; messages: HistoryMessage[] }>(
      `/api/message?tenantId=${encodeURIComponent(store)}&phone=${encodeURIComponent(phone)}`
    ).then((r) => {
      if (r.data.messages?.length) {
        setMessages(historyToMessages(r.data.messages));
      }
    }).catch(() => null)
      .finally(() => setHistoryLoaded(true));
  }, [phone, store, historyLoaded]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const appendMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  async function handleSend(text: string, displayText?: string) {
    if (!phone || sending) return;

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      text: displayText ?? text,
      direction: 'outbound',
      sentAt: new Date().toISOString(),
    };
    appendMessage(userMsg);
    setSending(true);

    try {
      const res = await axios.post<{ success: boolean; replies?: BotReply[] }>(
        `/api/message`,
        { phone, message: text, tenantId: store }
      );

      const replies = res.data.replies ?? [];
      for (const reply of replies) {
        if (!reply.text) continue;
        appendMessage({
          id: `store_${Date.now()}_${Math.random()}`,
          text: reply.text,
          direction: 'inbound',
          sentAt: new Date().toISOString(),
          buttons: reply.buttons,
          listRows: reply.listRows,
        });
      }
    } catch {
      appendMessage({
        id: `err_${Date.now()}`,
        text: 'Message could not be delivered. Please try again.',
        direction: 'inbound',
        sentAt: new Date().toISOString(),
      });
    } finally {
      setSending(false);
    }
  }

  function handleButtonClick(id: string, title: string) {
    // Send the raw ID to the bot but show the human-readable title in chat
    void handleSend(id, title);
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#ECE5DD] px-6 text-center">
        <div className="text-5xl mb-4">🛒</div>
        <h2 className="text-[#075E54] font-bold text-lg mb-2">Store not found</h2>
        <p className="text-gray-500 text-sm">This store link may be invalid or the store is currently unavailable.</p>
      </div>
    );
  }

  if (!storeInfo) {
    return (
      <div className="flex items-center justify-center h-full bg-[#ECE5DD]">
        <div className="w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-screen bg-[#ECE5DD]">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 shadow-md" style={{ backgroundColor: storeInfo.primaryColor === '#25D366' ? '#075E54' : storeInfo.primaryColor }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 overflow-hidden" style={{ backgroundColor: storeInfo.primaryColor }}>
          {storeInfo.logoUrl
            ? <img src={storeInfo.logoUrl} alt={storeInfo.name} className="w-full h-full object-cover" />
            : '🛒'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold truncate">{storeInfo.name}</div>
          <div className="text-xs opacity-70 text-white">{storeInfo.tagline ?? 'Chat to shop'}</div>
        </div>
        <div className="flex items-center gap-3 text-white">
          <svg className="w-5 h-5 opacity-80" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
          </svg>
          <svg className="w-5 h-5 opacity-80" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {messages.length === 0 && historyLoaded && (
          <div className="flex justify-center">
            <div className="bg-[#FFF9C4] rounded-lg px-4 py-2 text-xs text-[#0F172A] shadow-sm max-w-xs text-center">
              Messages are end-to-end experience powered by SocialCart
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} onButtonClick={handleButtonClick} />
        ))}
        {sending && (
          <div className="flex justify-start mb-1">
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={(text) => handleSend(text)} disabled={sending || !phone} />
    </div>
  );
}
