import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LCDPROTO — 1.43\" AMOLED Round Display Simulator",
  description:
    "Browser prototype for a 466x466 round ESP32-S3 AMOLED device. UI and animation testing only.",
};

export const viewport: Viewport = {
  themeColor: "#eaf1fa",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-simulator-theme="brown">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
