import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const agentApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
});

agentApi.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('agent_token') : null;
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

agentApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('agent_token');
      window.location.href = '/agent/login';
    }
    return Promise.reject(err);
  }
);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: 'OWNER' | 'MANAGER' | 'AGENT' | 'SALES_REP';
  tenantId: string;
}

export interface ConversationSummary {
  id: string;
  status: 'OPEN' | 'BOT' | 'PENDING' | 'RESOLVED';
  waNumber: string;
  updatedAt: string;
  customer: { id: string; name: string; phone: string };
  messages: Array<{ id: string; direction: string; content: Record<string, unknown>; createdAt: string }>;
  assignedMemberId: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  content: Record<string, unknown>;
  status: string;
  waMessageId: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface ConversationDetail {
  id: string;
  status: string;
  waNumber: string;
  currentFlow: string | null;
  assignedMemberId: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    totalOrders: number;
    totalSpent: string;
    tags: string[];
  };
  messages: Message[];
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useConversations(filter: 'all' | 'mine' | 'open' | 'bot' = 'all') {
  return useQuery({
    queryKey: ['agent-conversations', filter],
    queryFn: async () => {
      const params: Record<string, string> = { limit: '50' };
      if (filter === 'mine') params['assignedToMe'] = 'true';
      if (filter === 'open') params['status'] = 'OPEN';
      if (filter === 'bot') params['status'] = 'BOT';
      const res = await agentApi.get<{ success: boolean; data: ConversationSummary[] }>(
        '/api/v1/conversations',
        { params }
      );
      return res.data.data;
    },
    refetchInterval: 5000,
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: ['agent-conversation', id],
    queryFn: async () => {
      const res = await agentApi.get<{ success: boolean; data: ConversationDetail }>(
        `/api/v1/conversations/${id}`
      );
      return res.data.data;
    },
    refetchInterval: 3000,
  });
}

export function useReply(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (text: string) => {
      const res = await agentApi.post(`/api/v1/conversations/${conversationId}/reply`, { text });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-conversation', conversationId] });
      qc.invalidateQueries({ queryKey: ['agent-conversations'] });
    },
  });
}

export function useResolve(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await agentApi.post(`/api/v1/conversations/${conversationId}/resolve`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-conversation', conversationId] });
      qc.invalidateQueries({ queryKey: ['agent-conversations'] });
    },
  });
}

export function useTakeOver(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      await agentApi.post(`/api/v1/conversations/${conversationId}/assign`, { agentId: memberId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-conversation', conversationId] });
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getMessageText(msg: Message): string {
  const c = msg.content;
  if (typeof c['text'] === 'string') return c['text'];
  if (c['interactive']) {
    const ia = c['interactive'] as Record<string, unknown>;
    const body = ia['body'] as Record<string, unknown> | undefined;
    return typeof body?.['text'] === 'string' ? body['text'] : '';
  }
  return '';
}

export function isLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('agent_token'));
}

export function getAgentProfile(): AgentProfile | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('agent_profile');
  if (!raw) return null;
  try { return JSON.parse(raw) as AgentProfile; } catch { return null; }
}
