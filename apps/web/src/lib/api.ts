'use client';

import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ─── Axios Instance ───────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sc_token') : null;
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('sc_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export { api };
export default api;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Integration {
  id: string;
  type: string;
  status: string;
  lastSyncAt: string | null;
  syncCount: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface Product {
  id: string;
  externalId: string;
  source: string;
  sku: string;
  name: string;
  description: string | null;
  price: string;
  compareAtPrice: string | null;
  inventory: number;
  images: { url: string; alt?: string }[];
  categories: string[];
  status: string;
  syncedAt: string;
}

export interface Customer {
  id: string;
  phone: string;
  name: string;
  email: string | null;
  totalOrders: number;
  totalSpent: string;
  tags: string[];
  createdAt: string;
}

export interface Order {
  id: string;
  externalId: string | null;
  source: string | null;
  status: string;
  paymentStatus: string;
  total: string;
  currency: string;
  customer: { id: string; name: string; phone: string; email: string | null };
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  activeIntegrations: number;
  ordersThisMonth: number;
  revenueThisMonth: number;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (phone: string, password: string) =>
    api.post<{ success: boolean; data: { token: string; tenant: object } }>('/api/v1/auth/login', { phone, password }),

  register: (data: { name: string; phone: string; password: string; email?: string }) =>
    api.post<{ success: boolean; data: { token: string; tenant: object } }>('/api/v1/auth/register', data),

  me: () => api.get('/api/v1/auth/me'),
};

// ─── React Query Hooks ────────────────────────────────────────────────────────

export function useIntegrations() {
  return useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Integration[] }>('/api/v1/integrations');
      return res.data.data;
    },
  });
}

export function useProducts(params: { page?: number; limit?: number; search?: string; status?: string } = {}) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Product[]; meta: PaginatedResponse<Product>['meta'] }>(
        '/api/v1/products',
        { params }
      );
      return res.data;
    },
  });
}

export function useOrders(params: { page?: number; limit?: number; status?: string } = {}) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Order[]; meta: PaginatedResponse<Order>['meta'] }>(
        '/api/v1/orders',
        { params }
      );
      return res.data;
    },
  });
}

export function useCustomers(params: { page?: number; limit?: number; search?: string } = {}) {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Customer[]; meta: PaginatedResponse<Customer>['meta'] }>(
        '/api/v1/customers',
        { params }
      );
      return res.data;
    },
  });
}

// ─── Conversations ────────────────────────────────────────────────────────────

export interface ConversationMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  content: Record<string, unknown>;
  waMessageId: string | null;
  sentAt: string;
  status: string;
}

export interface Conversation {
  id: string;
  waNumber: string;
  status: string;
  assignedTo: string | null;
  customer: { id: string; name: string; phone: string } | null;
  messages: ConversationMessage[];
  _count?: { messages: number };
  createdAt: string;
  updatedAt: string;
}

export interface ConversationListItem extends Omit<Conversation, 'messages'> {
  messages: ConversationMessage[];
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface TenantSettings {
  botEnabled?: boolean;
  greetingMessage?: string;
  currency?: string;
  timezone?: string;
  workingHoursEnabled?: boolean;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  offlineMessage?: string;
  webhookVerifyToken?: string;
  whatsappAccessToken?: string;
}

export interface TenantProfile {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  plan: string;
  isActive: boolean;
  whatsappBusinessId: string | null;
  whatsappPhoneNumberId: string | null;
  settings: TenantSettings;
  createdAt: string;
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  message: string;
  mediaUrl: string | null;
  templateName: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  targetSegment: Record<string, unknown>;
  stats: { sent: number; delivered: number; read: number; replied: number };
  createdAt: string;
  updatedAt: string;
}

export function useCampaigns(params: { page?: number; limit?: number; status?: string } = {}) {
  return useQuery({
    queryKey: ['campaigns', params],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Campaign[]; meta: PaginatedResponse<Campaign>['meta'] }>(
        '/api/v1/campaigns',
        { params }
      );
      return res.data;
    },
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Campaign> & { name: string; type: string; message: string }) => {
      const res = await api.post<{ success: boolean; data: Campaign }>('/api/v1/campaigns', data);
      return res.data.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

export function useLaunchCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/api/v1/campaigns/${id}/launch`);
      return res.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

export function usePauseCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/api/v1/campaigns/${id}/pause`);
      return res.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/v1/campaigns/${id}`);
      return res.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

// ─── Loyalty ──────────────────────────────────────────────────────────────────

export interface LoyaltyAccount {
  id: string;
  customerId: string;
  tenantId: string;
  points: number;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  history: { date: string; type: string; points: number; reason: string; balance: number }[];
  customer: { id: string; name: string; phone: string; email: string | null; totalOrders: number; totalSpent: string };
  pointsToNextTier?: number;
  nextTier?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyStats {
  totalMembers: number;
  tiers: Record<string, { count: number; totalPoints: number }>;
  thresholds: Record<string, number>;
}

export function useLoyaltyAccounts(params: { page?: number; limit?: number; tier?: string } = {}) {
  return useQuery({
    queryKey: ['loyalty', params],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: LoyaltyAccount[]; meta: PaginatedResponse<LoyaltyAccount>['meta'] }>(
        '/api/v1/loyalty',
        { params }
      );
      return res.data;
    },
  });
}

export function useLoyaltyStats() {
  return useQuery({
    queryKey: ['loyalty-stats'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: LoyaltyStats }>('/api/v1/loyalty/stats');
      return res.data.data;
    },
  });
}

export function useAwardPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ customerId, points, reason }: { customerId: string; points: number; reason: string }) => {
      const res = await api.post(`/api/v1/loyalty/${customerId}/award`, { points, reason });
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['loyalty'] });
      void qc.invalidateQueries({ queryKey: ['loyalty-stats'] });
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: TenantProfile }>('/api/v1/settings');
      return res.data.data;
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name?: string; email?: string | null }) => {
      const res = await api.patch('/api/v1/settings/profile', data);
      return res.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['settings'] }),
  });
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await api.patch('/api/v1/settings/password', data);
      return res.data;
    },
  });
}

export function useUpdateWhatsApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      whatsappBusinessId?: string;
      whatsappPhoneNumberId?: string;
      whatsappAccessToken?: string;
      webhookVerifyToken?: string;
    }) => {
      const res = await api.patch('/api/v1/settings/whatsapp', data);
      return res.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['settings'] }),
  });
}

export function useUpdateBotSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: TenantSettings) => {
      const res = await api.patch('/api/v1/settings/bot', data);
      return res.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['settings'] }),
  });
}

export function useConversations(params: { page?: number; limit?: number; status?: string } = {}) {
  return useQuery({
    queryKey: ['conversations', params],
    queryFn: async () => {
      const res = await api.get<{
        success: boolean;
        data: ConversationListItem[];
        pagination: { page: number; limit: number; total: number; pages: number };
      }>('/api/v1/conversations', { params });
      return res.data;
    },
    refetchInterval: 8000,
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ['conversation', id],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Conversation }>(
        `/api/v1/conversations/${id}`
      );
      return res.data.data;
    },
    enabled: !!id,
    refetchInterval: 5000,
  });
}

export function useResolveConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/api/v1/conversations/${id}/resolve`);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['conversations'] });
      void qc.invalidateQueries({ queryKey: ['conversation'] });
    },
  });
}

export function useAssignConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, agentId }: { id: string; agentId: string }) => {
      const res = await api.post(`/api/v1/conversations/${id}/assign`, { agentId });
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['conversations'] });
      void qc.invalidateQueries({ queryKey: ['conversation'] });
    },
  });
}

export function useSyncIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (integrationId: string) => {
      const res = await api.post(`/api/v1/integrations/${integrationId}/sync`);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['integrations'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useRegisterIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { type: string; credentials: Record<string, string>; webhookSecret?: string }) => {
      const res = await api.post('/api/v1/integrations', data);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['integrations'] });
    },
  });
}

export function useDeleteIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (integrationId: string) => {
      const res = await api.delete(`/api/v1/integrations/${integrationId}`);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['integrations'] });
    },
  });
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface OverviewMetric { value: number; change: number }
export interface OverviewData {
  revenue: OverviewMetric;
  orders: OverviewMetric;
  conversations: OverviewMetric;
  newCustomers: OverviewMetric;
}
export interface RevenuePoint { date: string; revenue: number }
export interface FunnelStage { stage: string; count: number }
export interface TopProduct { sku: string; name: string; revenue: number; units: number }
export interface PaymentStats {
  total: number; paid: number; expired: number; pending: number;
  conversionRate: number; revenueByProvider: Record<string, number>;
}

export function useAnalyticsOverview(days = 30) {
  return useQuery({
    queryKey: ['analytics-overview', days],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: OverviewData }>(`/api/v1/analytics/overview?days=${days}`);
      return res.data.data;
    },
    refetchInterval: 60000,
  });
}

export function useRevenueChart(days = 30) {
  return useQuery({
    queryKey: ['analytics-revenue', days],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: RevenuePoint[] }>(`/api/v1/analytics/revenue-chart?days=${days}`);
      return res.data.data;
    },
    refetchInterval: 60000,
  });
}

export function useConversionFunnel() {
  return useQuery({
    queryKey: ['analytics-funnel'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: FunnelStage[] }>('/api/v1/analytics/conversion-funnel');
      return res.data.data;
    },
    refetchInterval: 60000,
  });
}

export function useTopProducts() {
  return useQuery({
    queryKey: ['analytics-products'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: TopProduct[] }>('/api/v1/analytics/top-products');
      return res.data.data;
    },
    refetchInterval: 60000,
  });
}

export function usePaymentStats() {
  return useQuery({
    queryKey: ['analytics-payments'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PaymentStats }>('/api/v1/analytics/payment-stats');
      return res.data.data;
    },
    refetchInterval: 60000,
  });
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export interface PaymentLink {
  id: string;
  customerId: string;
  orderId: string | null;
  provider: string;
  externalRef: string | null;
  amount: string;
  currency: string;
  url: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  paidAt: string | null;
  createdAt: string;
  customer: { id: string; name: string; phone: string };
}

export function usePaymentLinks(status?: string) {
  return useQuery({
    queryKey: ['payment-links', status],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PaymentLink[] }>(
        `/api/v1/payments/links${status ? `?status=${status}` : ''}`
      );
      return res.data.data;
    },
  });
}

export function useCreatePaymentLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { customerId: string; amount: number; currency: string; description: string; orderId?: string }) => {
      const res = await api.post<{ success: boolean; data: { id: string; url: string; reference: string } }>('/api/v1/payments/links', data);
      return res.data.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['payment-links'] }),
  });
}
