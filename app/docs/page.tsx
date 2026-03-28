"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────

const METHOD_COLORS = {
  POST: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  GET: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  DELETE: "bg-red-500/20 text-red-300 border-red-500/30",
};

const BADGE_COLORS = {
  indigo: "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  violet: "bg-violet-500/15 text-violet-300 border-violet-500/25",
  slate: "bg-slate-700/60 text-slate-300 border-slate-600/50",
  sky: "bg-sky-500/15 text-sky-300 border-sky-500/25",
};

// ─────────────────────────────────────────────────────────────────────────────
// Primitive components
// ─────────────────────────────────────────────────────────────────────────────

function Badge({
  children,
  color = "indigo",
}: {
  children: string;
  color?: keyof typeof BADGE_COLORS;
}) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${BADGE_COLORS[color]}`}
    >
      {children}
    </span>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-slate-800 text-indigo-300 text-[12px] font-mono px-1.5 py-0.5 rounded-md border border-slate-700/50">
      {children}
    </code>
  );
}

function Code({
  children,
  label,
}: {
  children: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silent
    }
  };

  return (
    <div className="group relative rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
      {label && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/60">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            {label}
          </span>
        </div>
      )}
      <button
        onClick={handleCopy}
        title="Copy"
        className={[
          "absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border transition-all",
          "opacity-0 group-hover:opacity-100",
          copied
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
            : "border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200",
        ].join(" ")}
      >
        {copied ? (
          <>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Copied
          </>
        ) : (
          <>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
            </svg>
            Copy
          </>
        )}
      </button>
      <pre className="p-5 text-sm text-slate-300 font-mono overflow-x-auto leading-relaxed whitespace-pre">
        {children.trim()}
      </pre>
    </div>
  );
}

function Callout({
  type = "info",
  title,
  children,
}: {
  type?: "info" | "warning" | "tip" | "danger";
  title?: string;
  children: React.ReactNode;
}) {
  const styles = {
    info: { border: "border-indigo-500/25", bg: "bg-indigo-500/5", icon: "ℹ️", titleColor: "text-indigo-300" },
    warning: { border: "border-amber-500/25", bg: "bg-amber-500/5", icon: "⚠️", titleColor: "text-amber-300" },
    tip: { border: "border-emerald-500/25", bg: "bg-emerald-500/5", icon: "💡", titleColor: "text-emerald-300" },
    danger: { border: "border-red-500/25", bg: "bg-red-500/5", icon: "🚨", titleColor: "text-red-300" },
  };
  const s = styles[type];
  return (
    <div className={`flex gap-3.5 rounded-xl border ${s.border} ${s.bg} p-4`}>
      <span className="text-base shrink-0 mt-0.5">{s.icon}</span>
      <div>
        {title && (
          <p className={`text-sm font-semibold mb-1 ${s.titleColor}`}>{title}</p>
        )}
        <div className="text-sm text-slate-400 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function ParamRow({
  name,
  type,
  required,
  description,
}: {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}) {
  return (
    <tr className="border-t border-slate-800/60">
      <td className="py-3 pr-4 align-top">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[13px] text-indigo-300">{name}</span>
          {required && (
            <span className="text-[10px] font-semibold text-red-400 border border-red-500/30 px-1.5 py-px rounded">
              required
            </span>
          )}
        </div>
      </td>
      <td className="py-3 pr-4 align-top">
        <span className="font-mono text-[12px] text-slate-500">{type}</span>
      </td>
      <td className="py-3 align-top text-sm text-slate-400 leading-relaxed">{description}</td>
    </tr>
  );
}

function Endpoint({
  id,
  method,
  path,
  description,
  children,
}: {
  id: string;
  method: keyof typeof METHOD_COLORS;
  path: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="flex flex-col gap-5 rounded-xl border border-slate-800 bg-slate-900/30 p-6 scroll-mt-24">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border font-mono ${METHOD_COLORS[method]}`}
          >
            {method}
          </span>
          <code className="text-slate-100 font-mono text-sm font-semibold tracking-tight">
            {path}
          </code>
        </div>
        <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
      {children}
    </h3>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Navigation structure
// ─────────────────────────────────────────────────────────────────────────────

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "architecture", label: "Architecture" },
  { id: "authentication", label: "Authentication" },
  {
    id: "endpoints",
    label: "Endpoints",
    children: [
      { id: "ep-compress", label: "POST /api/compress" },
      { id: "ep-status", label: "GET /api/status/:jobId" },
      { id: "ep-result", label: "GET /api/result/:jobId" },
      { id: "ep-reoptimize", label: "POST /api/reoptimize" },
      { id: "ep-zip", label: "POST /api/download-zip" },
    ],
  },
  { id: "compression", label: "Compression Engine" },
  { id: "caching", label: "Caching System" },
  { id: "storage", label: "File Storage" },
  { id: "security", label: "Security" },
  { id: "performance", label: "Performance" },
  { id: "examples", label: "Examples" },
  { id: "errors", label: "Error Reference" },
  { id: "cli", label: "CLI Tool" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Scrollspy hook
// ─────────────────────────────────────────────────────────────────────────────

function useScrollspy(ids: string[]) {
  const [active, setActive] = useState(ids[0]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost visible section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: "-10% 0px -80% 0px", threshold: 0 }
    );

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [ids]);

  return active;
}

// ─────────────────────────────────────────────────────────────────────────────
// Docs page
// ─────────────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const allIds = NAV.flatMap((n) =>
    n.children ? [n.id, ...n.children.map((c) => c.id)] : [n.id]
  );
  const activeId = useScrollspy(allIds);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Scroll active nav item into view within the sidebar
  useEffect(() => {
    const el = sidebarRef.current?.querySelector(`[data-id="${activeId}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#020617]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                  />
                </svg>
              </div>
              <span className="text-base font-semibold group-hover:text-indigo-300 transition-colors">
                Compressly
              </span>
            </Link>
            <span className="text-slate-700 select-none">/</span>
            <span className="text-slate-400 text-sm font-medium">API Reference</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge color="emerald">v1.0</Badge>
            <Link
              href="/"
              className="text-xs text-slate-400 hover:text-slate-200 font-medium transition-colors"
            >
              ← Back to App
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-14 flex gap-10 xl:gap-14">
        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside
          ref={sidebarRef}
          className="hidden lg:flex flex-col gap-0.5 w-56 xl:w-60 shrink-0 sticky top-[73px] self-start max-h-[calc(100vh-96px)] overflow-y-auto pb-8"
        >
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3 px-3">
            On this page
          </p>
          {NAV.map((item) => (
            <div key={item.id}>
              <a
                href={`#${item.id}`}
                data-id={item.id}
                className={[
                  "flex items-center py-1.5 px-3 rounded-lg text-sm transition-colors",
                  activeId === item.id
                    ? "text-indigo-400 bg-indigo-500/10 font-medium"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50",
                ].join(" ")}
              >
                {item.label}
              </a>
              {item.children && (
                <div className="ml-3 flex flex-col gap-0 border-l border-slate-800 pl-3 mt-0.5 mb-1">
                  {item.children.map((child) => (
                    <a
                      key={child.id}
                      href={`#${child.id}`}
                      data-id={child.id}
                      className={[
                        "flex items-center py-1 text-[12px] transition-colors rounded-md px-2",
                        activeId === child.id
                          ? "text-indigo-400 font-medium"
                          : "text-slate-500 hover:text-slate-300",
                      ].join(" ")}
                    >
                      {child.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </aside>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 flex flex-col gap-20 pb-24">

          {/* ── HERO ──────────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-5 border-b border-slate-800 pb-14">
            <div className="flex flex-wrap gap-2">
              <Badge color="indigo">WebP</Badge>
              <Badge color="violet">AVIF</Badge>
              <Badge color="sky">PNG</Badge>
              <Badge color="amber">JPEG</Badge>
              <Badge color="emerald">Queue + Cache</Badge>
              <Badge color="slate">Free & Fast</Badge>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white leading-tight">
              Compressly
              <br />
              <span className="text-slate-400 font-normal text-2xl">API Documentation</span>
            </h1>
            <p className="text-slate-400 text-base leading-relaxed max-w-2xl">
              Fast, developer-first image optimization with smart binary-search compression.
              Self-hosted, zero dependencies beyond Node and optionally Redis.
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-slate-500 font-mono">
              <span className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                Base URL: http://localhost:3000
              </span>
              <span className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
                REST · multipart/form-data · application/json
              </span>
              <span className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                30 req/min · 20 MB max · 20 files/request
              </span>
            </div>
          </div>

          {/* ── OVERVIEW ──────────────────────────────────────────────────── */}
          <section id="overview" className="flex flex-col gap-6 scroll-mt-24">
            <h2 className="text-2xl font-bold text-white border-b border-slate-800 pb-4">
              Overview
            </h2>
            <p className="text-slate-400 leading-relaxed">
              Compressly is a production-grade image optimization platform. Upload images via the
              web UI or API, and the engine automatically finds the{" "}
              <strong className="text-slate-200">highest quality that fits your target size</strong>{" "}
              using binary search. Identical uploads return instantly from a persistent SHA-256
              content cache.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  icon: "⚡",
                  title: "Sync Mode",
                  badge: "?sync=true",
                  desc: "Compresses inline and returns the result in the same HTTP response. Best for simple integrations or when Redis is unavailable.",
                },
                {
                  icon: "🔄",
                  title: "Async Mode",
                  badge: "Default",
                  desc: "Returns a jobId immediately. Poll /api/status/:jobId then fetch /api/result/:jobId. Handles large files and batch jobs without timeouts.",
                },
                {
                  icon: "⚡",
                  title: "Cache Hits",
                  badge: "Instant",
                  desc: "Same image + same options → same SHA-256 hash → instant return from /generated/cache, skipping all compression work.",
                },
                {
                  icon: "🔁",
                  title: "Re-optimize",
                  badge: "No re-upload",
                  desc: "Originals are preserved in uploads/tmp for 1 hour. Change settings and re-compress without uploading the file again.",
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{card.icon}</span>
                    <span className="font-semibold text-sm text-slate-200">{card.title}</span>
                    <InlineCode>{card.badge}</InlineCode>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <SubHeading>Supported Input Formats</SubHeading>
              <div className="flex flex-wrap gap-2 mt-3">
                {["JPEG", "PNG", "WebP", "GIF", "AVIF"].map((fmt) => (
                  <span
                    key={fmt}
                    className="font-mono text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-md"
                  >
                    {fmt}
                  </span>
                ))}
                <span className="text-xs text-slate-500 self-center ml-1">
                  Validated via magic bytes — file extension is ignored
                </span>
              </div>
            </div>
          </section>

          {/* ── ARCHITECTURE ──────────────────────────────────────────────── */}
          <section id="architecture" className="flex flex-col gap-6 scroll-mt-24">
            <h2 className="text-2xl font-bold text-white border-b border-slate-800 pb-4">
              Architecture
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Every request passes through the same pipeline. Steps short-circuit early when
              possible — a cache hit skips compression entirely.
            </p>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 overflow-x-auto">
              <div className="flex flex-col gap-0 min-w-[320px]">
                {[
                  {
                    step: "01",
                    label: "Rate Limit",
                    detail: "30 req/min per IP · sliding window",
                    color: "border-slate-700 bg-slate-800/60",
                    dot: "bg-slate-500",
                  },
                  {
                    step: "02",
                    label: "Magic Byte Validation",
                    detail: "Reads file header bytes — blocks spoofed MIME types",
                    color: "border-slate-700 bg-slate-800/60",
                    dot: "bg-slate-500",
                  },
                  {
                    step: "03",
                    label: "SHA-256 Hash",
                    detail: "Hash of (buffer + options) — deterministic cache key",
                    color: "border-slate-700 bg-slate-800/60",
                    dot: "bg-slate-500",
                  },
                  {
                    step: "04",
                    label: "Cache Check",
                    detail: "Hit? Return /generated/cache/<hash>.ext instantly",
                    color: "border-emerald-500/30 bg-emerald-500/5",
                    dot: "bg-emerald-500",
                    tag: "CACHE HIT →",
                  },
                  {
                    step: "05",
                    label: "Queue (or Sync Fallback)",
                    detail: "Redis available → enqueue BullMQ job and return jobId",
                    detail2: "Redis unavailable → compress inline",
                    color: "border-indigo-500/30 bg-indigo-500/5",
                    dot: "bg-indigo-500",
                  },
                  {
                    step: "06",
                    label: "Binary Search Compression",
                    detail: "sharp encodes at qualityStart, binary searches to targetSizeKB",
                    color: "border-slate-700 bg-slate-800/60",
                    dot: "bg-slate-500",
                  },
                  {
                    step: "07",
                    label: "Write to Cache",
                    detail: "Output copied to /generated/cache/<hash>.ext (persistent)",
                    color: "border-slate-700 bg-slate-800/60",
                    dot: "bg-slate-500",
                  },
                  {
                    step: "08",
                    label: "Response",
                    detail: "jobId (async) or {outputUrl, quality, ...} (sync/cache)",
                    color: "border-slate-700 bg-slate-800/60",
                    dot: "bg-slate-500",
                  },
                ].map((row, i, arr) => (
                  <div key={row.step} className="flex items-stretch gap-4">
                    {/* Spine */}
                    <div className="flex flex-col items-center w-8 shrink-0">
                      <div className={`w-2.5 h-2.5 rounded-full mt-4 shrink-0 ${row.dot}`} />
                      {i < arr.length - 1 && (
                        <div className="w-px flex-1 bg-slate-800 my-1" />
                      )}
                    </div>
                    {/* Card */}
                    <div className={`flex-1 rounded-lg border ${row.color} px-4 py-3 mb-1.5`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-600 font-mono">{row.step}</span>
                        <span className="text-sm font-semibold text-slate-200">{row.label}</span>
                        {row.tag && (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                            {row.tag}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{row.detail}</p>
                      {row.detail2 && (
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{row.detail2}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── AUTHENTICATION ────────────────────────────────────────────── */}
          <section id="authentication" className="flex flex-col gap-6 scroll-mt-24">
            <h2 className="text-2xl font-bold text-white border-b border-slate-800 pb-4">
              Authentication
            </h2>
            <Callout type="warning" title="No authentication required (v1)">
              The API is currently open. Protection is provided by IP-based rate limiting only.
              API key authentication is planned for a future release.
            </Callout>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 flex flex-col gap-4">
              <p className="text-sm font-semibold text-slate-300">Rate Limit Response Headers</p>
              <p className="text-sm text-slate-400">
                All <InlineCode>POST /api/compress</InlineCode> responses include these headers:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <tbody>
                    {[
                      ["X-RateLimit-Limit", "30", "Maximum requests per minute"],
                      ["X-RateLimit-Remaining", "27", "Remaining requests in the current window"],
                      ["X-RateLimit-Reset", "1743093600", "Unix timestamp when the window resets"],
                      ["Retry-After", "42", "Seconds to wait (only present on 429 responses)"],
                    ].map(([header, example, desc]) => (
                      <tr key={header} className="border-t border-slate-800">
                        <td className="py-2.5 pr-4 font-mono text-indigo-300 align-top whitespace-nowrap">
                          {header}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-slate-500 align-top whitespace-nowrap">
                          {example}
                        </td>
                        <td className="py-2.5 text-slate-400 align-top">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ── ENDPOINTS ─────────────────────────────────────────────────── */}
          <section id="endpoints" className="flex flex-col gap-8 scroll-mt-24">
            <h2 className="text-2xl font-bold text-white border-b border-slate-800 pb-4">
              Endpoints
            </h2>

            {/* POST /api/compress */}
            <Endpoint
              id="ep-compress"
              method="POST"
              path="/api/compress"
              description="Upload one or more images for compression. Supports async queue mode (default when Redis is available) and synchronous mode via ?sync=true."
            >
              <Callout type="tip">
                Append <InlineCode>?sync=true</InlineCode> to force synchronous processing and
                get results in a single request — useful for scripts and CLI tools.
              </Callout>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="flex flex-col gap-4">
                  <SubHeading>Request — multipart/form-data</SubHeading>
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/60">
                          <th className="text-left py-2.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Field
                          </th>
                          <th className="text-left py-2.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="text-left py-2.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Description
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <ParamRow
                          name="files"
                          type="File[]"
                          required
                          description="One or more image files. Max 20 per request, 20 MB each."
                        />
                        <ParamRow
                          name="options"
                          type="JSON string"
                          description="Compression options (see schema below). Uses defaults if omitted."
                        />
                      </tbody>
                    </table>
                  </div>

                  <Code label="options schema">{`{
  "format":        "webp",   // "webp" | "avif" | "jpeg" | "png"
  "targetSizeKB":  100,      // target output size in KB
  "qualityStart":  85,       // initial quality (1–100)
  "qualityMin":    20,       // quality floor for binary search
  "qualityStep":   5,        // (unused — binary search adapts)
  "stripMetadata": true,     // strip EXIF / ICC data
  "resize": null             // null  →  no resize
                             // { "width": 800, "height": null,
                             //   "maintainAspect": true }
}`}</Code>
                </div>

                <div className="flex flex-col gap-4">
                  <SubHeading>Responses</SubHeading>
                  <Code label="200 — async (Redis available)">{`{
  "results": [
    {
      "jobId":        "14",
      "originalName": "photo.jpg",
      "error":        null
    },
    {
      "jobId":        "15",
      "originalName": "banner.png",
      "error":        null
    }
  ]
}`}</Code>

                  <Code label="200 — sync / cache hit">{`{
  "results": [
    {
      "outputUrl":       "/generated/cache/cache_d3f4.webp",
      "outputName":      "photo_1743093000_q78.webp",
      "originalSize":    2048000,
      "compressedSize":  97280,
      "reductionPercent": 95,
      "outputFormat":    "webp",
      "uploadId":        "uuid_1743093000.jpg",
      "formatOverridden": false,
      "quality":         78,
      "cached":          true,
      "originalName":    "photo.jpg",
      "error":           null
    }
  ]
}`}</Code>

                  <Code label="200 — partial errors">{`{
  "results": [
    { "jobId": "16", "originalName": "ok.jpg", "error": null },
    {
      "originalName": "corrupt.gif",
      "error": "Unsupported file type for \\"corrupt.gif\\""
    }
  ]
}`}</Code>
                </div>
              </div>

              <Callout type="info" title="Format override (formatOverridden: true)">
                If you request JPEG but the image has an alpha channel, the API silently upgrades
                to WebP to preserve transparency. The <InlineCode>formatOverridden</InlineCode> flag
                is set to <InlineCode>true</InlineCode> and the UI shows an amber warning.
              </Callout>
            </Endpoint>

            {/* GET /api/status/:jobId */}
            <Endpoint
              id="ep-status"
              method="GET"
              path="/api/status/:jobId"
              description="Poll the current state of a queued compression job. Call this every 1–2 seconds until status is 'completed' or 'failed'."
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="flex flex-col gap-4">
                  <SubHeading>Path Parameters</SubHeading>
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-sm">
                      <tbody>
                        <ParamRow
                          name=":jobId"
                          type="string"
                          required
                          description="The BullMQ job ID returned by POST /api/compress."
                        />
                      </tbody>
                    </table>
                  </div>

                  <SubHeading>Status Values</SubHeading>
                  <div className="flex flex-col gap-2">
                    {[
                      { status: "pending", color: "slate" as const, desc: "Job is queued — waiting for an available worker." },
                      { status: "processing", color: "amber" as const, desc: "A worker is actively compressing the image." },
                      { status: "completed", color: "emerald" as const, desc: "Done. Fetch /api/result/:jobId for the output URL." },
                      { status: "failed", color: "slate" as const, desc: "Job failed. Check failedReason in the response." },
                    ].map(({ status, color, desc }) => (
                      <div
                        key={status}
                        className="flex items-start gap-3 bg-slate-900/60 rounded-lg p-3 border border-slate-800"
                      >
                        <Badge color={color}>{status}</Badge>
                        <span className="text-xs text-slate-400 leading-snug mt-0.5">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <SubHeading>Response</SubHeading>
                  <Code label="200 — in progress">{`{
  "jobId":  "14",
  "status": "processing"
}`}</Code>
                  <Code label="200 — completed">{`{
  "jobId":  "14",
  "status": "completed"
}`}</Code>
                  <Code label="200 — failed">{`{
  "jobId":       "14",
  "status":      "failed",
  "reason":      "Compression timed out"
}`}</Code>
                  <Code label="503 — Redis unavailable">{`{
  "error": "Queue system unavailable"
}`}</Code>
                </div>
              </div>
            </Endpoint>

            {/* GET /api/result/:jobId */}
            <Endpoint
              id="ep-result"
              method="GET"
              path="/api/result/:jobId"
              description="Retrieve the compressed file URL and metadata for a completed job. Returns 202 if the job is still in progress."
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="flex flex-col gap-4">
                  <SubHeading>Path Parameters</SubHeading>
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-sm">
                      <tbody>
                        <ParamRow
                          name=":jobId"
                          type="string"
                          required
                          description="The BullMQ job ID. Jobs expire after 2 hours."
                        />
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <SubHeading>Responses</SubHeading>
                  <Code label="200 — job completed">{`{
  "jobId":           "14",
  "outputUrl":       "/generated/cache/cache_d3f4.webp",
  "outputName":      "photo_1743093000_q78.webp",
  "originalSize":    2048000,
  "compressedSize":  97280,
  "reductionPercent": 95,
  "outputFormat":    "webp",
  "uploadId":        "uuid_ts.jpg",
  "formatOverridden": false,
  "quality":         78,
  "cached":          true
}`}</Code>
                  <Code label="202 — not yet done">{`{
  "error": "Job is not yet completed (current state: active)"
}`}</Code>
                  <Code label="404 — expired or not found">{`{
  "error": "Job not found or expired"
}`}</Code>
                </div>
              </div>
            </Endpoint>

            {/* POST /api/reoptimize */}
            <Endpoint
              id="ep-reoptimize"
              method="POST"
              path="/api/reoptimize"
              description="Re-compress a previously uploaded image with different settings — without re-uploading. The original file is read from uploads/tmp using the uploadId."
            >
              <Callout type="warning" title="Original expires after 1 hour">
                The original file in <InlineCode>uploads/tmp</InlineCode> is cleaned up after 1 hour.
                If the original has expired, the API returns a <InlineCode>404</InlineCode> and the
                client must re-upload.
              </Callout>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="flex flex-col gap-4">
                  <SubHeading>Request — application/json</SubHeading>
                  <Code label="body">{`{
  "uploadId":    "uuid_1743093000.jpg",
  "originalName": "photo.jpg",
  "options": {
    "format":        "avif",
    "targetSizeKB":  50,
    "qualityStart":  80,
    "qualityMin":    20,
    "stripMetadata": true,
    "resize": { "width": 1280, "height": null,
                "maintainAspect": true }
  }
}`}</Code>
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-sm">
                      <tbody>
                        <ParamRow name="uploadId" type="string" required description="Filename in uploads/tmp (returned as uploadId in /api/compress response)." />
                        <ParamRow name="originalName" type="string" description="Original filename — used to derive the output filename. Defaults to 'image'." />
                        <ParamRow name="options" type="object" description="Compression options (same schema as /api/compress)." />
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <SubHeading>Response</SubHeading>
                  <Code label="200 — success">{`{
  "result": {
    "outputUrl":       "/generated/tmp/photo_1743093060_q85.avif",
    "outputName":      "photo_1743093060_q85.avif",
    "originalSize":    2048000,
    "compressedSize":  45200,
    "reductionPercent": 97,
    "outputFormat":    "avif",
    "uploadId":        "uuid_1743093060.jpg",
    "formatOverridden": false,
    "quality":         85
  },
  "error": null
}`}</Code>
                  <Code label="404 — expired">{`{
  "error": "Original file not found — it may have expired. Please re-upload."
}`}</Code>
                </div>
              </div>
            </Endpoint>

            {/* POST /api/download-zip */}
            <Endpoint
              id="ep-zip"
              method="POST"
              path="/api/download-zip"
              description="Bundle one or more compressed output files into a ZIP archive and stream it to the client."
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="flex flex-col gap-4">
                  <SubHeading>Request — application/json</SubHeading>
                  <Code label="body">{`{
  "filenames": [
    "photo_1743093000_q78.webp",
    "banner_1743093005_q72.webp",
    "icon_1743093010_q9.png"
  ]
}`}</Code>
                  <Callout type="info">
                    Pass only the <strong>filename</strong> (not the full path). Files are
                    resolved from <InlineCode>/public/generated/tmp/</InlineCode> on the server.
                    Files not found are silently skipped.
                  </Callout>
                </div>

                <div className="flex flex-col gap-4">
                  <SubHeading>Response</SubHeading>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-3 text-sm">
                      <Badge color="emerald">200</Badge>
                      <span className="text-slate-300 font-mono text-xs">application/zip</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Binary ZIP stream. Save with filename{" "}
                      <InlineCode>compressly-images.zip</InlineCode>.
                    </p>
                    <Code label="headers">{`Content-Type: application/zip
Content-Disposition: attachment; filename="compressly-images.zip"`}</Code>
                  </div>
                </div>
              </div>
            </Endpoint>
          </section>

          {/* ── COMPRESSION ENGINE ────────────────────────────────────────── */}
          <section id="compression" className="flex flex-col gap-6 scroll-mt-24">
            <h2 className="text-2xl font-bold text-white border-b border-slate-800 pb-4">
              Compression Engine
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              The engine uses{" "}
              <strong className="text-slate-200">
                sharp 0.34 (libvips) with binary search
              </strong>{" "}
              to find the highest quality that produces an output ≤ targetSizeKB. PNG is lossless
              and always compressed at maximum level.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-slate-200">Binary Search Quality</p>
                  <ol className="text-xs text-slate-400 leading-relaxed space-y-2 list-decimal list-inside">
                    <li>Try <InlineCode>qualityStart</InlineCode> (default 85). If output fits → done.</li>
                    <li>Set <InlineCode>lo = qualityMin</InlineCode>, <InlineCode>hi = qualityStart - 1</InlineCode>.</li>
                    <li>Pick <InlineCode>mid = ⌊(lo + hi) / 2⌋</InlineCode>. Encode. Check size.</li>
                    <li>If fits → save best, move <InlineCode>lo</InlineCode> up (try higher quality).</li>
                    <li>If too large → move <InlineCode>hi</InlineCode> down (try lower quality).</li>
                    <li>When <InlineCode>lo {'>'} hi</InlineCode> → return best found, or encode at qualityMin as fallback.</li>
                  </ol>
                  <p className="text-xs text-slate-500">
                    Complexity: O(log n) where n = qualityStart − qualityMin.
                    Typical range of 20–85 = ~6 sharp encode calls maximum.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-slate-200">PNG (Lossless)</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    PNG is always encoded with{" "}
                    <InlineCode>compressionLevel: 9</InlineCode> and{" "}
                    <InlineCode>adaptiveFiltering: true</InlineCode>. Binary search is skipped
                    because PNG has no quality parameter — it&apos;s always lossless.
                  </p>
                  <p className="text-xs text-slate-500">
                    The <InlineCode>quality</InlineCode> field in the response will be{" "}
                    <InlineCode>9</InlineCode> (the zlib compressionLevel).
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-slate-200">Alpha Transparency</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Before encoding, the engine reads{" "}
                    <InlineCode>sharp(buffer).metadata().hasAlpha</InlineCode>. If the image has
                    transparency and the requested format is JPEG (which cannot carry alpha), it
                    automatically upgrades to WebP.
                  </p>
                  <p className="text-xs text-slate-500">
                    Alpha-safe formats: <strong>WebP · AVIF · PNG</strong>
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-slate-200">Decompression Bomb Guard</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Every <InlineCode>sharp()</InlineCode> call receives{" "}
                    <InlineCode>{"{ limitInputPixels: 4096 * 4096 }"}</InlineCode> (16.7 MP). Images
                    above this limit are rejected before decompression begins, preventing OOM attacks.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-slate-200">Resize Pipeline</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    If <InlineCode>resize</InlineCode> is provided, the image is downscaled{" "}
                    <strong>before</strong> quality encoding. With{" "}
                    <InlineCode>maintainAspect: true</InlineCode>, sharp uses{" "}
                    <InlineCode>{"fit: 'inside'"}</InlineCode> + <InlineCode>withoutEnlargement</InlineCode>.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── CACHING ───────────────────────────────────────────────────── */}
          <section id="caching" className="flex flex-col gap-6 scroll-mt-24">
            <h2 className="text-2xl font-bold text-white border-b border-slate-800 pb-4">
              Caching System
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Content-addressed cache. Two requests for the same image with the same settings
              always produce the same hash and therefore the same cached output — no recompression.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-slate-200">Hash Generation</p>
                  <Code>{`// SHA-256 of (file buffer + options JSON)
sha256(buffer + JSON.stringify({
  format, targetSizeKB, qualityStart,
  qualityMin, resize, stripMetadata
}))`}</Code>
                  <p className="text-xs text-slate-500">
                    The hash is deterministic — identical inputs always produce identical output.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-slate-200">Cache Storage</p>
                  <p className="text-xs text-slate-400">
                    Cached files are stored as{" "}
                    <InlineCode>cache_{"{hash}"}.{"{ext}"}</InlineCode> in{" "}
                    <InlineCode>public/generated/cache/</InlineCode>.
                  </p>
                  <p className="text-xs text-slate-400">
                    Cached files are <strong>persistent</strong> — they are never automatically
                    deleted by the cleanup job. Only tmp outputs expire.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-slate-200">Cache Lookup</p>
                  <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside">
                    <li>Compute hash from (buffer + options).</li>
                    <li>Scan <InlineCode>public/generated/cache/</InlineCode> for <InlineCode>cache_{"{hash}"}.*</InlineCode>.</li>
                    <li>Found → return immediately with <InlineCode>cached: true</InlineCode>.</li>
                    <li>Not found → compress → write to cache → return result.</li>
                  </ol>
                </div>

                <Callout type="tip" title="Worker double-checks cache">
                  When running in async mode, the BullMQ worker re-checks the cache before
                  compressing. This handles the race condition where two identical jobs are
                  queued simultaneously — only the first one compresses, the second returns
                  the cached result.
                </Callout>
              </div>
            </div>
          </section>

          {/* ── FILE STORAGE ──────────────────────────────────────────────── */}
          <section id="storage" className="flex flex-col gap-6 scroll-mt-24">
            <h2 className="text-2xl font-bold text-white border-b border-slate-800 pb-4">
              File Storage
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              All files are stored under <InlineCode>public/</InlineCode> so Next.js serves them
              as static assets. Temporary files are cleaned up automatically.
            </p>

            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60">
                    <th className="text-left py-3 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Path
                    </th>
                    <th className="text-left py-3 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Contents
                    </th>
                    <th className="text-left py-3 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      TTL
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {[
                    [
                      "public/uploads/tmp/",
                      "Original uploaded files (used for re-optimization)",
                      "1 hour",
                    ],
                    [
                      "public/generated/tmp/",
                      "Compressed output files (linked from outputUrl)",
                      "1 hour",
                    ],
                    [
                      "public/generated/cache/",
                      "Content-addressed cache (cache_<hash>.<ext>)",
                      "Persistent",
                    ],
                  ].map(([path, contents, ttl]) => (
                    <tr key={path} className="hover:bg-slate-900/30 transition-colors">
                      <td className="py-3 px-5 font-mono text-[12px] text-indigo-300 align-top">
                        {path}
                      </td>
                      <td className="py-3 px-5 text-slate-400 text-xs align-top">{contents}</td>
                      <td className="py-3 px-5 align-top">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                            ttl === "Persistent"
                              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                              : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                          }`}
                        >
                          {ttl}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Callout type="info" title="Lazy cleanup">
              The cleanup function runs at most once every 10 minutes (module-level debounce), and
              only when a new compress or reoptimize request arrives. There is no background timer
              — the server process handles cleanup on-demand to avoid unnecessary I/O.
            </Callout>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 flex flex-col gap-3">
              <p className="text-sm font-semibold text-slate-200">Output Filename Format</p>
              <Code>{`// basename_timestamp_qQuality.ext
"photo_1743093000000_q78.webp"
//  ↑         ↑         ↑    ↑
//  sanitized  Date.now()  quality  format
//  basename   (ms)
`}</Code>
              <p className="text-xs text-slate-500">
                Basename is sanitized to alphanumeric + hyphens, max 32 chars.
                Quality is the final quality/compressionLevel used.
              </p>
            </div>
          </section>

          {/* ── SECURITY ──────────────────────────────────────────────────── */}
          <section id="security" className="flex flex-col gap-6 scroll-mt-24">
            <h2 className="text-2xl font-bold text-white border-b border-slate-800 pb-4">
              Security
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  title: "Magic Byte Validation",
                  icon: "🔍",
                  desc: "File content is validated by reading the first bytes — not the MIME header or file extension. Prevents disguised file uploads. Accepted: JPEG (FFD8), PNG (89504E47), WebP (RIFF), GIF (474946), AVIF (ftyp).",
                },
                {
                  title: "Rate Limiting",
                  icon: "🚦",
                  desc: "30 requests per minute per IP using an in-memory sliding window. Exceeding the limit returns 429 with Retry-After and X-RateLimit-* headers.",
                },
                {
                  title: "Max File Size",
                  icon: "📦",
                  desc: "20 MB per file, checked before any image processing occurs. Returns a 400 error with the filename so the client can display a targeted message.",
                },
                {
                  title: "Decompression Bombs",
                  icon: "💣",
                  desc: "Every sharp() call is instantiated with limitInputPixels: 4096 × 4096 (16.7 MP). Oversized images are rejected before decompression begins, preventing OOM attacks.",
                },
                {
                  title: "Path Traversal Prevention",
                  icon: "🛡️",
                  desc: "The reoptimize endpoint validates uploadId against /^[a-zA-Z0-9_\\-.]+$/ before resolving to a file path. Requests with slashes or dotdot sequences are rejected with 400.",
                },
                {
                  title: "Max Files per Request",
                  icon: "📋",
                  desc: "Max 20 files per POST /api/compress request. Prevents memory exhaustion from oversized batches. Returns 400 if exceeded.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{item.icon}</span>
                    <span className="text-sm font-semibold text-slate-200">{item.title}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── PERFORMANCE ───────────────────────────────────────────────── */}
          <section id="performance" className="flex flex-col gap-6 scroll-mt-24">
            <h2 className="text-2xl font-bold text-white border-b border-slate-800 pb-4">
              Performance
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-slate-200">BullMQ Queue</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    When Redis is available, uploads are enqueued immediately and processed by a
                    separate worker process (<InlineCode>npm run worker</InlineCode>). The API
                    never blocks waiting for compression.
                  </p>
                  <Code label="start worker">{`npm run worker
# tsx workers/compressionWorker.ts`}</Code>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-slate-200">Sync Fallback</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    When Redis is unavailable, the API falls back to synchronous inline
                    compression using <InlineCode>concurrentMap(files, LIMIT, fn)</InlineCode> —
                    a hand-rolled concurrency-limited parallel map. No extra dependencies needed.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-slate-200">Concurrency Control</p>
                  <Code>{`// API (sync mode)
const CONCURRENCY = Math.min(10, Math.max(1, os.cpus().length));

// Worker process
const CONCURRENCY = Math.min(os.cpus().length, 10);
sharp.concurrency(0); // libvips uses all cores per job
sharp.cache(false);   // no tile cache`}</Code>
                  <p className="text-xs text-slate-500">
                    On a 4-core server: 4 concurrent compressions. On an 8-core: 8, up to max 10.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-slate-200">Timeout Guard</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Each file in sync mode is wrapped in a 10-second{" "}
                    <InlineCode>withTimeout()</InlineCode>. Very complex or unusually large images
                    that stall sharp are killed and return a timeout error rather than hanging
                    the entire request.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── EXAMPLES ──────────────────────────────────────────────────── */}
          <section id="examples" className="flex flex-col gap-8 scroll-mt-24">
            <h2 className="text-2xl font-bold text-white border-b border-slate-800 pb-4">
              Examples
            </h2>

            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-slate-300">cURL — async compress + poll</h3>
              <Code label="shell">{`# Step 1: upload and get jobId
curl -X POST http://localhost:3000/api/compress \\
  -F "files=@/path/to/photo.jpg" \\
  -F 'options={"format":"webp","targetSizeKB":100,"stripMetadata":true}'

# Response: { "results": [{ "jobId": "14", "error": null }] }

# Step 2: poll status
curl http://localhost:3000/api/status/14
# { "jobId": "14", "status": "completed" }

# Step 3: get result
curl http://localhost:3000/api/result/14
# { "outputUrl": "/generated/cache/cache_d3f4.webp", "quality": 78, ... }`}</Code>
            </div>

            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-slate-300">cURL — sync (no Redis needed)</h3>
              <Code label="shell">{`curl -X POST "http://localhost:3000/api/compress?sync=true" \\
  -F "files=@/path/to/image.png" \\
  -F 'options={"format":"png","targetSizeKB":200}' | jq .results[0].outputUrl`}</Code>
            </div>

            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-slate-300">JavaScript / TypeScript</h3>
              <Code label="TypeScript">{`async function compressImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("files", file);
  formData.append("options", JSON.stringify({
    format: "avif",
    targetSizeKB: 80,
    qualityStart: 85,
    qualityMin: 20,
    stripMetadata: true,
  }));

  const res = await fetch("/api/compress", { method: "POST", body: formData });
  if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
  const { results } = await res.json();
  const result = results[0];

  if (result.error) throw new Error(result.error);

  // Sync / cache-hit path
  if (result.outputUrl) return result.outputUrl;

  // Async path — poll until done
  const { jobId } = result;
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const { status } = await fetch(\`/api/status/\${jobId}\`).then((r) => r.json());
    if (status === "completed") {
      const data = await fetch(\`/api/result/\${jobId}\`).then((r) => r.json());
      return data.outputUrl;
    }
    if (status === "failed") throw new Error("Compression job failed");
  }
  throw new Error("Job timed out after 3 minutes");
}`}</Code>
            </div>

            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-slate-300">
                JavaScript — batch compress + download ZIP
              </h3>
              <Code label="JavaScript">{`async function batchCompress(files) {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  form.append("options", JSON.stringify({ format: "webp", targetSizeKB: 100 }));

  const { results } = await fetch("/api/compress?sync=true", {
    method: "POST", body: form,
  }).then((r) => r.json());

  const filenames = results
    .filter((r) => !r.error)
    .map((r) => r.outputName);

  const zipRes = await fetch("/api/download-zip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filenames }),
  });

  const blob = await zipRes.blob();
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url, download: "compressed.zip",
  });
  a.click();
  URL.revokeObjectURL(url);
}`}</Code>
            </div>

            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-slate-300">CLI Tool</h3>
              <Code label="shell">{`# Install globally (from project root)
npm link

# Basic usage
compressly image.jpg

# Custom target size + format
compressly photo.png --size=50 --format=avif

# Batch — process all images in a folder
compressly ./images/*.jpg --size=100 --format=webp

# Options
#   --size=<KB>       Target size in KB (default: 100)
#   --format=<fmt>    Output format: webp | avif | jpeg | png (default: webp)
#   --out=<dir>       Output directory (default: ./compressed)
#   --no-metadata     Strip EXIF data (default: true)`}</Code>
            </div>
          </section>

          {/* ── ERRORS ────────────────────────────────────────────────────── */}
          <section id="errors" className="flex flex-col gap-6 scroll-mt-24">
            <h2 className="text-2xl font-bold text-white border-b border-slate-800 pb-4">
              Error Reference
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              All errors follow the same shape: <InlineCode>{"{ error: string }"}"</InlineCode>. Per-file
              errors inside <InlineCode>/api/compress</InlineCode> results have the same shape but
              are scoped to individual files rather than the whole request.
            </p>

            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60">
                    {["Status", "Code", "Cause", "Resolution"].map((h) => (
                      <th
                        key={h}
                        className="text-left py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {[
                    [
                      "400",
                      "Bad Request",
                      "Invalid form data, missing files, unsupported file type, or bad options JSON",
                      "Validate input before sending",
                    ],
                    [
                      "400",
                      "Too many files",
                      "More than 20 files per request",
                      "Split into batches of ≤ 20",
                    ],
                    [
                      "400",
                      "File too large",
                      "Individual file exceeds 20 MB",
                      "Resize or downsample before uploading",
                    ],
                    [
                      "404",
                      "Not Found",
                      "Job ID or uploadId doesn't exist or expired (> 1 hr for files, > 2 hr for jobs)",
                      "Re-upload the original file",
                    ],
                    [
                      "429",
                      "Too Many Requests",
                      "30 req/min per IP exceeded",
                      "Wait for Retry-After seconds",
                    ],
                    [
                      "500",
                      "Internal Server Error",
                      "Compression failed — image may be corrupt, unsupported, or triggered a timeout",
                      "Retry; if persistent, check server logs",
                    ],
                    [
                      "503",
                      "Service Unavailable",
                      "Status/result endpoints called when Redis is not running",
                      "Use ?sync=true or start Redis",
                    ],
                  ].map(([status, code, cause, fix]) => (
                    <tr key={`${status}-${code}`} className="hover:bg-slate-900/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-[13px] text-indigo-300 align-top whitespace-nowrap">
                        {status}
                      </td>
                      <td className="py-3 px-4 text-slate-300 text-xs align-top font-medium whitespace-nowrap">
                        {code}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-xs align-top">{cause}</td>
                      <td className="py-3 px-4 text-slate-400 text-xs align-top">{fix}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── CLI ───────────────────────────────────────────────────────── */}
          <section id="cli" className="flex flex-col gap-6 scroll-mt-24">
            <h2 className="text-2xl font-bold text-white border-b border-slate-800 pb-4">
              CLI Tool
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Compressly ships a standalone CLI that calls the local server. Run it from any
              directory after linking.
            </p>

            <Code label="setup">{`# From the project root
npm link

# Now available globally
compressly --help`}</Code>

            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60">
                    <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Flag
                    </th>
                    <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Default
                    </th>
                    <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {[
                    ["--size=<KB>", "100", "Target output size in KB"],
                    ["--format=<fmt>", "webp", "Output format: webp | avif | jpeg | png"],
                    ["--out=<dir>", "./compressed", "Output directory (created if needed)"],
                    ["--no-metadata", "enabled", "Strip EXIF/ICC metadata from output"],
                    ["--server=<url>", "http://localhost:3000", "Override API base URL"],
                  ].map(([flag, def, desc]) => (
                    <tr key={flag} className="hover:bg-slate-900/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-[12px] text-indigo-300 align-top whitespace-nowrap">
                        {flag}
                      </td>
                      <td className="py-3 px-4 font-mono text-[12px] text-slate-500 align-top whitespace-nowrap">
                        {def}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs align-top">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Code label="examples">{`# Compress a single file to WebP ≤ 100KB
compressly hero.jpg

# Compress to AVIF ≤ 50KB
compressly photo.png --size=50 --format=avif

# Process multiple files
compressly a.jpg b.png c.webp --size=150 --out=./dist

# Use a remote server
compressly image.jpg --server=https://compressly.example.com`}</Code>

            <Callout type="info" title="Server must be running">
              The CLI calls <InlineCode>POST /api/compress?sync=true</InlineCode> on the local
              (or configured) server. Make sure <InlineCode>npm run dev</InlineCode> or{" "}
              <InlineCode>npm start</InlineCode> is running before using the CLI.
            </Callout>
          </section>

          {/* ── Footer ──────────────────────────────────────────────────────── */}
          <footer className="border-t border-slate-800 pt-8 flex items-center justify-between text-xs text-slate-600">
            <span>Compressly v1.0 · Built with Next.js + sharp + BullMQ</span>
            <Link href="/" className="hover:text-slate-400 transition-colors">
              ← Back to App
            </Link>
          </footer>
        </main>
      </div>
    </div>
  );
}
