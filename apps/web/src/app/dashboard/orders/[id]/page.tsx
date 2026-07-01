'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowLeft, Package, User, MapPin, CreditCard, Truck,
  CheckCircle2, Loader2, ChevronDown, ExternalLink,
} from 'lucide-react';
import { useOrderDetail, useUpdateOrder } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDateTime, formatPhone, platformLabel } from '@/lib/utils';

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
const PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded'];

function StatusDropdown({
  label,
  current,
  options,
  onSelect,
  disabled,
}: {
  label: string;
  current: string;
  options: string[];
  onSelect: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:border-gray-300 transition-colors disabled:opacity-50"
      >
        <span className="capitalize text-gray-700">{current}</span>
        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-20 top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[160px] py-1">
          <p className="px-3 py-1 text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => { onSelect(opt); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-sm capitalize hover:bg-gray-50 transition-colors flex items-center justify-between"
            >
              {opt}
              {opt === current && <CheckCircle2 className="h-3.5 w-3.5 text-[#25D366]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: order, isLoading } = useOrderDetail(id);
  const update = useUpdateOrder(id);
  const [trackingInput, setTrackingInput] = useState('');
  const [showTracking, setShowTracking] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Order not found.</p>
        <button onClick={() => router.back()} className="mt-3 text-sm text-[#25D366] hover:underline">Go back</button>
      </div>
    );
  }

  const addr = order.shippingAddress as Record<string, string> | null;
  const trackingNumber = addr?.['trackingNumber'];
  const subtotal = parseFloat(order.subtotal ?? '0');
  const tax = parseFloat(order.tax ?? '0');
  const shipping = parseFloat(order.shipping ?? '0');
  const discount = parseFloat(order.discount ?? '0');
  const total = parseFloat(order.total);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              Order #{order.externalId ?? order.id.slice(0, 8).toUpperCase()}
            </h1>
            <p className="text-sm text-gray-400">
              {order.source ? platformLabel(order.source) : 'Manual'} · {formatDateTime(order.createdAt)}
            </p>
          </div>
        </div>

        {/* Status controls */}
        <div className="flex items-center gap-2">
          <StatusDropdown
            label="Order status"
            current={order.status}
            options={ORDER_STATUSES}
            disabled={update.isPending}
            onSelect={(status) => update.mutate({ status })}
          />
          <StatusDropdown
            label="Payment"
            current={order.paymentStatus}
            options={PAYMENT_STATUSES}
            disabled={update.isPending}
            onSelect={(paymentStatus) => update.mutate({ paymentStatus })}
          />
          {update.isPending && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
        </div>
      </div>

      <div className="p-6 max-w-5xl space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: items + totals */}
          <div className="lg:col-span-2 space-y-5">
            {/* Line items */}
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-500" />
                <h2 className="font-semibold text-gray-900">Items</h2>
              </div>
              {order.items?.length ? (
                <>
                  <div className="divide-y divide-gray-50">
                    {order.items.map((item, i) => (
                      <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{item.name}</p>
                          {item.sku && <p className="text-xs text-gray-400">SKU: {item.sku}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm text-gray-600">×{item.qty ?? item.quantity ?? 1}</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {formatCurrency(item.price * (item.qty ?? item.quantity ?? 1))}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Totals */}
                  <div className="px-5 py-4 border-t border-gray-100 space-y-1.5">
                    {subtotal > 0 && (
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Subtotal</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                    )}
                    {discount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Discount</span>
                        <span>-{formatCurrency(discount)}</span>
                      </div>
                    )}
                    {shipping > 0 && (
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Shipping</span>
                        <span>{formatCurrency(shipping)}</span>
                      </div>
                    )}
                    {tax > 0 && (
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Tax</span>
                        <span>{formatCurrency(tax)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-100">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="px-5 py-8 text-center text-sm text-gray-400">No line items recorded</p>
              )}
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-900 mb-2">Notes</h2>
                <p className="text-sm text-gray-600">{order.notes}</p>
              </div>
            )}
          </div>

          {/* Right: customer + shipping + tracking */}
          <div className="space-y-4">
            {/* Customer */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-gray-500" />
                <h2 className="font-semibold text-gray-900">Customer</h2>
              </div>
              <div className="space-y-1.5">
                <Link
                  href={`/dashboard/customers/${order.customer.id}`}
                  className="text-sm font-medium text-[#25D366] hover:underline flex items-center gap-1"
                >
                  {order.customer.name}
                  <ExternalLink className="h-3 w-3" />
                </Link>
                <p className="text-sm text-gray-600">{formatPhone(order.customer.phone)}</p>
                {order.customer.email && <p className="text-sm text-gray-500">{order.customer.email}</p>}
              </div>
            </div>

            {/* Shipping address */}
            {addr && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  <h2 className="font-semibold text-gray-900">Shipping Address</h2>
                </div>
                <div className="text-sm text-gray-600 space-y-0.5">
                  {addr['name'] && <p className="font-medium text-gray-900">{addr['name']}</p>}
                  {addr['address1'] && <p>{addr['address1']}</p>}
                  {addr['address2'] && <p>{addr['address2']}</p>}
                  {(addr['city'] || addr['province'] || addr['zip']) && (
                    <p>{[addr['city'], addr['province'], addr['zip']].filter(Boolean).join(', ')}</p>
                  )}
                  {addr['country'] && <p>{addr['country']}</p>}
                </div>
              </div>
            )}

            {/* Payment */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-4 w-4 text-gray-500" />
                <h2 className="font-semibold text-gray-900">Payment</h2>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status</span>
                  <Badge status={order.paymentStatus} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total</span>
                  <span className="text-sm font-semibold">{formatCurrency(total)} {order.currency}</span>
                </div>
              </div>
            </div>

            {/* Tracking */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-gray-500" />
                  <h2 className="font-semibold text-gray-900">Tracking</h2>
                </div>
                <button
                  onClick={() => setShowTracking((s) => !s)}
                  className="text-xs text-[#25D366] hover:underline"
                >
                  {trackingNumber ? 'Update' : 'Add'}
                </button>
              </div>

              {trackingNumber && !showTracking && (
                <p className="text-sm font-mono text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{trackingNumber}</p>
              )}

              {showTracking && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={trackingInput}
                    onChange={(e) => setTrackingInput(e.target.value)}
                    placeholder="Enter tracking number"
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
                  />
                  <Button
                    size="sm"
                    disabled={!trackingInput.trim() || update.isPending}
                    onClick={() => {
                      update.mutate({ trackingNumber: trackingInput.trim() }, {
                        onSuccess: () => { setShowTracking(false); setTrackingInput(''); },
                      });
                    }}
                  >
                    Save
                  </Button>
                </div>
              )}

              {!trackingNumber && !showTracking && (
                <p className="text-sm text-gray-400">No tracking number yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
