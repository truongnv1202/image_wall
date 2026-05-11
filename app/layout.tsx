import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { notoSans } from "@/app/fonts";
import { SWRProvider } from "@/components/SWRProvider";
import { SITE_DOMAIN, SITE_ORIGIN_HTTPS } from "@/lib/siteConfig";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN_HTTPS),
  title: "Tường ảnh tương tác — Triển lãm",
  description: `Lưới LED ảnh (${SITE_DOMAIN}) — mask canvas chữ HÒA BÌNH ĐẸP LẮM, polling ảnh mới.`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SWRProvider>{children}</SWRProvider>
      </body>
    </html>
  );
}
