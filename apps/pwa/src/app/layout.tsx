import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SocialCart Shop',
  description: 'Shop directly on WhatsApp',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SocialCart',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    siteName: 'SocialCart',
    title: 'SocialCart Shop',
    description: 'Shop directly on WhatsApp',
  },
};

export const viewport: Viewport = {
  themeColor: '#25D366',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="h-full bg-[#ECE5DD]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
