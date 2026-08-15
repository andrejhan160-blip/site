import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'CaseFlow', template: '%s · CaseFlow' },
  description: 'Платформа клиентских процессов для компаний, которые ведут долгие дела с документами.',
};

export const viewport: Viewport = {
  themeColor: '#1f6feb',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
