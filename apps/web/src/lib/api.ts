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
