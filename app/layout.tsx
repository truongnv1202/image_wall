import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { notoSans } from "@/app/fonts";
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
  title: "Tường ảnh Hòa Bình",
  description: "Tường LED ảnh — chữ HÒA BÌNH ĐẸP LẮM từ ảnh màu chủ đạo",
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
