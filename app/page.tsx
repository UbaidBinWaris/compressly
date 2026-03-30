"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Section wrapper that fades + slides in when scrolled into view */
function FadeSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Inline code tag */
function IC({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-slate-800 text-indigo-300 text-[12px] font-mono px-1.5 py-0.5 rounded border border-slate-700/50">
      {children}
    </code>
  );
}

// ── Demo Slider ───────────────────────────────────────────────────────────────

function DemoSlider() {
  const [pos, setPos] = useState(52);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  const landscape = `
    radial-gradient(ellipse 80% 50% at 50% 0%, #0c1445 0%, transparent 70%),
    radial-gradient(circle at 78% 38%, #f97316 0%, #ea580c 8%, transparent 35%),
    radial-gradient(ellipse at 30% 60%, #1e3a5f 0%, transparent 55%),
    linear-gradient(
      to bottom,
      #0c1445 0%,
      #1e2d6e 18%,
      #7c3aed 32%,
      #c2410c 42%,
      #f97316 48%,
      #fbbf24 52%,
      #4a7c59 57%,
      #2d5a3d 68%,
      #1a3a26 82%,
      #0d2118 100%
    )
  `;

  if (!mounted) {
    return (
      <div
        className="relative w-full rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl shadow-slate-950/80 bg-slate-900/60 animate-pulse"
        style={{ aspectRatio: "16/9" }}
      />
    );
  }

  return (
    <div
      className="relative w-full select-none rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl shadow-slate-950/80"
      style={{ aspectRatio: "16/9" }}
    >
      {/* AFTER layer */}
      <div className="absolute inset-0" style={{ background: landscape }} />

      {/* AFTER badge */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-2">
        <span className="text-[10px] font-black tracking-wider text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 rounded-full">
          ▲ 96% smaller
        </span>
        <div className="flex items-center gap-2 bg-slate-950/80 backdrop-blur border border-slate-700/60 rounded-xl px-3 py-2">
          <span className="text-[10px] text-slate-400 font-semibold">AFTER</span>
          <span className="text-white text-sm font-bold">89 KB</span>
          <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded font-mono">WebP</span>
        </div>
      </div>

      {/* BEFORE layer — clipped */}
      <div
        className="absolute inset-0"
        style={{
          background: landscape,
          filter: "contrast(1.12) saturate(1.3) brightness(0.92)",
          clipPath: `polygon(0 0, ${pos}% 0, ${pos}% 100%, 0 100%)`,
        }}
      />

      {/* BEFORE badge */}
      <div
        className="absolute bottom-4 left-4 z-10 transition-opacity duration-200"
        style={{ opacity: pos > 18 ? 1 : 0 }}
      >
        <div className="flex items-center gap-2 bg-slate-950/80 backdrop-blur border border-slate-700/60 rounded-xl px-3 py-2">
          <span className="text-[10px] text-slate-400 font-semibold">BEFORE</span>
          <span className="text-white text-sm font-bold">2.4 MB</span>
          <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded font-mono">JPEG</span>
        </div>
      </div>

      {/* Divider */}
      <div
        className="absolute inset-y-0 z-20 w-px bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.6)]"
        style={{ left: `${pos}%` }}
      />

      {/* Handle */}
      <div
        className="absolute top-1/2 z-30 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-white shadow-xl flex items-center justify-center cursor-ew-resize"
        style={{ left: `${pos}%` }}
      >
        <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l-3 3 3 3M16 9l3 3-3 3" />
        </svg>
      </div>

      {/* Range input */}
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        className="absolute inset-0 z-40 w-full h-full opacity-0 cursor-ew-resize"
        style={{ WebkitAppearance: "none", margin: 0 }}
      />

      {/* Drag hint */}
      {pos === 52 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 text-[11px] text-white/60 bg-slate-950/60 backdrop-blur px-3 py-1.5 rounded-full border border-white/10 pointer-events-none">
          ← Drag to compare →
        </div>
      )}
    </div>
  );
}

// ── Developer Section ─────────────────────────────────────────────────────────

const CODE_TABS = ["cURL", "JavaScript", "CLI"] as const;

const CODE_EXAMPLES: Record<(typeof CODE_TABS)[number], string> = {
  cURL: `curl -X POST http://localhost:3000/api/compress \\
  -F "files=@photo.jpg" \\
  -F 'options={"format":"webp","targetSizeKB":100}'

# Async response:
# { "results": [{ "jobId": "14", "error": null }] }

curl http://localhost:3000/api/status/14
# { "status": "completed" }

curl http://localhost:3000/api/result/14
# { "outputUrl": "/generated/cache/cache_d3f4.webp",
#   "quality": 78, "reductionPercent": 95 }`,

  JavaScript: `const form = new FormData();
form.append("files", imageFile);
form.append("options", JSON.stringify({
  format: "avif",
  targetSizeKB: 80,
  stripMetadata: true,
}));

const { results } = await fetch("/api/compress", {
  method: "POST", body: form,
}).then((r) => r.json());

if (results[0].jobId) {
  // async — poll until done
  const { outputUrl } = await pollJob(results[0].jobId);
} else {
  // sync / cache hit — instant
  console.log(results[0].outputUrl);
}`,

  CLI: `# Install (from project root)
npm link

# Compress a file
compressly photo.jpg

# Custom format + size
compressly hero.png --format=avif --size=50

# Batch compress a folder
compressly ./images/*.jpg --format=webp --out=./dist`,
};

function DeveloperSection() {
  const [tab, setTab] = useState<(typeof CODE_TABS)[number]>("cURL");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(CODE_EXAMPLES[tab]).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
      {/* Left — pitch */}
      <div className="flex flex-col gap-6">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1.5 rounded-full w-fit">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
          </svg>
          REST API + CLI
        </div>
        <h2 className="text-3xl lg:text-4xl font-bold tracking-tight leading-tight">
          Built for developers
          <br />
          <span className="text-slate-400 font-normal">who care about performance.</span>
        </h2>
        <p className="text-slate-400 leading-relaxed">
          Every feature is available over HTTP. Integrate compression into your build pipeline,
          CMS, or image upload flow in minutes.
        </p>
        <ul className="flex flex-col gap-3">
          {[
            ["Hash-based caching", "Same image + same settings → instant return. Zero redundant work."],
            ["Async queue", "Upload returns a jobId immediately. Poll for completion — no timeouts."],
            ["Sync fallback", "Append ?sync=true for inline compression when Redis isn't available."],
            ["Re-optimize API", "Change format or target size without re-uploading the original."],
          ].map(([title, desc]) => (
            <li key={title} className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-2.5 h-2.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </span>
              <span className="text-sm text-slate-300">
                <strong className="text-slate-200">{title}</strong> — {desc}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex gap-3 pt-2">
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Full API Reference
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Right — code block */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl shadow-slate-950/80">
        <div className="flex items-center gap-0 border-b border-slate-800 bg-slate-900/60 px-4">
          {CODE_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                "px-4 py-3 text-xs font-semibold transition-colors border-b-2 -mb-px",
                tab === t
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-300",
              ].join(" ")}
            >
              {t}
            </button>
          ))}
          <button
            onClick={copy}
            className={[
              "ml-auto flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg border transition-all",
              copied
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : "border-slate-700 text-slate-500 hover:text-slate-300",
            ].join(" ")}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="p-5 text-sm text-slate-300 font-mono leading-relaxed overflow-x-auto whitespace-pre">
          {CODE_EXAMPLES[tab]}
        </pre>
      </div>
    </div>
  );
}

// ── Live Stats ────────────────────────────────────────────────────────────────

interface LiveStatsData {
  totalImagesProcessed: number;
  totalBytesSaved: number;
  cacheHitRate: number;
  totalRequests: number;
}

function fmtBytes(b: number) {
  if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(1)} GB`;
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b >= 1_024) return `${(b / 1_024).toFixed(0)} KB`;
  return `${b} B`;
}

function LiveStats() {
  const [stats, setStats] = useState<LiveStatsData | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const mountId = setTimeout(() => setMounted(true), 0);
    const fetch_ = () =>
      fetch("/api/analytics", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setStats(d))
        .catch(() => {});
    fetch_();
    const pollId = setInterval(fetch_, 30_000);
    return () => {
      clearTimeout(mountId);
      clearInterval(pollId);
    };
  }, []);

  const items = [
    {
      value: stats ? stats.totalImagesProcessed.toLocaleString() : "—",
      label: "Images Compressed",
      icon: "📸",
      color: "from-emerald-500/20 to-transparent border-emerald-500/20",
      dot: "bg-emerald-500",
    },
    {
      value: stats ? fmtBytes(stats.totalBytesSaved) : "—",
      label: "Bandwidth Saved",
      icon: "💾",
      color: "from-sky-500/20 to-transparent border-sky-500/20",
      dot: "bg-sky-500",
    },
    {
      value: stats ? `${stats.cacheHitRate}%` : "—",
      label: "Cache Hit Rate",
      icon: "⚡",
      color: "from-violet-500/20 to-transparent border-violet-500/20",
      dot: "bg-violet-500",
    },
    {
      value: stats ? stats.totalRequests.toLocaleString() : "—",
      label: "API Requests",
      icon: "🚀",
      color: "from-indigo-500/20 to-transparent border-indigo-500/20",
      dot: "bg-indigo-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-2xl border bg-gradient-to-b ${item.color} p-6 flex flex-col gap-3`}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">{item.icon}</span>
            {mounted && (
              <span className={`w-1.5 h-1.5 rounded-full ${item.dot} animate-pulse`} />
            )}
          </div>
          <AnimatePresence mode="wait">
            {mounted && (
              <motion.p
                key={item.value}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="text-3xl font-bold text-white tracking-tight"
              >
                {item.value}
              </motion.p>
            )}
          </AnimatePresence>
          {!mounted && (
            <div className="h-9 w-16 bg-slate-800/60 rounded animate-pulse" />
          )}
          <p className="text-xs text-slate-500 font-medium">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Feature card ──────────────────────────────────────────────────────────────

function FeatureCard({
  icon,
  title,
  desc,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 flex flex-col gap-3 hover:border-slate-700 transition-colors group"
    >
      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xl group-hover:bg-indigo-500/15 transition-colors">
        {icon}
      </div>
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
    </motion.div>
  );
}

// ── Step card ─────────────────────────────────────────────────────────────────

function StepCard({
  n,
  title,
  desc,
  icon,
  last,
}: {
  n: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className="flex items-start gap-6 relative">
      <div className="flex flex-col items-center shrink-0">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-xl shadow-lg shadow-indigo-950/50 z-10">
          {icon}
        </div>
        {!last && (
          <div className="hidden lg:block w-px flex-1 min-h-[48px] mt-2 bg-gradient-to-b from-slate-700 to-transparent" />
        )}
      </div>
      <div className="pb-10 lg:pb-0">
        <span className="text-[10px] font-bold text-indigo-400 tracking-widest">{n}</span>
        <h3 className="text-base font-semibold text-white mt-0.5">{title}</h3>
        <p className="text-sm text-slate-400 mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Landing page
// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="bg-[#020617] text-white overflow-x-hidden">

      {/* ═══════════════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#020617]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <span className="text-base font-bold tracking-tight">Compressly</span>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              {[
                { label: "Features", href: "#features" },
                { label: "How It Works", href: "#how" },
                { label: "Tool", href: "/tool" },
                { label: "Video", href: "/video" },
                { label: "API Docs", href: "/docs" },
                { label: "Dashboard", href: "/dashboard" },
              ].map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  className="text-sm text-slate-400 hover:text-slate-200 transition-colors font-medium"
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-slate-500 font-medium bg-slate-800/80 border border-slate-700/50 px-3 py-1 rounded-full">
              Free · No login
            </span>
            <Link
              href="/tool"
              className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Start Free →
            </Link>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden pt-20 pb-28">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-indigo-600/8 blur-[120px]" />
          <div className="absolute top-[10%] left-[10%] w-[400px] h-[400px] rounded-full bg-violet-600/6 blur-[100px]" />
          <div className="absolute top-[5%] right-[5%] w-[300px] h-[300px] rounded-full bg-sky-600/5 blur-[90px]" />
        </div>

        <div className="relative max-w-5xl mx-auto px-6 flex flex-col items-center text-center gap-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs font-semibold px-4 py-2 rounded-full"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Smart Size Compression Engine
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05]"
          >
            Compress images
            <br />
            <span className="text-indigo-400">to perfect size.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2 }}
            className="text-lg text-slate-400 max-w-2xl leading-relaxed"
          >
            Binary-search quality algorithm finds the highest quality that fits your target size.
            WebP · AVIF · PNG · JPEG — auto-optimized, hash-cached, and instantly downloadable.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap justify-center gap-2"
          >
            {[
              ["WebP", "text-indigo-300 bg-indigo-500/15 border-indigo-500/25"],
              ["AVIF", "text-violet-300 bg-violet-500/15 border-violet-500/25"],
              ["PNG", "text-sky-300 bg-sky-500/15 border-sky-500/25"],
              ["JPEG", "text-amber-300 bg-amber-500/15 border-amber-500/25"],
            ].map(([fmt, cls]) => (
              <span key={fmt} className={`text-xs font-bold px-3 py-1.5 rounded-full border ${cls}`}>
                {fmt}
              </span>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="flex flex-wrap justify-center gap-3 pt-2"
          >
            <Link
              href="/tool"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm shadow-lg shadow-indigo-950/50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Upload Image
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-6 py-3 rounded-xl transition-colors text-sm border border-slate-700"
            >
              View API Docs
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
              </svg>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex flex-wrap justify-center gap-6 text-xs text-slate-600 font-medium pt-2"
          >
            {["⚡ Avg < 1s per image", "🔒 No data stored permanently", "📦 Bulk up to 20 files", "♻️ Smart hash cache"].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FEATURES
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="features" className="py-24 px-6 max-w-7xl mx-auto">
        <FadeSection className="text-center mb-14">
          <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">Features</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Everything an image pipeline needs
          </h2>
          <p className="text-slate-400 mt-3 max-w-xl mx-auto leading-relaxed">
            From a simple drop-and-download to a full async API with caching and CLI tooling.
          </p>
        </FadeSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: "🎨", title: "Multi-Format Output", desc: "WebP, AVIF, PNG, JPEG. Alpha-transparent images automatically upgrade to WebP when JPEG is requested.", delay: 0 },
            { icon: "🔍", title: "Binary Search Quality", desc: "O(log n) quality search — typically just 5-6 sharp encode calls to find the highest quality under your target size.", delay: 0.05 },
            { icon: "⚡", title: "Instant Hash Cache", desc: "SHA-256 of (buffer + options) keys a persistent cache. Identical uploads return in microseconds, no recompression.", delay: 0.1 },
            { icon: "📦", title: "Bulk Processing", desc: "Upload up to 20 images per request. Concurrent processing with CPU-based concurrency limits for maximum throughput.", delay: 0.15 },
            { icon: "🔌", title: "Full API + CLI", desc: "REST API with async queue (BullMQ), sync fallback, status polling, and a standalone CLI tool for build pipelines.", delay: 0.2 },
            { icon: "🔁", title: "Re-optimize Without Re-upload", desc: "Originals are preserved for 1 hour. Change format or quality and re-compress instantly from the same upload.", delay: 0.25 },
          ].map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          DEMO SLIDER
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <FadeSection className="text-center mb-10">
            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">Before vs After</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Same quality. 96% smaller.
            </h2>
            <p className="text-slate-400 mt-3 max-w-lg mx-auto leading-relaxed">
              Compressly finds the highest quality that still fits your target.
              Drag the handle to compare the original and the compressed output.
            </p>
          </FadeSection>
          <FadeSection delay={0.1}>
            <DemoSlider />
          </FadeSection>
          <FadeSection delay={0.15}>
            <div className="flex flex-wrap justify-center gap-6 mt-8 text-sm text-slate-400">
              {[
                ["2.4 MB", "Original JPEG"],
                ["→", ""],
                ["89 KB", "Compressed WebP"],
                ["·", ""],
                ["96%", "smaller"],
              ].map(([val, label], i) =>
                label ? (
                  <div key={i} className="text-center">
                    <p className={`text-lg font-bold ${val === "96%" ? "text-emerald-400" : "text-white"}`}>{val}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                  </div>
                ) : (
                  <span key={i} className="text-slate-700 text-xl self-center">{val}</span>
                )
              )}
            </div>
          </FadeSection>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          HOW IT WORKS
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="how" className="py-24 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <FadeSection>
            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4">How It Works</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Three steps,
              <br />
              <span className="text-slate-400 font-normal">zero configuration.</span>
            </h2>
            <p className="text-slate-400 leading-relaxed mb-10">
              Drop your images, pick a target size, and Compressly handles everything else —
              including format selection, transparency detection, and quality tuning.
            </p>
            <div className="flex flex-col">
              <StepCard
                n="01"
                title="Drop or paste your images"
                icon="📂"
                desc="Upload JPEG, PNG, WebP, GIF, or AVIF — up to 20 files and 20 MB each. Paste from clipboard works too."
              />
              <StepCard
                n="02"
                title="Smart binary-search compression"
                icon="🔍"
                desc="The engine tries your quality start point, then binary-searches between qualityMin and qualityStart to find the highest quality that fits your target size."
              />
              <StepCard
                n="03"
                title="Download or use the API URL"
                icon="⬇️"
                last
                desc="Get a download link, copy the URL directly, or bulk-download as a ZIP. The URL is valid for 1 hour; the cache version is permanent."
              />
            </div>
          </FadeSection>

          <FadeSection delay={0.1}>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900">
                <span className="w-3 h-3 rounded-full bg-red-500/70" />
                <span className="w-3 h-3 rounded-full bg-amber-500/70" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
                <span className="text-xs text-slate-500 ml-2 font-mono">compression pipeline</span>
              </div>
              <div className="p-5 flex flex-col gap-3">
                {[
                  { step: "Rate limit check", detail: "30 req/min per IP", ok: true },
                  { step: "Magic byte validation", detail: "JPEG FFD8 · PNG 8950 · WebP RIFF", ok: true },
                  { step: "SHA-256 hash", detail: "buffer + options → deterministic key", ok: true },
                  { step: "Cache lookup", detail: "cache_d3f4a1b2.webp → HIT", ok: true, hit: true },
                  { step: "sharp encode (q=78)", detail: "96.2 KB ≤ 100 KB target ✓", ok: true },
                  { step: "Write to cache", detail: "public/generated/cache/", ok: true },
                ].map((row, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 rounded-lg px-3 py-2.5 text-xs font-mono ${
                      row.hit ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-slate-800/60"
                    }`}
                  >
                    <span
                      className={`mt-px text-[10px] font-bold ${
                        row.ok ? (row.hit ? "text-emerald-400" : "text-slate-400") : "text-red-400"
                      }`}
                    >
                      {row.hit ? "CACHE HIT" : String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className={row.hit ? "text-emerald-300" : "text-slate-300"}>{row.step}</p>
                      <p className="text-slate-600 mt-0.5">{row.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeSection>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          DEVELOPER SECTION
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <FadeSection>
            <DeveloperSection />
          </FadeSection>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          LIVE STATS
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <FadeSection className="text-center mb-10">
            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">Live Metrics</p>
            <h2 className="text-3xl font-bold tracking-tight">Real-time usage stats</h2>
            <p className="text-slate-400 mt-2 text-sm">
              Live from this server instance. Resets on restart. Full dashboard at{" "}
              <Link href="/dashboard" className="text-indigo-400 hover:underline">
                /dashboard
              </Link>.
            </p>
          </FadeSection>
          <FadeSection delay={0.1}>
            <LiveStats />
          </FadeSection>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          CTA BANNER
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6">
        <FadeSection>
          <div className="max-w-4xl mx-auto relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/60 via-slate-900/80 to-slate-900/60 p-12 text-center">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_0%,rgba(99,102,241,0.15),transparent_70%)]" aria-hidden />
            <h2 className="relative text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Start optimizing now.
              <br />
              <span className="text-indigo-400">Free, forever.</span>
            </h2>
            <p className="relative text-slate-400 mb-8 max-w-md mx-auto leading-relaxed">
              No account required. Drop your images and get compressed files instantly.
              Self-host with a single <IC>npm run dev</IC>.
            </p>
            <div className="relative flex flex-wrap justify-center gap-3">
              <Link
                href="/tool"
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-7 py-3.5 rounded-xl transition-colors shadow-lg shadow-indigo-950/60"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Upload Your First Image
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold px-7 py-3.5 rounded-xl transition-colors"
              >
                Browse the API
              </Link>
            </div>
          </div>
        </FadeSection>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-slate-800 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <span className="text-sm font-semibold">Compressly</span>
            <span className="text-slate-700 text-xs ml-2">Free · Open Source · Self-Hosted</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/docs" className="hover:text-slate-300 transition-colors">API Docs</Link>
            <Link href="/dashboard" className="hover:text-slate-300 transition-colors">Dashboard</Link>
            <Link href="/tool" className="hover:text-slate-300 transition-colors">Compress</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
