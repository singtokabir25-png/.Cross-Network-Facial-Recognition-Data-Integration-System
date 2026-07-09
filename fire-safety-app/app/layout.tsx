import type { Metadata, Viewport } from "next"; // เพิ่ม Viewport ตรงนี้
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// แยก Viewport ออกมา (วิธีที่ถูกต้องสำหรับ Next.js 14+)
export const viewport: Viewport = {
  themeColor: "#ef4444",
};

export const metadata: Metadata = {
  title: "Fire Safety System",
  description: "ระบบบริหารจัดการและตรวจเช็คถังดับเพลิง",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",     // ระบบจะไปหาไฟล์ public/icon.png
    shortcut: "/icon.png",
    apple: "/icon.png",    // สำหรับ iPhone
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th"> 
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}