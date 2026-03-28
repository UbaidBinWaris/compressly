import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics Dashboard — Compressly",
  description: "Real-time usage analytics for the Compressly image compression platform.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
