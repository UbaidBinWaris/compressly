import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Video Optimizer — Compressly",
  description:
    "Compress, convert, and resize videos to mp4 or webm. Powered by FFmpeg — free, no login required.",
};

export default function VideoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
