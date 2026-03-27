"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CompressedFile } from "@/lib/types";
import { formatBytes } from "@/lib/utils";

interface FileCardProps {
  file: CompressedFile;
  onRetry?: (id: string) => void;
  onReoptimize?: (id: string) => void;
}

const FORMAT_COLORS: Record<string, string> = {
  webp: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  avif: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  jpeg: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  jpg: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  png: "bg-sky-500/20 text-sky-300 border-sky-500/30",
};

export default function FileCard({ file, onRetry, onReoptimize }: FileCardProps) {
  const [copied, setCopied] = useState(false);

  const isDone = file.status === "done";
  const isError = file.status === "error";
  const isReoptimizing = file.status === "reoptimizing";
  const isProcessing =
    file.status === "pending" || file.status === "compressing" || isReoptimizing;

  const fmtKey = file.outputFormat?.toLowerCase();
  const fmtColor = FORMAT_COLORS[fmtKey] ?? FORMAT_COLORS["webp"];

  const handleCopy = async () => {
    const url = `${window.location.origin}${file.outputUrl}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied — silent fail
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="group flex flex-col bg-slate-800 border border-slate-700/50 rounded-xl overflow-hidden hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-950/40 transition-[border-color,box-shadow] duration-200"
    >
      {/* ── Preview ── */}
      <div className="relative aspect-video bg-slate-900 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={file.previewUrl}
          alt={file.originalName}
          className="w-full h-full object-cover"
        />

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-slate-900/85 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400 font-medium">
              {isReoptimizing ? "Re-optimizing…" : "Compressing…"}
            </span>
          </div>
        )}

        {/* Error overlay */}
        {isError && (
          <div className="absolute inset-0 bg-red-950/85 flex flex-col items-center justify-center gap-2 p-4">
            <svg
              className="w-6 h-6 text-red-400 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <span className="text-xs text-red-300 text-center leading-snug line-clamp-3">
              {file.error}
            </span>
            <div className="flex gap-2 mt-1">
              {onRetry && (
                <button
                  onClick={() => onRetry(file.id)}
                  className="px-3 py-1 text-xs font-semibold bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 rounded-lg transition-colors"
                >
                  Retry
                </button>
              )}
              {onReoptimize && file.uploadId && (
                <button
                  onClick={() => onReoptimize(file.id)}
                  className="px-3 py-1 text-xs font-semibold bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 rounded-lg transition-colors"
                >
                  Re-optimize
                </button>
              )}
            </div>
          </div>
        )}

        {/* Success badges */}
        {isDone && (
          <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
            <span className="bg-emerald-500/90 text-white text-xs font-semibold px-2 py-0.5 rounded-full shadow">
              −{file.reductionPercent}%
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${fmtColor}`}
            >
              {(file.outputFormat ?? "webp").toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* ── Format override warning ── */}
      {isDone && file.formatOverridden && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-[11px] font-medium">
          <svg
            className="w-3.5 h-3.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9.303-9.126c.866 1.5-.217 3.374-1.948 3.374h-14.71c-1.73 0-2.813-1.874-1.948-3.374L10.051 2.628c.866-1.5 3.032-1.5 3.898 0l7.354 12.748zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          Transparency detected — saved as{" "}
          <strong className="text-amber-200">{(file.outputFormat ?? "webp").toUpperCase()}</strong>
        </div>
      )}

      {/* ── Info ── */}
      <div className="flex flex-col gap-3 p-4">
        <p
          className="text-sm font-medium text-slate-200 truncate"
          title={file.originalName}
        >
          {file.originalName}
        </p>

        {/* Shimmer skeleton while processing */}
        {isProcessing && (
          <div className="flex flex-col gap-2">
            <div className="h-7 rounded-lg shimmer" />
            <div className="h-1.5 rounded-full shimmer" />
            <div className="h-8 rounded-lg shimmer mt-1" />
          </div>
        )}

        {isDone && (
          <>
            {/* Size stats */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex flex-col bg-slate-900/60 rounded-lg px-3 py-2">
                <span className="text-slate-500 mb-0.5">Original</span>
                <span className="text-slate-300 font-medium">
                  {formatBytes(file.originalSize)}
                </span>
              </div>
              <div className="flex flex-col bg-slate-900/60 rounded-lg px-3 py-2">
                <span className="text-slate-500 mb-0.5">Compressed</span>
                <span className="text-emerald-400 font-medium">
                  {formatBytes(file.compressedSize)}
                </span>
              </div>
            </div>

            {/* Animated compression bar */}
            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(2, 100 - file.reductionPercent)}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            </div>

            {/* Download + Re-optimize + Copy row */}
            <div className="flex gap-2">
              <a
                href={file.outputUrl}
                download={file.outputName}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-medium transition-colors"
              >
                <svg
                  className="w-4 h-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
                Download
              </a>

              {/* Re-optimize button — only when original is still available on server */}
              {onReoptimize && file.uploadId && (
                <button
                  onClick={() => onReoptimize(file.id)}
                  title="Re-compress with current settings (no re-upload needed)"
                  className="flex items-center justify-center w-9 rounded-lg border border-slate-700 bg-slate-900/40 text-slate-400 hover:border-indigo-500/50 hover:text-indigo-400 transition-all shrink-0"
                >
                  {/* Refresh / re-optimize icon */}
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                    />
                  </svg>
                </button>
              )}

              {/* Copy URL button */}
              <button
                onClick={handleCopy}
                title="Copy direct URL"
                className={[
                  "flex items-center justify-center w-9 rounded-lg border text-xs font-semibold transition-all shrink-0",
                  copied
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                    : "border-slate-700 bg-slate-900/40 text-slate-400 hover:border-slate-500 hover:text-slate-300",
                ].join(" ")}
              >
                {copied ? (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
                    />
                  </svg>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
