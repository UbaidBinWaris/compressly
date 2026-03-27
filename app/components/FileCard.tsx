"use client";

import { CompressedFile } from "@/lib/types";
import { formatBytes } from "@/lib/utils";

interface FileCardProps {
  file: CompressedFile;
}

export default function FileCard({ file }: FileCardProps) {
  const isDone = file.status === "done";
  const isError = file.status === "error";
  const isProcessing =
    file.status === "pending" || file.status === "compressing";

  return (
    <div className="group relative flex flex-col bg-slate-800 border border-slate-700/50 rounded-xl overflow-hidden transition-all duration-200 hover:border-slate-600">
      {/* Preview image */}
      <div className="relative aspect-video bg-slate-900 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={file.previewUrl}
          alt={file.originalName}
          className="w-full h-full object-cover"
        />

        {/* Overlay during processing */}
        {isProcessing && (
          <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-400">Compressing…</span>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {isError && (
          <div className="absolute inset-0 bg-red-900/60 flex items-center justify-center p-3">
            <span className="text-xs text-red-200 text-center leading-snug">
              {file.error}
            </span>
          </div>
        )}

        {/* Success badge */}
        {isDone && (
          <div className="absolute top-2 right-2 bg-emerald-500/90 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
            −{file.reductionPercent}%
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-3 p-4">
        <p
          className="text-sm font-medium text-slate-200 truncate"
          title={file.originalName}
        >
          {file.originalName}
        </p>

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

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                style={{
                  width: `${Math.max(
                    2,
                    100 - file.reductionPercent
                  )}%`,
                }}
              />
            </div>

            {/* Download */}
            <a
              href={file.outputUrl}
              download={`compressed-${file.outputName}`}
              className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-medium transition-colors"
            >
              <svg
                className="w-4 h-4"
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
              Download WebP
            </a>
          </>
        )}
      </div>
    </div>
  );
}
