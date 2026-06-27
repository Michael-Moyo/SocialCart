'use client';

import { useState } from 'react';
import { RefreshCw, Search, Plus, Pencil, Trash2, X, PackageOpen } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  type Product,
} from '@/lib/api';
import { formatCurrency, truncate } from '@/lib/utils';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

// ─── Product Form Modal ────────────────────────────────────────────────────────

interface ProductFormState {
  name: string;
  description: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  currency: string;
  inventory: string;
  categories: string;
  status: 'active' | 'inactive' | 'draft';
}

const EMPTY_FORM: ProductFormState = {
  name: '', description: '', sku: '', price: '', compareAtPrice: '',
  currency: 'NGN', inventory: '0', categories: '', status: 'active',
};

function productToForm(p: Product): ProductFormState {
  return {
    name: p.name,
    description: p.description ?? '',
    sku: p.sku,
    price: parseFloat(p.price).toString(),
    compareAtPrice: p.compareAtPrice ? parseFloat(p.compareAtPrice).toString() : '',
    currency: 'NGN',
    inventory: p.inventory.toString(),
    categories: p.categories.join(', '),
    status: p.status as 'active' | 'inactive' | 'draft',
  };
}

function ProductModal({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const create = useCreateProduct();
  const update = useUpdateProduct(product?.id ?? '');
  const [form, setForm] = useState<ProductFormState>(product ? productToForm(product) : EMPTY_FORM);
  const [error, setError] = useState('');

  function set<K extends keyof ProductFormState>(key: K, val: ProductFormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Product name is required'); return; }
    const price = parseFloat(form.price);
    if (isNaN(price) || price <= 0) { setError('Price must be a positive number'); return; }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      sku: form.sku.trim() || undefined,
      price,
      compareAtPrice: form.compareAtPrice ? parseFloat(form.compareAtPrice) : undefined,
      currency: form.currency,
      inventory: parseInt(form.inventory, 10) || 0,
      categories: form.categories ? form.categories.split(',').map((s) => s.trim()).filter(Boolean) : [],
      status: form.status,
    };

    const mutation = product ? update : create;
    (mutation as typeof create).mutate(payload as Parameters<typeof create.mutate>[0], {
      onSuccess: onClose,
      onError: () => setError('Failed to save product. Please try again.'),
    });
  }

  const isPending = create.isPending || update.isPending;

  return (
    <Modal title={product ? 'Edit Product' : 'Add Product'} onClose={onClose}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
            <input
              type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Premium Cotton T-Shirt"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description} onChange={(e) => set('description', e.target.value)}
              rows={3} placeholder="Product description…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
            <input
              type="text" value={form.sku} onChange={(e) => set('sku', e.target.value)}
              placeholder="e.g. SHIRT-M-BLK"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={form.status} onChange={(e) => set('status', e.target.value as 'active' | 'inactive' | 'draft')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
            <div className="flex gap-2">
              <select
                value={form.currency} onChange={(e) => set('currency', e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30"
              >
                {['NGN', 'GHS', 'KES', 'ZAR', 'USD', 'GBP'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="number" min="0" step="0.01" value={form.price}
                onChange={(e) => set('price', e.target.value)}
                placeholder="0.00"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Compare-at Price</label>
            <input
              type="number" min="0" step="0.01" value={form.compareAtPrice}
              onChange={(e) => set('compareAtPrice', e.target.value)}
              placeholder="Original price (for sale display)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Inventory</label>
            <input
              type="number" min="0" step="1" value={form.inventory}
              onChange={(e) => set('inventory', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categories</label>
            <input
              type="text" value={form.categories}
              onChange={(e) => set('categories', e.target.value)}
              placeholder="e.g. Clothing, T-Shirts (comma separated)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isPending} loading={isPending} className="flex-1">
            {product ? 'Save Changes' : 'Add Product'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Delete Confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({ product, onClose }: { product: Product; onClose: () => void }) {
  const del = useDeleteProduct();
  return (
    <Modal title="Delete Product" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Are you sure you want to delete <strong>{product.name}</strong>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => del.mutate(product.id, { onSuccess: onClose })}
            loading={del.isPending}
            disabled={del.isPending}
          >
            Delete
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Status filter chips ───────────────────────────────────────────────────────

const STATUS_FILTERS = ['all', 'active', 'draft', 'inactive'];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null | 'new'>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);

  const { data, isLoading, refetch } = useProducts({
    page,
    limit: 20,
    search: search || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

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
    <div className="flex-1 overflow-y-auto">
      <Header
        title="Products"
        description="Manage your product catalogue"
        actions={
          <Button size="sm" onClick={() => setEditProduct('new')} className="flex items-center gap-1.5">
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search products…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
            />
          </div>

          {/* Status chips */}
          <div className="flex gap-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors',
                  statusFilter === s
                    ? 'bg-[#25D366] text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                )}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={handleSync} loading={syncing} className="ml-auto">
            <RefreshCw className="h-3.5 w-3.5" />
            Sync from store
          </Button>
        </div>

        {/* Product Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 h-64 animate-pulse" />
            ))}
          </div>
        ) : data?.data?.length ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {data.data.map((product) => (
                <div key={product.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden group relative">
                  {/* Product Image */}
                  <div className="h-40 bg-gray-100 flex items-center justify-center overflow-hidden">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0].url}
                        alt={product.name}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <PackageOpen className="h-10 w-10 text-gray-300" />
                    )}
                  </div>

                  {/* Action overlay */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditProduct(product)}
                      className="p-1.5 bg-white rounded-lg shadow-sm border border-gray-200 text-gray-500 hover:text-gray-900"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteProduct(product)}
                      className="p-1.5 bg-white rounded-lg shadow-sm border border-gray-200 text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-900 leading-tight">
                        {truncate(product.name, 40)}
                      </h3>
                      <Badge status={product.status} />
                    </div>
                    <p className="text-xs text-gray-400">SKU: {product.sku}</p>
                    {product.categories?.length > 0 && (
                      <p className="text-xs text-gray-400 truncate">{product.categories.slice(0, 2).join(', ')}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <div>
                        <span className="text-base font-bold text-gray-900">
                          {formatCurrency(parseFloat(product.price))}
                        </span>
                        {product.compareAtPrice && (
                          <span className="text-xs text-gray-400 line-through ml-1.5">
                            {formatCurrency(parseFloat(product.compareAtPrice))}
                          </span>
                        )}
                      </div>
                      <span className={cn(
                        'text-xs',
                        product.inventory === 0 ? 'text-red-500 font-medium' : 'text-gray-500'
                      )}>
                        {product.inventory === 0 ? 'Out of stock' : `${product.inventory} left`}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {data.meta && data.meta.totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-4">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {page} of {data.meta.totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20 text-gray-400">
            <PackageOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">No products found</p>
            <p className="text-xs mt-1 mb-4">Add a manual product or sync from your connected store.</p>
            <Button size="sm" onClick={() => setEditProduct('new')}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Product
            </Button>
          </div>
        )}
      </div>

      {/* Modals */}
      {(editProduct === 'new' || (editProduct && editProduct !== 'new')) && (
        <ProductModal
          product={editProduct === 'new' ? null : editProduct}
          onClose={() => setEditProduct(null)}
        />
      )}
      {deleteProduct && (
        <DeleteConfirm product={deleteProduct} onClose={() => setDeleteProduct(null)} />
      )}
    </div>
  );
}
