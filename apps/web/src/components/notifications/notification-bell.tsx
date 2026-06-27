'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, X, CheckCheck, Package, MessageSquare, ShoppingCart, Megaphone, Gift, Users, AlertCircle, Info } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSSE } from '@/lib/use-sse';
import { formatDistanceToNow } from 'date-fns';

type NotificationType =
  | 'NEW_ORDER' | 'NEW_CONVERSATION' | 'CONVERSATION_ASSIGNED'
  | 'CART_ABANDONED' | 'CAMPAIGN_COMPLETE' | 'LOYALTY_TIER_UP'
  | 'TEAM_INVITE' | 'SYSTEM';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

const TYPE_ICON: Record<NotificationType, React.ElementType> = {
  NEW_ORDER: ShoppingCart,
  NEW_CONVERSATION: MessageSquare,
  CONVERSATION_ASSIGNED: MessageSquare,
  CART_ABANDONED: ShoppingCart,
  CAMPAIGN_COMPLETE: Megaphone,
  LOYALTY_TIER_UP: Gift,
  TEAM_INVITE: Users,
  SYSTEM: Info,
};

const TYPE_COLOR: Record<NotificationType, string> = {
  NEW_ORDER: 'text-green-400 bg-green-400/10',
  NEW_CONVERSATION: 'text-blue-400 bg-blue-400/10',
  CONVERSATION_ASSIGNED: 'text-blue-400 bg-blue-400/10',
  CART_ABANDONED: 'text-orange-400 bg-orange-400/10',
  CAMPAIGN_COMPLETE: 'text-purple-400 bg-purple-400/10',
  LOYALTY_TIER_UP: 'text-yellow-400 bg-yellow-400/10',
  TEAM_INVITE: 'text-pink-400 bg-pink-400/10',
  SYSTEM: 'text-gray-400 bg-gray-400/10',
};

function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Notification[]; meta: { unreadCount: number } }>(
        '/api/v1/notifications?limit=20'
      );
      return res.data;
    },
    refetchInterval: 15000,
  });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  useSSE({
    'notification': () => { void qc.invalidateQueries({ queryKey: ['notifications'] }); },
  });

  const { data } = useNotifications();
  const notifications = data?.data ?? [];
  const unreadCount = data?.meta.unreadCount ?? 0;

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post('/api/v1/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-[#25D366] rounded-full text-[10px] font-bold text-white flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-96 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="flex items-center gap-1 text-xs text-[#25D366] hover:text-[#1ea855] transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-800">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="h-8 w-8 text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Info;
                const colorClass = TYPE_COLOR[n.type] ?? TYPE_COLOR.SYSTEM;
                return (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors group ${!n.read ? 'bg-gray-800/30' : ''}`}
                    onClick={() => { if (!n.read) markRead.mutate(n.id); }}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${colorClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-white leading-snug">{n.title}</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); dismiss.mutate(n.id); }}
                          className="flex-shrink-0 text-gray-600 hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-gray-600 mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {!n.read && (
                      <div className="flex-shrink-0 w-2 h-2 rounded-full bg-[#25D366] mt-2" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
