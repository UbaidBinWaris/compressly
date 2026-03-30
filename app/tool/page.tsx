"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { v4 as uuidv4 } from "uuid";
import Link from "next/link";
import { useSettings } from "../hooks/useSettings";
import { usePasteUpload } from "../hooks/usePasteUpload";
import { PRESETS } from "@/lib/presets";
import type { CompressedFile } from "@/lib/types";
import type { CompressionOptions } from "@/lib/settings";

// ── Dynamic imports — no SSR, code-split away from landing page ───────────────

const DropZone = dynamic(() => import("../components/DropZone"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border-2 border-dashed border-slate-700/60 bg-slate-900/30 h-48 flex items-center justify-center">
      <span className="text-slate-600 text-sm">Loading…</span>
    </div>
  ),
});

const FileCard = dynamic(() => import("../components/FileCard"), { ssr: false });
const StatsBar = dynamic(() => import("../components/StatsBar"), { ssr: false });
const SettingsPanel = dynamic(() => import("../components/SettingsPanel"), {
  ssr: false,
  loading: () => <div className="h-14 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse" />,
});

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface FileResult {
  jobId?: string;
  outputUrl?: string;
  outputName?: string;
  originalSize?: number;
  compressedSize?: number;
  reductionPercent?: number;
  outputFormat?: string;
  uploadId?: string;
  formatOverridden?: boolean;
  quality?: number;
  cached?: boolean;
  originalName: string;
  error: string | null;
}

interface JobResultResponse {
  outputUrl: string;
  outputName: string;
  originalSize: number;
  compressedSize: number;
  reductionPercent: number;
  outputFormat: string;
  uploadId?: string;
  formatOverridden?: boolean;
  quality?: number;
  cached?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool page
// ─────────────────────────────────────────────────────────────────────────────

export default function ToolPage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [files, setFiles] = useState<CompressedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [showRestoredToast, setShowRestoredToast] = useState(false);

  const { settings, setSettings, applyPreset, hydrated, wasRestored } = useSettings();
  const pollingRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const handleFilesRef = useRef<(files: File[]) => void>(() => {});

  const { pasteToast } = usePasteUpload({
    onFiles: useCallback((f: File[]) => handleFilesRef.current(f), []),
    enabled: hydrated,
  });

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (hydrated && wasRestored) {
      setShowRestoredToast(true);
      const t = setTimeout(() => setShowRestoredToast(false), 3500);
      return () => clearTimeout(t);
    }
  }, [hydrated, wasRestored]);

  const prevProcessing = useRef(false);
  useEffect(() => {
    const justFinished = prevProcessing.current && !isProcessing;
    prevProcessing.current = isProcessing;
    if (justFinished && settings.autoDownload) {
      const done = files.filter((f) => f.status === "done");
      if (done.length > 0) triggerZipDownload(done);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProcessing, files, settings.autoDownload]);

  useEffect(() => {
    return () => {
      pollingRefs.current.forEach((id) => clearInterval(id));
    };
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const buildOptions = useCallback((): CompressionOptions => {
    const preset = PRESETS[settings.preset];
    const targetSizeKB = settings.isCustomSize ? settings.customSizeKB : settings.targetSizeKB;
    const resizeW = settings.resize.enabled ? parseInt(settings.resize.width, 10) || null : null;
    const resizeH = settings.resize.enabled ? parseInt(settings.resize.height, 10) || null : null;
    return {
      targetSizeKB,
      format: settings.format,
      qualityStart: preset.qualityStart,
      qualityMin: preset.qualityMin,
      qualityStep: preset.qualityStep,
      resize:
        resizeW || resizeH
          ? { width: resizeW, height: resizeH, maintainAspect: settings.resize.maintainAspect }
          : null,
      stripMetadata: settings.stripMetadata,
    };
  }, [settings]);

  const startPolling = useCallback(
    (fileId: string, jobId: string, originalSize: number) => {
      const existing = pollingRefs.current.get(fileId);
      if (existing) clearInterval(existing);

      const POLL_INTERVAL = 1500;
      // Warn the user when the job takes longer than the worker's internal
      // timeout (10 s). MAX_POLLS remains generous to handle slow queues.
      const SLOW_WARN_POLLS = Math.ceil(10_000 / POLL_INTERVAL); // ~7 polls
      const MAX_POLLS = 120;
      let polls = 0;

      const interval = setInterval(async () => {
        polls++;
        if (polls > MAX_POLLS) {
          clearInterval(interval);
          pollingRefs.current.delete(fileId);
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? { ...f, status: "error", error: "Job timed out — please re-upload." }
                : f
            )
          );
          return;
        }
        try {
          const statusRes = await fetch(`/api/status/${jobId}`);
          if (!statusRes.ok) return;
          const { status, reason } = (await statusRes.json()) as {
            status: string;
            progress?: number;
            reason?: string;
          };

          if (status === "processing") {
            // Show a slow-job warning once the job exceeds the expected timeout
            const isSlow = polls >= SLOW_WARN_POLLS;
            setFiles((prev) =>
              prev.map((f) =>
                f.id === fileId
                  ? {
                      ...f,
                      status: "compressing",
                      error: isSlow
                        ? "Taking longer than expected — still processing…"
                        : null,
                    }
                  : f
              )
            );
          }
          if (status === "pending") {
            // Still queued — keep status as "queued", clear any stale warning
            setFiles((prev) =>
              prev.map((f) =>
                f.id === fileId ? { ...f, status: "queued", error: null } : f
              )
            );
          }
          if (status === "completed") {
            clearInterval(interval);
            pollingRefs.current.delete(fileId);
            const resultRes = await fetch(`/api/result/${jobId}`);
            if (!resultRes.ok) throw new Error("Failed to fetch result");
            const r = (await resultRes.json()) as JobResultResponse;
            setFiles((prev) =>
              prev.map((f) =>
                f.id === fileId
                  ? {
                      ...f,
                      status: "done",
                      outputUrl: r.outputUrl,
                      outputName: r.outputName,
                      originalSize: r.originalSize || originalSize,
                      compressedSize: r.compressedSize,
                      reductionPercent: r.reductionPercent,
                      outputFormat: r.outputFormat,
                      uploadId: r.uploadId,
                      formatOverridden: r.formatOverridden,
                      quality: r.quality,
                      error: null,
                    }
                  : f
              )
            );
          }
          if (status === "failed") {
            clearInterval(interval);
            pollingRefs.current.delete(fileId);
            setFiles((prev) =>
              prev.map((f) =>
                f.id === fileId
                  ? {
                      ...f,
                      status: "error",
                      error: reason ?? "Compression job failed. Please retry.",
                    }
                  : f
              )
            );
          }
        } catch (err) {
          console.warn("[poll]", err);
        }
      }, POLL_INTERVAL);

      pollingRefs.current.set(fileId, interval);
    },
    []
  );

  const handleFiles = useCallback(
    async (newFiles: File[]) => {
      const options = buildOptions();
      const entries: CompressedFile[] = newFiles.map((f) => ({
        id: uuidv4(),
        originalName: f.name,
        outputName: "",
        outputUrl: "",
        outputFormat: settings.format,
        originalSize: f.size,
        compressedSize: 0,
        reductionPercent: 0,
        error: null,
        status: "compressing",
        previewUrl: URL.createObjectURL(f),
      }));
      setFiles((prev) => [...prev, ...entries]);
      setIsProcessing(true);

      const formData = new FormData();
      newFiles.forEach((f) => formData.append("files", f));
      formData.append("options", JSON.stringify(options));

      try {
        const res = await fetch("/api/compress", { method: "POST", body: formData });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error((json as { error?: string }).error ?? "Server error");
        }
        const { results } = (await res.json()) as { results: FileResult[] };

        setFiles((prev) =>
          prev.map((f) => {
            const idx = entries.findIndex((e) => e.id === f.id);
            if (idx === -1 || results[idx] === undefined) return f;
            const result = results[idx];
            if (result.error) return { ...f, status: "error", error: result.error };
            if (result.jobId) {
              setTimeout(() => startPolling(f.id, result.jobId!, f.originalSize), 0);
              return { ...f, status: "queued", jobId: result.jobId };
            }
            return {
              ...f,
              status: "done",
              outputUrl: result.outputUrl!,
              outputName: result.outputName!,
              outputFormat: result.outputFormat!,
              originalSize: result.originalSize ?? f.originalSize,
              compressedSize: result.compressedSize!,
              reductionPercent: result.reductionPercent!,
              uploadId: result.uploadId,
              formatOverridden: result.formatOverridden,
              quality: result.quality,
              error: null,
            };
          })
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setFiles((prev) =>
          prev.map((f) =>
            entries.some((e) => e.id === f.id) ? { ...f, status: "error", error: message } : f
          )
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [buildOptions, settings.format, startPolling]
  );

  useEffect(() => {
    handleFilesRef.current = handleFiles;
  }, [handleFiles]);

  const handleRetry = useCallback((id: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: "compressing", error: null } : f))
    );
  }, []);

  const handleReoptimize = useCallback(
    async (id: string) => {
      const file = files.find((f) => f.id === id);
      if (!file || !file.uploadId) return;
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: "reoptimizing", error: null } : f))
      );
      const options = buildOptions();
      try {
        const res = await fetch("/api/reoptimize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId: file.uploadId, options, originalName: file.originalName }),
        });
        const json = (await res.json()) as {
          result?: {
            outputName: string;
            outputUrl: string;
            outputFormat: string;
            compressedSize: number;
            reductionPercent: number;
            uploadId?: string;
            formatOverridden?: boolean;
            quality?: number;
          };
          error?: string;
        };
        if (!res.ok || json.error) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === id ? { ...f, status: "error", error: json.error ?? "Re-optimize failed" } : f
            )
          );
        } else if (json.result) {
          const r = json.result;
          setFiles((prev) =>
            prev.map((f) =>
              f.id === id
                ? {
                    ...f,
                    status: "done",
                    outputName: r.outputName,
                    outputUrl: r.outputUrl,
                    outputFormat: r.outputFormat,
                    compressedSize: r.compressedSize,
                    reductionPercent: r.reductionPercent,
                    uploadId: r.uploadId ?? f.uploadId,
                    formatOverridden: r.formatOverridden,
                    quality: r.quality,
                    error: null,
                  }
                : f
            )
          );
        }
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id
              ? { ...f, status: "error", error: err instanceof Error ? err.message : "Network error" }
              : f
          )
        );
      }
    },
    [files, buildOptions]
  );

  async function triggerZipDownload(done: CompressedFile[]) {
    if (done.length === 0 || isZipping) return;
    setIsZipping(true);
    try {
      const res = await fetch("/api/download-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filenames: done.map((f) => f.outputName) }),
      });
      if (!res.ok) throw new Error("ZIP generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "compressly-images.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setIsZipping(false);
    }
  }

  const handleDownloadAll = () => triggerZipDownload(files.filter((f) => f.status === "done"));
  const handleClear = () => {
    pollingRefs.current.forEach((id) => clearInterval(id));
    pollingRefs.current.clear();
    files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    setFiles([]);
  };

  const doneCount = files.filter((f) => f.status === "done").length;
  const effectiveSize = settings.isCustomSize ? settings.customSizeKB : settings.targetSizeKB;

  // ── JSX ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-white flex flex-col">

      {/* ── Toasts ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showRestoredToast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium px-4 py-2.5 rounded-full shadow-xl shadow-slate-950/50"
          >
            <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Restored your last settings
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {pasteToast.visible && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ duration: 0.18, type: "spring", stiffness: 300 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-indigo-600 border border-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-xl shadow-indigo-950/60"
          >
            <span className="text-sm">⚡</span>
            {pasteToast.count === 1
              ? "Pasted image detected — optimizing…"
              : `${pasteToast.count} pasted images detected — optimizing…`}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-background/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
          {/* Logo + nav */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <span className="text-base font-bold tracking-tight group-hover:text-indigo-300 transition-colors">
                Compressly
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <span className="text-sm font-semibold text-indigo-400">Tool</span>
              {[
                { label: "Video", href: "/video" },
                { label: "API Docs", href: "/docs" },
                { label: "Dashboard", href: "/dashboard" },
              ].map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  className="text-sm text-slate-400 hover:text-slate-200 transition-colors font-medium"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-slate-500 font-medium bg-slate-800/80 border border-slate-700/50 px-3 py-1 rounded-full">
              Free · No login
            </span>
            <Link
              href="/"
              className="text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Home
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 py-16 px-6">
        <div className="max-w-6xl mx-auto flex flex-col gap-10">

          {/* Page heading */}
          <div className="flex flex-col items-center text-center gap-3">
            <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold px-4 py-1.5 rounded-full">
              🔥 Smart Size Compression Engine
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Compress images to{" "}
              <AnimatePresence mode="wait">
                {hydrated && (
                  <motion.span
                    key={settings.format}
                    className="text-indigo-400"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.18 }}
                  >
                    {settings.format.toUpperCase()}
                  </motion.span>
                )}
              </AnimatePresence>
            </h1>
            <p className="text-slate-400 max-w-xl leading-relaxed">
              ⚡ Auto-optimized to target size — best quality possible. Upload any image, get a
              file under{" "}
              <AnimatePresence mode="wait">
                <motion.span
                  key={effectiveSize}
                  className="text-slate-200 font-semibold"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {effectiveSize} KB
                </motion.span>
              </AnimatePresence>{" "}
              — free, instant, no login.
            </p>
          </div>

          {/* Settings panel — sticky below header */}
          {hydrated && (
            <div className="sticky top-16.25 z-20">
              <SettingsPanel settings={settings} onChange={setSettings} onPreset={applyPreset} />
            </div>
          )}

          {/* Drop zone */}
          <DropZone onFiles={handleFiles} disabled={isProcessing} />

          {/* Stats bar */}
          <AnimatePresence>
            {doneCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
              >
                <StatsBar
                  files={files}
                  onDownloadAll={handleDownloadAll}
                  onClear={handleClear}
                  isZipping={isZipping}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* File grid */}
          {files.length > 0 && (
            <motion.div
              layout
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            >
              <AnimatePresence>
                {files.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    onRetry={handleRetry}
                    onReoptimize={handleReoptimize}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Empty state */}
          {files.length === 0 && (
            <div className="flex justify-center">
              <div className="flex flex-wrap justify-center gap-6 text-slate-600 text-sm">
                {[
                  "🖼️ JPG, PNG, WebP, AVIF",
                  "⚡ Queue + hash cache",
                  "📦 Bulk + ZIP download",
                  "🔒 Files auto-expire in 1 hr",
                ].map((t) => (
                  <span key={t} className="flex items-center gap-2">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 py-8 px-6 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
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
            <Link href="/" className="hover:text-slate-300 transition-colors">Home</Link>
            <Link href="/docs" className="hover:text-slate-300 transition-colors">API Docs</Link>
            <Link href="/dashboard" className="hover:text-slate-300 transition-colors">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
