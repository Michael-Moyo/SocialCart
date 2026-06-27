'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell, TableEmpty } from '@/components/ui/table';
import { useCustomers } from '@/lib/api';
import { formatCurrency, formatDate, formatPhone } from '@/lib/utils';

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useCustomers({ page, limit: 20, search: search || undefined });

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="Customers" description="All customers across your connected platforms" />

      <div className="p-6 space-y-4">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, phone, email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Summary */}
        <p className="text-sm text-gray-500">
          {data?.meta?.total?.toLocaleString() ?? '—'} total customers
        </p>

        {/* Table */}
        <Table>
          <TableHead>
            <tr>
              <TableHeader>Customer</TableHeader>
              <TableHeader>Phone</TableHeader>
              <TableHeader>Tags</TableHeader>
              <TableHeader>Orders</TableHeader>
              <TableHeader>Total Spent</TableHeader>
              <TableHeader>Joined</TableHeader>
            </tr>
          </TableHead>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(6)].map((__, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.data?.length ? (
              data.data.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-sm font-semibold flex-shrink-0">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        {customer.email && <p className="text-xs text-gray-400">{customer.email}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{formatPhone(customer.phone)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {customer.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{customer.totalOrders}</TableCell>
                  <TableCell className="font-semibold">
                    {formatCurrency(parseFloat(customer.totalSpent))}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {formatDate(customer.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableEmpty message="No customers found" />
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {data?.meta && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-gray-500">
              Page {page} of {data.meta.totalPages}
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
