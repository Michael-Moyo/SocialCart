'use client';

import { useSearchParams } from 'next/navigation';
import { CheckCircle2, MessageSquare, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

function SuccessContent() {
  const params = useSearchParams();
  const ref = params.get('reference') ?? params.get('tx_ref') ?? params.get('trxref');

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        {/* Animated checkmark */}
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6 animate-bounce-once">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
        <p className="text-gray-600 mb-6">
          Your payment has been confirmed. We&apos;re processing your order and you&apos;ll receive a WhatsApp message shortly.
        </p>

        {ref && (
          <div className="bg-gray-50 rounded-lg px-4 py-3 mb-6 text-left">
            <p className="text-xs text-gray-500 mb-1">Transaction Reference</p>
            <p className="text-sm font-mono font-medium text-gray-900 break-all">{ref}</p>
          </div>
        )}

        {/* WhatsApp message hint */}
        <div className="flex items-start gap-3 bg-[#25D366]/10 rounded-xl p-4 mb-6 text-left">
          <MessageSquare className="h-5 w-5 text-[#25D366] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-gray-900">What happens next?</p>
            <p className="text-xs text-gray-600 mt-1">
              You&apos;ll receive a WhatsApp confirmation message with your order details. Keep an eye on your chat!
            </p>
          </div>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to store
        </Link>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
