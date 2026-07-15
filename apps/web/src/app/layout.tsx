import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { ServiceWorkerRegistrar } from '@/components/notifications/sw-registrar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SocialCart — WhatsApp Commerce Platform',
  description: 'Sell more on WhatsApp. Connect your store and sell directly in chat.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
