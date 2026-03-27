"use client";

import { CompressedFile } from "@/lib/types";
import { formatBytes } from "@/lib/utils";

interface StatsBarProps {
  files: CompressedFile[];
  onDownloadAll: () => void;
  onClear: () => void;
  isZipping: boolean;
}

export default function StatsBar({
  files,
  onDownloadAll,
  onClear,
  isZipping,
}: StatsBarProps) {
  const done = files.filter((f) => f.status === "done");

  if (done.length === 0) return null;

  const totalOriginal = done.reduce((s, f) => s + f.originalSize, 0);
  const totalCompressed = done.reduce((s, f) => s + f.compressedSize, 0);
  const totalSaved = totalOriginal - totalCompressed;
  const avgReduction = Math.round(
    done.reduce((s, f) => s + f.reductionPercent, 0) / done.length
  );

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-800 border border-slate-700/50 rounded-2xl px-6 py-4">
      {/* Stats */}
      <div className="flex flex-wrap gap-6">
        <Stat label="Files compressed" value={String(done.length)} />
        <Stat label="Total original" value={formatBytes(totalOriginal)} />
        <Stat
          label="Total compressed"
          value={formatBytes(totalCompressed)}
          highlight
        />
        <Stat label="Saved" value={formatBytes(totalSaved)} accent />
        <Stat label="Avg. reduction" value={`${avgReduction}%`} accent />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onClear}
          className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 rounded-lg transition-colors"
        >
          Clear all
        </button>
        <button
          onClick={onDownloadAll}
          disabled={isZipping}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          {isZipping ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Zipping…
            </>
          ) : (
            <>
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
              Download all ZIP
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  accent,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-slate-500">{label}</span>
      <span
        className={`text-sm font-semibold ${
          accent
            ? "text-emerald-400"
            : highlight
            ? "text-indigo-400"
            : "text-slate-200"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
