'use client';

import { useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProducts } from '@/lib/api';
import { formatCurrency, truncate } from '@/lib/utils';
import api from '@/lib/api';

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [syncing, setSyncing] = useState(false);

  const { data, isLoading, refetch } = useProducts({ page, limit: 20, search: search || undefined });

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post('/api/v1/products/sync', { source: 'shopify' });
      void refetch();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <Header title="Products" description="Synced products from your connected platforms" />

      <div className="p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <Button variant="outline" onClick={handleSync} loading={syncing}>
            <RefreshCw className="h-4 w-4" />
            Sync Products
          </Button>
        </div>

        {/* Product Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 h-64 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {data?.data?.map((product) => (
                <div key={product.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Product Image */}
                  <div className="h-40 bg-gray-100 flex items-center justify-center">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0].url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl">📦</span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 leading-tight">
                        {truncate(product.name, 40)}
                      </h3>
                      <Badge status={product.status} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">SKU: {product.sku}</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-base font-bold text-gray-900">
                        {formatCurrency(parseFloat(product.price))}
                      </span>
                      <span className="text-xs text-gray-500">{product.inventory} in stock</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {data?.meta && data.meta.totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {page} of {data.meta.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}

            {!data?.data?.length && (
              <div className="text-center py-20 text-gray-400">
                <span className="text-5xl">📦</span>
                <p className="mt-4 text-sm">No products found. Sync your store to get started.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
