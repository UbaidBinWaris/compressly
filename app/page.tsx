"use client";

import { useCallback, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import DropZone from "./components/DropZone";
import FileCard from "./components/FileCard";
import StatsBar from "./components/StatsBar";
import { CompressedFile } from "@/lib/types";

export default function Home() {
  const [files, setFiles] = useState<CompressedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  const handleFiles = useCallback(async (newFiles: File[]) => {
    // Build pending entries immediately so the user sees them
    const entries: CompressedFile[] = newFiles.map((f) => ({
      id: uuidv4(),
      originalName: f.name,
      outputName: "",
      outputUrl: "",
      originalSize: f.size,
      compressedSize: 0,
      reductionPercent: 0,
      error: null,
      status: "pending",
      previewUrl: URL.createObjectURL(f),
    }));

    setFiles((prev) => [...prev, ...entries]);
    setIsProcessing(true);

    // Mark all new entries as compressing
    setFiles((prev) =>
      prev.map((f) =>
        entries.some((e) => e.id === f.id)
          ? { ...f, status: "compressing" }
          : f
      )
    );

    // Upload
    const formData = new FormData();
    newFiles.forEach((f) => formData.append("files", f));

    try {
      const res = await fetch("/api/compress", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Server error");
      }

      const { results } = await res.json();

      setFiles((prev) =>
        prev.map((f) => {
          const idx = entries.findIndex((e) => e.id === f.id);
          if (idx === -1 || results[idx] === undefined) return f;

          const result = results[idx];

          if (result.error) {
            return { ...f, status: "error", error: result.error };
          }

          return {
            ...f,
            status: "done",
            outputName: result.outputName,
            outputUrl: result.outputUrl,
            compressedSize: result.compressedSize,
            reductionPercent: result.reductionPercent,
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
  }, []);

  const handleDownloadAll = async () => {
    const done = files.filter((f) => f.status === "done");
    if (done.length === 0) return;

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
  };

  const handleClear = () => {
    files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    setFiles([]);
  };

  const doneCount = files.filter((f) => f.status === "done").length;

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      {/* Header */}
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

      <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col gap-10">
        {/* Hero */}
        <div className="text-center flex flex-col items-center gap-3">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Compress images to{" "}
            <span className="text-indigo-400">WebP</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl">
            Upload any image and get a WebP under 100 KB — automatically. Free,
            fast, and runs in your browser.
          </p>
        </div>

        {/* Drop zone */}
        <DropZone onFiles={handleFiles} disabled={isProcessing} />

        {/* Stats bar */}
        {doneCount > 0 && (
          <StatsBar
            files={files}
            onDownloadAll={handleDownloadAll}
            onClear={handleClear}
            isZipping={isZipping}
          />
        )}

        {/* File grid */}
        {files.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {files.map((file) => (
              <FileCard key={file.id} file={file} />
            ))}
          </div>
        )}

        {/* Empty state hints */}
        {files.length === 0 && (
          <div className="flex justify-center">
            <div className="flex flex-wrap justify-center gap-6 text-slate-600 text-sm">
              <Feature icon="🖼️" label="JPG, PNG, WebP, GIF" />
              <Feature icon="⚡" label="Instant processing" />
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
