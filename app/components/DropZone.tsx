"use client";

import { useCallback, useRef, useState } from "react";

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export default function DropZone({ onFiles, disabled }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      const valid = Array.from(fileList).filter((f) =>
        ACCEPTED.includes(f.type)
      );
      if (valid.length) onFiles(valid);
    },
    [onFiles]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      handleFiles(e.dataTransfer.files);
    },
    [disabled, handleFiles]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset so the same file can be re-uploaded
    e.target.value = "";
  };

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={[
        "relative flex flex-col items-center justify-center gap-4",
        "border-2 border-dashed rounded-2xl px-8 py-16 cursor-pointer",
        "transition-all duration-200 select-none",
        dragging
          ? "border-indigo-400 bg-indigo-500/10 scale-[1.01]"
          : "border-slate-700 bg-slate-800/50 hover:border-indigo-500 hover:bg-slate-800",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        multiple
        className="hidden"
        onChange={onInputChange}
        disabled={disabled}
      />

      {/* Icon */}
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/30">
        <svg
          className="w-8 h-8 text-indigo-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
      </div>

      <div className="text-center">
        <p className="text-base font-medium text-slate-200">
          {dragging ? "Drop your images here" : "Drag & drop images here"}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          or{" "}
          <span className="text-indigo-400 font-medium">browse files</span>
        </p>
        <p className="mt-3 text-xs text-slate-600">
          JPG, PNG, WebP, GIF · Max 20 MB per file
        </p>
      </div>
    </div>
  );
}
