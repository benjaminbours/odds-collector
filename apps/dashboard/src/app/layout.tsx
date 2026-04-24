import type { Metadata } from 'next';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import '@/styles/globals.css';

const BASE_URL = 'https://market.oddslab.gg';

export const metadata: Metadata = {
  title: {
    default: 'OddsLab - Bookmaker Intelligence',
    template: '%s | OddsLab',
  },
  description:
    'Track odds movements and steam moves for Premier League and Serie A. Identify sharp money, value bets, and bookmaker sentiment in real time.',
  metadataBase: new URL(BASE_URL),
  openGraph: {
    siteName: 'OddsLab',
    type: 'website',
    locale: 'en_GB',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Navigation />
        <main className="container">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
