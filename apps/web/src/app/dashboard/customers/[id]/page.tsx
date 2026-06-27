'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Phone, Mail, Star, ShoppingCart, MessageSquare,
  Gift, Calendar, Loader2, ExternalLink,
} from 'lucide-react';
import { useCustomerDetail } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDateTime, formatPhone } from '@/lib/utils';
import { cn } from '@/lib/utils';

const TIER_COLOR: Record<string, string> = {
  BRONZE:   'text-amber-700 bg-amber-50 border-amber-200',
  SILVER:   'text-gray-600  bg-gray-50  border-gray-200',
  GOLD:     'text-yellow-700 bg-yellow-50 border-yellow-200',
  PLATINUM: 'text-purple-700 bg-purple-50 border-purple-200',
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: customer, isLoading } = useCustomerDetail(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Customer not found.</p>
        <button onClick={() => router.back()} className="mt-3 text-sm text-[#25D366] hover:underline">
          Go back
        </button>
      </div>
    );
  }

  const totalSpent = customer.orders.reduce((sum, o) => sum + parseFloat(o.total), 0);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">{customer.name}</h1>
          <p className="text-sm text-gray-400">{formatPhone(customer.phone)}</p>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-4xl">
        {/* Profile card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-full bg-[#25D366] flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {customer.name[0]?.toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="text-lg font-bold text-gray-900">{customer.name}</h2>
                {customer.loyaltyAccount && (
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full border',
                    TIER_COLOR[customer.loyaltyAccount.tier] ?? 'text-gray-600 bg-gray-50'
                  )}>
                    {customer.loyaltyAccount.tier}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {formatPhone(customer.phone)}
                </span>
                {customer.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {customer.email}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Joined {formatDateTime(customer.createdAt)}
                </span>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex gap-2 flex-shrink-0">
              <Link
                href={`/dashboard/conversations?phone=${encodeURIComponent(customer.phone)}`}
                className="flex items-center gap-1.5 text-xs bg-[#25D366] text-white rounded-lg px-3 py-2 hover:bg-[#128C7E] transition-colors font-medium"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Chat
              </Link>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Orders', value: customer.orders.length.toLocaleString(), icon: ShoppingCart },
              { label: 'Total Spent', value: formatCurrency(totalSpent), icon: ShoppingCart },
              { label: 'Loyalty Points', value: customer.loyaltyAccount?.points.toLocaleString() ?? '—', icon: Gift },
              { label: 'Loyalty Tier', value: customer.loyaltyAccount?.tier ?? 'None', icon: Star },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Order history */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-gray-500" />
              Order History
              <span className="ml-1 text-xs text-gray-400 font-normal">({customer.orders.length})</span>
            </h3>
          </div>

          {customer.orders.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">No orders yet</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {customer.orders.map((order) => (
                <div key={order.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">
                        {order.externalId ?? order.id.slice(0, 8)}
                      </p>
                      <Badge status={order.status} className="text-[10px] px-1.5 py-0" />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(order.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(parseFloat(order.total))}</p>
                    <Link
                      href={`/dashboard/orders?id=${order.id}`}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes / metadata */}
        {customer.metadata && Object.keys(customer.metadata as object).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Metadata</h3>
            <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 overflow-auto">
              {JSON.stringify(customer.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
