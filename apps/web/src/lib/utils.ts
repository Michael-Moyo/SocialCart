import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatPhone(phone: string): string {
  // Format +2348012345678 -> +234 801 234 5678
  if (phone.startsWith('+')) {
    const digits = phone.slice(1);
    if (digits.length >= 10) {
      return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
    }
  }
  return phone;
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'text-green-700 bg-green-100',
    pending: 'text-yellow-700 bg-yellow-100',
    confirmed: 'text-blue-700 bg-blue-100',
    processing: 'text-purple-700 bg-purple-100',
    shipped: 'text-indigo-700 bg-indigo-100',
    delivered: 'text-green-700 bg-green-100',
    cancelled: 'text-red-700 bg-red-100',
    refunded: 'text-gray-700 bg-gray-100',
    paid: 'text-green-700 bg-green-100',
    failed: 'text-red-700 bg-red-100',
    ACTIVE: 'text-green-700 bg-green-100',
    ERROR: 'text-red-700 bg-red-100',
    INACTIVE: 'text-gray-700 bg-gray-100',
    SYNCING: 'text-blue-700 bg-blue-100',
    OPEN: 'text-blue-700 bg-blue-100',
    RESOLVED: 'text-green-700 bg-green-100',
    BOT: 'text-purple-700 bg-purple-100',
    PENDING: 'text-yellow-700 bg-yellow-100',
    DRAFT: 'text-gray-700 bg-gray-100',
    SCHEDULED: 'text-blue-700 bg-blue-100',
    RUNNING: 'text-green-700 bg-green-100',
    PAUSED: 'text-yellow-700 bg-yellow-100',
    COMPLETED: 'text-gray-600 bg-gray-100',
    CANCELLED: 'text-red-700 bg-red-100',
  };
  return colors[status] ?? 'text-gray-700 bg-gray-100';
}

export function platformLabel(platform: string): string {
  const labels: Record<string, string> = {
    shopify: 'Shopify',
    woocommerce: 'WooCommerce',
    odoo: 'Odoo',
    erpnext: 'ERPNext',
    retailman: 'RetailMan',
  };
  return labels[platform] ?? platform;
}
