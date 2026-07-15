'use client';

import { useSearchParams } from 'next/navigation';
import { XCircle, RefreshCw, MessageSquare, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

function FailedContent() {
  const params = useSearchParams();
  const ref = params.get('reference') ?? params.get('tx_ref') ?? params.get('trxref');
  const reason = params.get('reason');

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
          <XCircle className="h-10 w-10 text-red-500" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h1>
        <p className="text-gray-600 mb-6">
          {reason ?? "We couldn't process your payment. No money was deducted from your account."}
        </p>

        {ref && (
          <div className="bg-gray-50 rounded-lg px-4 py-3 mb-6 text-left">
            <p className="text-xs text-gray-500 mb-1">Reference</p>
            <p className="text-sm font-mono font-medium text-gray-900 break-all">{ref}</p>
          </div>
        )}

        {/* Common reasons */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6 text-left">
          <p className="text-sm font-semibold text-amber-900 mb-2">Common reasons for failure:</p>
          <ul className="text-xs text-amber-800 space-y-1">
            <li>• Insufficient funds in your account</li>
            <li>• Card/transaction limit exceeded</li>
            <li>• Network issue during processing</li>
            <li>• Payment session expired</li>
          </ul>
        </div>

        <div className="space-y-3">
          {/* Try again — browser back will reload the payment link page */}
          <button
            onClick={() => window.history.back()}
            className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white rounded-xl px-4 py-3 text-sm font-semibold hover:bg-[#128C7E] transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>

          {/* WhatsApp support */}
          <div className="flex items-start gap-3 bg-[#25D366]/10 rounded-xl p-4 text-left">
            <MessageSquare className="h-5 w-5 text-[#25D366] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600">
              Need help? Reply to our WhatsApp message and an agent will assist you.
            </p>
          </div>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors mt-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to store
        </Link>
      </div>
    </div>
  );
}

export default function PaymentFailedPage() {
  return (
    <Suspense>
      <FailedContent />
    </Suspense>
  );
}
