import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '富聯領導團隊工作台',
  description: '使用虛構測試資料的領導團隊編組、續約與培訓追蹤工作台。',
  openGraph: {
    title: '富聯領導團隊工作台',
    description: '使用虛構測試資料進行編組、續約與培訓追蹤。',
    type: 'website',
    locale: 'zh_TW',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: '富聯領導團隊工作台－編組、續約與培訓追蹤',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '富聯領導團隊工作台',
    description: '使用虛構測試資料進行編組、續約與培訓追蹤。',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
