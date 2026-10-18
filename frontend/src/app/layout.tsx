import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { getCurrentUser } from '@/lib/server';

export const metadata: Metadata = {
  title: 'BazaarHub — Shop from trusted local & national sellers',
  description: 'Multi-vendor marketplace for groceries, fashion, electronics, beauty, home and more.',
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body>
        <Providers initialUser={user}>{children}</Providers>
      </body>
    </html>
  );
}
