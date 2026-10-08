import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NexTap | صفحة واحدة لكل تواصل", template: "%s | NexTap" },
  description: "بطاقات NFC وQR وصفحات أعمال عربية سهلة التحديث.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://nextab.services"),
  openGraph: { siteName: "NexTap", type: "website", locale: "ar_EG" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}