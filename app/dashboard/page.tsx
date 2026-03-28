"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimelinePoint {
  ts: number;
  label: string;
  requests: number;
  images: number;
  bytesSaved: number;
}

interface AnalyticsData {
  totalImagesProcessed: number;
  totalBytesSaved: number;
  totalRequests: number;
  avgCompressionMs: number;
  cacheHitRate: number;
  errorRate: number;
  formatCounts: Record<string, number>;
  timeline: TimelinePoint[];
  activeJobs: number;
  startedAt: number;
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function fmtMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function fmtAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function fmtUptime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

// ── Dark tooltip ──────────────────────────────────────────────────────────────

function DarkTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-3 text-xs shadow-2xl shadow-slate-950/80">
      <p className="text-slate-400 font-medium mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 py-0.5">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: entry.color as string }}
          />
          <span className="text-slate-400 capitalize">{entry.name}:</span>
          <span className="text-white font-semibold ml-auto pl-3">
            {fmtNum(entry.value as number)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  sub: string;
  accentClass: string;
  glow: string;
  delay?: number;
}

function StatCard({ icon, label, value, sub, accentClass, glow, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="relative rounded-2xl bg-slate-900/70 border border-slate-800 p-5 flex flex-col gap-2 overflow-hidden"
      style={{ boxShadow: glow }}
    >
      {/* Accent bar */}
      <div className={`absolute left-0 inset-y-0 w-[3px] rounded-r-full ${accentClass}`} />

      <div className="flex items-start justify-between gap-2">
        <span className="text-xl leading-none">{icon}</span>
        <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider text-right leading-tight">
          {label}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={value}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.18 }}
          className="text-2xl font-bold text-white tracking-tight leading-none"
        >
          {value}
        </motion.p>
      </AnimatePresence>

      <p className="text-[11px] text-slate-600 leading-snug">{sub}</p>
    </motion.div>
  );
}

// ── Chart skeleton ────────────────────────────────────────────────────────────

function ChartSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl bg-slate-900/70 border border-slate-800 animate-pulse ${className}`} />
  );
}

// ── Format colours ────────────────────────────────────────────────────────────

const FORMAT_COLORS: Record<string, string> = {
  WEBP: "#6366f1",
  AVIF: "#8b5cf6",
  JPEG: "#f59e0b",
  JPG:  "#f59e0b",
  PNG:  "#0ea5e9",
};

const POLL_MS = 5_000;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [hasError, setHasError] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0); // drives the "X ago" refresh

  // Charts must only render client-side (recharts reads DOM dimensions)
  useEffect(() => setMounted(true), []);

  // Fetch analytics
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics", { cache: "no-store" });
      if (!res.ok) throw new Error("non-2xx");
      const json = (await res.json()) as AnalyticsData;
      setData(json);
      setLastUpdated(Date.now());
      setHasError(false);
    } catch {
      setHasError(true);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, POLL_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  // 1-second ticker to keep "X ago" label fresh without re-fetching
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  void tick; // consumed only to trigger re-render

  // Format breakdown for bar chart
  const formatData = data
    ? Object.entries(data.formatCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([fmt, count]) => ({ format: fmt.toUpperCase(), count }))
    : [];

  const noActivity =
    data !== null && data.totalImagesProcessed === 0 && data.totalRequests === 0;

  return (
    <div className="min-h-screen bg-[#020617] text-white">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#020617]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
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
            <span className="text-slate-400 text-sm font-medium">Analytics</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs">
              <span
                className={[
                  "w-2 h-2 rounded-full shrink-0",
                  hasError ? "bg-red-400" : "bg-emerald-400 animate-pulse",
                ].join(" ")}
              />
              <span className={hasError ? "text-red-400" : "text-emerald-400 font-medium"}>
                {hasError ? "Error" : "Live"}
              </span>
              {lastUpdated && !hasError && (
                <span className="text-slate-600 hidden sm:inline">
                  · {fmtAgo(lastUpdated)}
                </span>
              )}
            </div>
            <Link
              href="/"
              className="text-xs text-slate-400 hover:text-slate-200 font-medium transition-colors"
            >
              ← App
            </Link>
            <Link
              href="/docs"
              className="text-xs text-slate-400 hover:text-slate-200 font-medium transition-colors"
            >
              Docs
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col gap-8">

        {/* ── Title row ───────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">
              In-memory store · resets on server restart · polls every 5 s
              {data && (
                <> · uptime <span className="text-slate-400">{fmtUptime(data.startedAt)}</span></>
              )}
            </p>
          </div>

          {/* Active jobs pill */}
          {data !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={[
                "flex items-center gap-2 self-start sm:self-auto rounded-xl border px-4 py-2.5 text-sm font-medium",
                data.activeJobs > 0
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                  : "border-slate-800 bg-slate-900/60 text-slate-400",
              ].join(" ")}
            >
              <span
                className={[
                  "w-1.5 h-1.5 rounded-full",
                  data.activeJobs > 0 ? "bg-amber-400 animate-pulse" : "bg-slate-600",
                ].join(" ")}
              />
              <span>
                {data.activeJobs > 0
                  ? `${data.activeJobs} active job${data.activeJobs > 1 ? "s" : ""}`
                  : "Queue idle"}
              </span>
            </motion.div>
          )}
        </div>

        {/* ── Stat cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            icon="📸"
            label="Images Compressed"
            value={data ? fmtNum(data.totalImagesProcessed) : "–"}
            sub={data ? `${data.totalImagesProcessed} total` : "waiting for data…"}
            accentClass="bg-emerald-500"
            glow="0 0 40px rgba(16,185,129,0.07)"
            delay={0}
          />
          <StatCard
            icon="💾"
            label="Data Saved"
            value={data ? fmtBytes(data.totalBytesSaved) : "–"}
            sub={data && data.totalBytesSaved > 0 ? "freed from originals" : "no savings yet"}
            accentClass="bg-sky-500"
            glow="0 0 40px rgba(14,165,233,0.07)"
            delay={0.05}
          />
          <StatCard
            icon="⚡"
            label="Avg Compression"
            value={data ? (data.avgCompressionMs > 0 ? fmtMs(data.avgCompressionMs) : "–") : "–"}
            sub="per image (sync mode)"
            accentClass="bg-amber-500"
            glow="0 0 40px rgba(245,158,11,0.07)"
            delay={0.1}
          />
          <StatCard
            icon="🔁"
            label="Cache Hit Rate"
            value={data ? `${data.cacheHitRate}%` : "–"}
            sub={
              data
                ? data.cacheHitRate >= 50
                  ? "excellent hit rate"
                  : data.cacheHitRate > 0
                  ? "room to improve"
                  : "no cache hits yet"
                : "waiting…"
            }
            accentClass="bg-violet-500"
            glow="0 0 40px rgba(139,92,246,0.07)"
            delay={0.15}
          />
          <StatCard
            icon="🚀"
            label="Total Requests"
            value={data ? fmtNum(data.totalRequests) : "–"}
            sub={
              data
                ? data.errorRate > 0
                  ? `${data.errorRate}% error rate`
                  : "0% error rate"
                : "waiting…"
            }
            accentClass="bg-indigo-500"
            glow="0 0 40px rgba(99,102,241,0.07)"
            delay={0.2}
          />
          <StatCard
            icon="⚙️"
            label="Active Jobs"
            value={data ? String(data.activeJobs) : "–"}
            sub={data ? (data.activeJobs > 0 ? "in BullMQ queue" : "queue is idle") : "waiting…"}
            accentClass={data && data.activeJobs > 0 ? "bg-amber-500" : "bg-slate-700"}
            glow={
              data && data.activeJobs > 0
                ? "0 0 40px rgba(245,158,11,0.1)"
                : "0 0 0px transparent"
            }
            delay={0.25}
          />
        </div>

        {/* ── Charts ──────────────────────────────────────────────────────── */}
        {!mounted ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ChartSkeleton className="lg:col-span-2 h-[310px]" />
            <ChartSkeleton className="h-[310px]" />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Area chart — activity timeline */}
            <div className="lg:col-span-2 rounded-2xl bg-slate-900/70 border border-slate-800 p-6 flex flex-col gap-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-white">Activity — last 30 min</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Requests &amp; images per minute
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="w-3 h-px bg-indigo-400 inline-block rounded-full" />
                    Requests
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="w-3 h-px bg-emerald-400 inline-block rounded-full" />
                    Images
                  </span>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={210}>
                <AreaChart
                  data={data?.timeline ?? []}
                  margin={{ top: 4, right: 0, left: -24, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gradReq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradImg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1e293b"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#475569", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval={4}
                  />
                  <YAxis
                    tick={{ fill: "#475569", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={32}
                  />
                  <Tooltip
                    content={(props) => <DarkTooltip {...(props as TooltipContentProps<number, string>)} />}
                    cursor={{ stroke: "#334155", strokeWidth: 1, strokeDasharray: "4 4" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="requests"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#gradReq)"
                    dot={false}
                    activeDot={{ r: 4, fill: "#6366f1", stroke: "#020617", strokeWidth: 2 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="images"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#gradImg)"
                    dot={false}
                    activeDot={{ r: 4, fill: "#10b981", stroke: "#020617", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Bar chart — format distribution */}
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-6 flex flex-col gap-5">
              <div>
                <h2 className="text-sm font-semibold text-white">Format Distribution</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Images processed by output format
                </p>
              </div>

              {formatData.length > 0 ? (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart
                    data={formatData}
                    margin={{ top: 4, right: 0, left: -24, bottom: 0 }}
                    barSize={32}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#1e293b"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="format"
                      tick={{ fill: "#475569", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#475569", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      width={32}
                    />
                    <Tooltip
                      content={(props) => (
                        <DarkTooltip {...(props as TooltipContentProps<number, string>)} />
                      )}
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {formatData.map((entry) => (
                        <Cell
                          key={entry.format}
                          fill={FORMAT_COLORS[entry.format] ?? "#6366f1"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex-1 flex items-center justify-center min-h-[210px]">
                  <div className="text-center space-y-2">
                    <p className="text-4xl">📊</p>
                    <p className="text-slate-500 text-sm font-medium">No data yet</p>
                    <p className="text-slate-600 text-xs">
                      Compress an image to populate this chart
                    </p>
                  </div>
                </div>
              )}

              {/* Format legend */}
              {formatData.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-800">
                  {formatData.map((entry) => (
                    <div key={entry.format} className="flex items-center gap-1.5 text-[11px]">
                      <span
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ background: FORMAT_COLORS[entry.format] ?? "#6366f1" }}
                      />
                      <span className="text-slate-400">{entry.format}</span>
                      <span className="text-slate-600">{entry.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── No-data banner ───────────────────────────────────────────────── */}
        <AnimatePresence>
          {noActivity && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 px-6 py-5 flex items-center gap-4"
            >
              <span className="text-2xl shrink-0">💡</span>
              <div>
                <p className="text-sm font-semibold text-indigo-300">
                  No activity recorded yet
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Head to the{" "}
                  <Link href="/" className="text-indigo-400 hover:text-indigo-300 underline">
                    main app
                  </Link>{" "}
                  and compress an image — stats will appear here automatically within 5 seconds.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between text-[11px] text-slate-700 pt-2 border-t border-slate-800/60">
          <span>In-memory store · resets on server restart · queue stats require Redis</span>
          <span>Refreshes every {POLL_MS / 1000}s</span>
        </div>
      </div>
    </div>
  );
}
