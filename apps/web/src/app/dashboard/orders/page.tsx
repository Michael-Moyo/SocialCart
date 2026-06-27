'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell, TableEmpty } from '@/components/ui/table';
import { useOrders } from '@/lib/api';
import { formatCurrency, formatDateTime, platformLabel } from '@/lib/utils';

const STATUS_FILTERS = ['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('all');

  const { data, isLoading } = useOrders({
    page,
    limit: 20,
    status: status === 'all' ? undefined : status,
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="Orders" description="All orders from your connected platforms" />

      <div className="p-6 space-y-4">
        {/* Status filters */}
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                status === s
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Table */}
        <Table>
          <TableHead>
            <tr>
              <TableHeader>Order</TableHeader>
              <TableHeader>Customer</TableHeader>
              <TableHeader>Platform</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Payment</TableHeader>
              <TableHeader>Total</TableHeader>
              <TableHeader>Date</TableHeader>
            </tr>
          </TableHead>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(7)].map((__, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.data?.length ? (
              data.data.map((order) => (
                <TableRow key={order.id} className="cursor-pointer hover:bg-gray-50 transition-colors">
                  <TableCell>
                    <Link href={`/dashboard/orders/${order.id}`} className="font-mono text-xs text-[#25D366] hover:underline">
                      {order.externalId?.slice(0, 12) ?? order.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{order.customer?.name ?? '—'}</p>
                      <p className="text-xs text-gray-400">{order.customer?.phone}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">{order.source ? platformLabel(order.source) : 'Manual'}</span>
                  </TableCell>
                  <TableCell>
                    <Badge status={order.status} />
                  </TableCell>
                  <TableCell>
                    <Badge status={order.paymentStatus} />
                  </TableCell>
                  <TableCell className="font-semibold">
                    {formatCurrency(parseFloat(order.total))}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {formatDateTime(order.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableEmpty message="No orders found" />
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {data?.meta && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.meta.total)} of {data.meta.total} orders
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
