import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "همراه کاریابی | JobMatch AI",
  description:
    "ایجنت هوشمند کاریابی: غربال آگهی‌ها با توضیح تناسب و ساخت رزومهٔ استاندارد",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
      <Toaster
        richColors
        position="top-center"
        toastOptions={{
          style: { fontFamily: "Vazirmatn, sans-serif", direction: "rtl" },
        }}
      />
    </html>
  );
}
