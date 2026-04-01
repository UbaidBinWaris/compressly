import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Compressly — Free Image Compressor",
  description:
    "Compress images to WebP under 100 KB instantly. Free, fast, no login required.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
