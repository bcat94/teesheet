import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tee Sheet',
  description: 'Weekend golf, sorted.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Tee Sheet',
  },
  openGraph: {
    title: 'Tee Sheet',
    description: 'Weekend golf, sorted.',
    type: 'website',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1B4332',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-[430px] min-h-screen pb-10">{children}</div>
      </body>
    </html>
  );
}
