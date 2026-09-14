import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "SistAbsen - Aplikasi Absensi QR Sekolah",
  description: "Sistem manajemen absensi berbasis QR Code untuk siswa, guru, dan mata pelajaran.",
  keywords: ["absensi", "QR code", "sekolah", "siswa", "guru", "SistAbsen"],
  authors: [{ name: "SistAbsen" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}