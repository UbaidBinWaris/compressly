import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Documentation — Compressly",
  description:
    "Complete developer reference for the Compressly image compression API. Endpoints, request/response formats, examples, and architecture.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
