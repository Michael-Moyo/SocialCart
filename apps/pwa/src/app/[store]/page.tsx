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

export default function StorePage({ params }: StorePageProps) {
  const { store } = params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [phone, setPhone] = useState('');
  const [storeName, setStoreName] = useState(store);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPhone(getOrCreatePhone());
    setStoreName(store.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
  }, [store]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const appendMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  async function handleSend(text: string) {
    if (!phone || sending) return;

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      text,
      direction: 'outbound',
      sentAt: new Date().toISOString(),
    };
    appendMessage(userMsg);
    setSending(true);

    try {
      const res = await axios.post<{ success: boolean; reply?: { text: string; buttons?: Message['buttons']; listRows?: Message['listRows'] } }>(
        `/api/message`,
        { phone, message: text, tenantId: store }
      );

      if (res.data.reply) {
        const storeMsg: Message = {
          id: `store_${Date.now()}`,
          text: res.data.reply.text,
          direction: 'inbound',
          sentAt: new Date().toISOString(),
          buttons: res.data.reply.buttons,
          listRows: res.data.reply.listRows,
        };
        appendMessage(storeMsg);
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

  function handleButtonClick(id: string) {
    handleSend(id);
  }

  return (
    <div className="flex flex-col h-full max-h-screen bg-[#ECE5DD]">
      {/* Header */}
      <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3 shadow-md">
        <div className="w-10 h-10 bg-[#25D366] rounded-full flex items-center justify-center text-xl shrink-0">
          🛒
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold truncate">{storeName}</div>
          <div className="text-[#25D366] text-xs">tap here for store info</div>
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
        {messages.length === 0 && (
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
      <ChatInput onSend={handleSend} disabled={sending || !phone} />
    </div>
  );
}
