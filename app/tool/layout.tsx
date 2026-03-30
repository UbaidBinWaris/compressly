import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Image Compressor — Compressly",
  description:
    "Compress JPEG, PNG, WebP, AVIF and GIF images to the perfect target size with maximum quality. Free, no login required.",
};

export default function ToolLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
