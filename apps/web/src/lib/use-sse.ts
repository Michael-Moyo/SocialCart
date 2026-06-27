'use client';

import { useEffect, useRef, useCallback } from 'react';

type SSEEvent = {
  event: string;
  data: unknown;
};

type EventHandler = (data: unknown) => void;

/**
 * Connects to the SSE stream and calls handlers when events arrive.
 * Reconnects automatically with exponential backoff.
 */
export function useSSE(handlers: Record<string, EventHandler>) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('sc_token') : null;
    if (!token) return;

    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    let es: EventSource | null = null;
    let retryMs = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let unmounted = false;

    function connect() {
      if (unmounted) return;
      // EventSource doesn't support custom headers, so pass token as query param
      es = new EventSource(`${apiBase}/api/v1/sse?token=${token}`);

      es.addEventListener('connected', () => { retryMs = 1000; });

      // Forward named events to registered handlers
      const eventNames = ['notification', 'conversation:message', 'conversation:status'];
      for (const name of eventNames) {
        es.addEventListener(name, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data as string) as unknown;
            handlersRef.current[name]?.(data);
          } catch {}
        });
      }

      es.onerror = () => {
        es?.close();
        if (!unmounted) {
          retryTimer = setTimeout(() => { retryMs = Math.min(retryMs * 2, 30000); connect(); }, retryMs);
        }
      };
    }

    connect();

    return () => {
      unmounted = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
