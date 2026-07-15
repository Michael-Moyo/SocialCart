'use client';

import { useState, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');

  function handleSend() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="bg-[#F0F0F0] px-3 py-2 flex items-end gap-2">
      <div className="flex-1 bg-white rounded-3xl px-4 py-2.5 shadow-sm">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          disabled={disabled}
          className="w-full resize-none text-sm text-[#0F172A] placeholder-slate-400 outline-none bg-transparent max-h-32 leading-relaxed"
          style={{ fieldSizing: 'content' } as React.CSSProperties}
        />
      </div>
      <button
        onClick={handleSend}
        disabled={!value.trim() || disabled}
        className="w-11 h-11 bg-[#25D366] rounded-full flex items-center justify-center shrink-0 hover:bg-[#1ebe5d] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        aria-label="Send message"
      >
        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
      </button>
    </div>
  );
}
