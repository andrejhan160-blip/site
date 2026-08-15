import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'CaseFlow', template: '%s · CaseFlow' },
  description: 'Client operations platform for document-heavy professional services.',
};

export const viewport: Viewport = {
  themeColor: '#1f6feb',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
