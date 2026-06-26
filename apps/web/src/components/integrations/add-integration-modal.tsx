'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useRegisterIntegration } from '@/lib/api';

type Platform = 'shopify' | 'woocommerce' | 'odoo' | 'erpnext' | 'retailman';

interface CredentialField {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'password' | 'url';
  required?: boolean;
}

const PLATFORM_FIELDS: Record<Platform, CredentialField[]> = {
  shopify: [
    { key: 'shopDomain', label: 'Shop Domain', placeholder: 'my-store.myshopify.com', required: true },
    { key: 'accessToken', label: 'Access Token', placeholder: 'shpat_xxx', type: 'password', required: true },
    { key: 'apiVersion', label: 'API Version', placeholder: '2024-01' },
  ],
  woocommerce: [
    { key: 'baseUrl', label: 'Store URL', placeholder: 'https://my-store.com', type: 'url', required: true },
    { key: 'consumerKey', label: 'Consumer Key', placeholder: 'ck_xxx', required: true },
    { key: 'consumerSecret', label: 'Consumer Secret', placeholder: 'cs_xxx', type: 'password', required: true },
  ],
  odoo: [
    { key: 'baseUrl', label: 'Odoo URL', placeholder: 'https://my-odoo.com', type: 'url', required: true },
    { key: 'database', label: 'Database', placeholder: 'my_database', required: true },
    { key: 'username', label: 'Username', placeholder: 'admin', required: true },
    { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password', required: true },
  ],
  erpnext: [
    { key: 'baseUrl', label: 'ERPNext URL', placeholder: 'https://my-erpnext.com', type: 'url', required: true },
    { key: 'apiKey', label: 'API Key', placeholder: 'your_api_key', required: true },
    { key: 'apiSecret', label: 'API Secret', placeholder: 'your_api_secret', type: 'password', required: true },
  ],
  retailman: [
    { key: 'baseUrl', label: 'Base URL', placeholder: 'https://api.retailman.com', type: 'url', required: true },
    { key: 'apiKey', label: 'API Key', placeholder: 'your_api_key', type: 'password', required: true },
  ],
};

const PLATFORMS: { value: Platform; label: string; icon: string }[] = [
  { value: 'shopify', label: 'Shopify', icon: '🛍️' },
  { value: 'woocommerce', label: 'WooCommerce', icon: '🛒' },
  { value: 'odoo', label: 'Odoo', icon: '⚙️' },
  { value: 'erpnext', label: 'ERPNext', icon: '🏭' },
  { value: 'retailman', label: 'RetailMan', icon: '🏪' },
];

interface AddIntegrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddIntegrationModal({ open, onOpenChange }: AddIntegrationModalProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [webhookSecret, setWebhookSecret] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { mutate: register, isPending } = useRegisterIntegration();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlatform) return;
    setError(null);

    register(
      { type: selectedPlatform, credentials, webhookSecret: webhookSecret || undefined },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSelectedPlatform(null);
          setCredentials({});
          setWebhookSecret('');
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : 'Failed to connect';
          setError(message);
        },
      }
    );
  };

  const fields = selectedPlatform ? PLATFORM_FIELDS[selectedPlatform] : [];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add Integration"
      description="Connect your store or ERP system to SocialCart"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Platform Selector */}
        {!selectedPlatform ? (
          <div>
            <p className="text-sm text-gray-600 mb-3">Select a platform to connect:</p>
            <div className="grid grid-cols-2 gap-3">
              {PLATFORMS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setSelectedPlatform(p.value)}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl hover:border-brand-400 hover:bg-brand-50 transition-all text-left"
                >
                  <span className="text-2xl">{p.icon}</span>
                  <span className="font-medium text-gray-900">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Back button */}
            <button
              type="button"
              onClick={() => { setSelectedPlatform(null); setCredentials({}); }}
              className="text-sm text-brand-600 hover:text-brand-700"
            >
              ← Change platform
            </button>

            {/* Credential fields */}
            <div className="space-y-3">
              {fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <input
                    type={field.type ?? 'text'}
                    placeholder={field.placeholder}
                    value={credentials[field.key] ?? ''}
                    onChange={(e) => setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    required={field.required}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
              ))}

              {/* Webhook secret (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Webhook Secret <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="password"
                  placeholder="For signature verification"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" loading={isPending}>
                Connect
              </Button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
