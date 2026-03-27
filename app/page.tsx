"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { v4 as uuidv4 } from "uuid";
import DropZone from "./components/DropZone";
import FileCard from "./components/FileCard";
import StatsBar from "./components/StatsBar";
import SettingsPanel from "./components/SettingsPanel";
import { useSettings } from "./hooks/useSettings";
import { PRESETS } from "@/lib/presets";
import type { CompressedFile } from "@/lib/types";
import type { CompressionOptions } from "@/lib/settings";

export default function Home() {
  const [files, setFiles] = useState<CompressedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [showRestoredToast, setShowRestoredToast] = useState(false);

  const { settings, setSettings, applyPreset, hydrated, wasRestored } = useSettings();

  // Show "restored" toast once after hydration, then auto-dismiss
  useEffect(() => {
    if (hydrated && wasRestored) {
      setShowRestoredToast(true);
      const t = setTimeout(() => setShowRestoredToast(false), 3500);
      return () => clearTimeout(t);
    }
  }, [hydrated, wasRestored]);

  // Auto-download ZIP when a batch finishes (if setting enabled)
  const prevProcessing = useRef(false);
  useEffect(() => {
    const justFinished = prevProcessing.current && !isProcessing;
    prevProcessing.current = isProcessing;

    if (justFinished && settings.autoDownload) {
      const done = files.filter((f) => f.status === "done");
      if (done.length > 0) triggerZipDownload(done);
    }
  }, [isProcessing, files, settings.autoDownload]);

  /** Derive the CompressionOptions from current settings */
  const buildOptions = useCallback((): CompressionOptions => {
    const preset = PRESETS[settings.preset];
    const targetSizeKB = settings.isCustomSize
      ? settings.customSizeKB
      : settings.targetSizeKB;

    const resizeW = settings.resize.enabled
      ? parseInt(settings.resize.width, 10) || null
      : null;
    const resizeH = settings.resize.enabled
      ? parseInt(settings.resize.height, 10) || null
      : null;

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

        const { results } = (await res.json()) as {
          results: Array<{
            error: string | null;
            outputName: string;
            outputUrl: string;
            outputFormat: string;
            compressedSize: number;
            reductionPercent: number;
            uploadId?: string;
            formatOverridden?: boolean;
            quality?: number;
          }>;
        };

        setFiles((prev) =>
          prev.map((f) => {
            const idx = entries.findIndex((e) => e.id === f.id);
            if (idx === -1 || results[idx] === undefined) return f;
            const result = results[idx];
            if (result.error) return { ...f, status: "error", error: result.error };
            return {
              ...f,
              status: "done",
              outputName: result.outputName,
              outputUrl: result.outputUrl,
              outputFormat: result.outputFormat,
              compressedSize: result.compressedSize,
              reductionPercent: result.reductionPercent,
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
            entries.some((e) => e.id === f.id)
              ? { ...f, status: "error", error: message }
              : f
          )
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [buildOptions, settings.format]
  );

  const handleRetry = useCallback((id: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, status: "compressing", error: null } : f
      )
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
        const json = await res.json() as {
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

  async function triggerZipDownload(
    done: CompressedFile[]
  ) {
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

  const handleDownloadAll = () => {
    triggerZipDownload(files.filter((f) => f.status === "done"));
  };

  const handleClear = () => {
    files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    setFiles([]);
  };

  const doneCount = files.filter((f) => f.status === "done").length;
  const effectiveSize = settings.isCustomSize
    ? settings.customSizeKB
    : settings.targetSizeKB;

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      {/* ── Header ── */}
      <header className="border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
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
            <span className="text-lg font-semibold tracking-tight">
              Compressly
            </span>
          </div>
          <span className="text-xs text-slate-500 font-medium bg-slate-800 px-3 py-1 rounded-full">
            Free · No limits · No login
          </span>
        </div>
      </header>

      {/* ── Restored settings toast ── */}
      <AnimatePresence>
        {showRestoredToast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium px-4 py-2.5 rounded-full shadow-xl shadow-slate-950/50"
          >
            <svg
              className="w-3.5 h-3.5 text-indigo-400 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Restored your last settings
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col gap-8">
        {/* ── Hero ── */}
        <div className="text-center flex flex-col items-center gap-4">
          {/* Branding pill */}
          <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold px-4 py-1.5 rounded-full">
            <span>🔥</span>
            <span>Smart Size Compression Engine</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
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

          <p className="text-slate-400 text-base max-w-xl leading-relaxed">
            ⚡ Auto-optimized to target size — best quality possible.
            <br />
            Upload any image, get a file under{" "}
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

        {/* ── Settings panel (sticky) ── */}
        {hydrated && (
          <div className="sticky top-4 z-20">
            <SettingsPanel
              settings={settings}
              onChange={setSettings}
              onPreset={applyPreset}
            />
          </div>
        )}

        {/* ── Drop zone ── */}
        <DropZone onFiles={handleFiles} disabled={isProcessing} />

        {/* ── Stats bar ── */}
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

        {/* ── File grid ── */}
        {files.length > 0 && (
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            <AnimatePresence>
              {files.map((file) => (
                <FileCard key={file.id} file={file} onRetry={handleRetry} onReoptimize={handleReoptimize} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── Empty state ── */}
        {files.length === 0 && (
          <div className="flex justify-center">
            <div className="flex flex-wrap justify-center gap-6 text-slate-600 text-sm">
              <Feature icon="🖼️" label="JPG, PNG, WebP, GIF" />
              <Feature icon="⚡" label="Binary-search quality" />
              <Feature icon="📦" label="Bulk + ZIP download" />
              <Feature icon="🔒" label="Your files stay local" />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Feature({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}
