import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NexTap | بطاقة واحدة، صفحة واحدة", template: "%s | NexTap" },
  description: "بطاقات NFC وQR تفتح صفحات أعمال سريعة للأنشطة المصرية.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://nextab.services"),
  openGraph: {
    siteName: "NexTap",
    type: "website",
    locale: "ar_EG",
    title: "NexTap | بطاقة واحدة، صفحة واحدة",
    description: "بطاقات NFC وQR تفتح صفحات أعمال سريعة للأنشطة المصرية.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
