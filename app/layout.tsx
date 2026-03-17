import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'APG Flight Agent — TAN PHU APG',
  description: 'So sánh giá vé máy bay. Đặt vé qua TAN PHU APG.',
  keywords: 'vé máy bay, đặt vé, TAN PHU APG, Hà Nội, TP.HCM, giá rẻ',
  metadataBase: new URL('https://book.tanphuapg.com'),
  openGraph: {
    title: 'APG Flight Agent — TAN PHU APG',
    description: 'So sánh giá vé máy bay nội địa & quốc tế. Đặt vé qua TAN PHU APG.',
    url: 'https://book.tanphuapg.com',
    siteName: 'TAN PHU APG',
    images: [
      {
        url: '/assets/tanphu-apg-logo.jpg',
        width: 800,
        height: 800,
        alt: 'TAN PHU APG - Đại lý vé máy bay',
      },
    ],
    locale: 'vi_VN',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'APG Flight Agent — TAN PHU APG',
    description: 'So sánh giá vé máy bay. Đặt vé qua TAN PHU APG.',
    images: ['/assets/tanphu-apg-logo.jpg'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
