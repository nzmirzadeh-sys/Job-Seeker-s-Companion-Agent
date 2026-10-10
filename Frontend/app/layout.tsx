import type { Metadata, Viewport } from 'next';
import { Inter, Vazirmatn } from 'next/font/google';
import { Toaster } from 'sonner';
import AppNav from '@/components/app-nav';
import './globals.css';

const vazirmatn = Vazirmatn({
  subsets: ['arabic', 'latin'],
  variable: '--font-vazirmatn',
  weight: ['400', '500', '700', '900'],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'KARVIA | JobMatch AI',
  description:
    'ایجنت هوشمند کاریابی: غربال آگهی‌ها با توضیح تناسب و ساخت رزومهٔ استاندارد',
};

export const viewport: Viewport = {
  themeColor: '#070614',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className={`${vazirmatn.variable} ${inter.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#070614] text-white">
        <AppNav />
        {children}
        <Toaster
          theme="dark"
          richColors
          position="top-center"
          toastOptions={{
            style: { fontFamily: 'var(--font-vazirmatn), sans-serif', direction: 'rtl' },
          }}
        />
      </body>
    </html>
  );
}
