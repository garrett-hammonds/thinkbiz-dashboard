// Dashboard Layout

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import NativeBridge from "@/components/native/NativeBridge";
import OfflineBanner from "@/components/native/OfflineBanner";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ThinkBiz Solutions - Dashboard",
  description: "Professional networking group dashboard for ThinkBiz Solutions members.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "ThinkBiz",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a73e8",
  width: "device-width",
  initialScale: 1,
  // Let the page extend under the notch / home indicator inside the native
  // shell; the header and drawer pad by env(safe-area-inset-*) themselves.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased font-sans`}>
        {/* Both render nothing in a browser; they only act inside the
            thinkbiz-mobile-app Capacitor shell. */}
        <NativeBridge />
        {children}
        <OfflineBanner />
      </body>
    </html>
  );
}
