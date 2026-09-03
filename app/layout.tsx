import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LCDPROTO — 1.28\" Round Display Simulator",
  description:
    "Browser prototype for a 240x240 round ESP32 LCD device. UI and animation testing only.",
};

export const viewport: Viewport = {
  themeColor: "#050506",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-[#050506] antialiased">{children}</body>
    </html>
  );
}
