import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClinicFlow | מכון פיזיותרפיה וריפוי בעיסוק",
  description: "מערכת ניהול למכון פיזיותרפיה וריפוי בעיסוק עם חיבור ל-Supabase",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ClinicFlow",
  },
  icons: {
    apple: "/apple-icon",
    icon: [
      { url: "/icon?size=192" },
      { url: "/icon?size=512" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#146c63",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
