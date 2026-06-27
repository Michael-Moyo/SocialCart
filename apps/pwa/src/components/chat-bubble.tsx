'use client';

export interface Message {
  id: string;
  text: string;
  direction: 'inbound' | 'outbound';
  sentAt: string;
  type?: 'text' | 'interactive';
  buttons?: Array<{ id: string; title: string }>;
  listRows?: Array<{ id: string; title: string; description?: string }>;
}

interface ChatBubbleProps {
  message: Message;
  onButtonClick?: (id: string) => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatBubble({ message, onButtonClick }: ChatBubbleProps) {
  const isOutbound = message.direction === 'outbound';

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-1`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm ${
          isOutbound
            ? 'bg-[#DCF8C6] rounded-tr-sm'
            : 'bg-white rounded-tl-sm'
        }`}
      >
        <p className="text-sm text-[#0F172A] whitespace-pre-wrap leading-relaxed">{message.text}</p>

        {message.buttons && message.buttons.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {message.buttons.map((btn) => (
              <button
                key={btn.id}
                onClick={() => onButtonClick?.(btn.id)}
                className="w-full border border-[#25D366] text-[#25D366] text-sm rounded-lg px-3 py-1.5 text-center hover:bg-[#25D366] hover:text-white transition-colors"
              >
                {btn.title}
              </button>
            ))}
          </div>
        )}

        {message.listRows && message.listRows.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.listRows.map((row) => (
              <button
                key={row.id}
                onClick={() => onButtonClick?.(row.id)}
                className="w-full text-left border border-slate-200 rounded-lg px-3 py-2 hover:border-[#25D366] transition-colors"
              >
                <div className="text-sm font-medium text-[#0F172A]">{row.title}</div>
                {row.description && (
                  <div className="text-xs text-slate-500 mt-0.5">{row.description}</div>
                )}
              </button>
            ))}
          </div>
        )}

        <div className={`text-[10px] mt-1 ${isOutbound ? 'text-slate-400 text-right' : 'text-slate-400'}`}>
          {formatTime(message.sentAt)}
          {isOutbound && <span className="ml-1">✓✓</span>}
        </div>
      </div>
    </div>
  );
}
