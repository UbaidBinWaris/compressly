"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type OutputFormat   = "mp4" | "webm";
type Resolution     = "1080p" | "720p" | "480p";
type Bitrate        = "low" | "medium" | "high";
type AudioMode      = "replace" | "mix";
type SubtitleAlign  = "left" | "center" | "right";
type SettingsTab    = "video" | "audio" | "subtitles";
type JobStatus      = "idle" | "uploading" | "processing" | "completed" | "failed";

interface VideoSettings {
  format:     OutputFormat;
  resolution: Resolution;
  bitrate:    Bitrate;
}

interface AudioSettings {
  musicFile:   File | null;
  musicVolume: number;      // 0–100
  musicLoop:   boolean;
  audioMode:   AudioMode;
}

interface SubtitleSettings {
  srtFile:    File | null;
  fontFamily: string;
  fontSize:   number;
  fontColor:  string;
  bgColor:    string;
  padding:    number;
  marginBottom: number;
  align:      SubtitleAlign;
}

interface VideoFile {
  file:       File;
  objectUrl:  string;
  duration:   number | null;
}

interface ProcessResult {
  originalSize:    number;
  compressedSize:  number;
  reductionPercent: number;
  outputUrl:       string | null;   // null when output is not yet available (e.g. simulated)
  outputName:      string;
  outputFormat:    string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ACCEPTED_VIDEO_MIME  = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const ACCEPTED_VIDEO_EXT   = new Set([".mp4", ".mov", ".webm"]);
const ACCEPTED_AUDIO_MIME  = new Set(["audio/mpeg", "audio/wav", "audio/wave", "audio/x-wav"]);
const ACCEPTED_AUDIO_EXT   = new Set([".mp3", ".wav"]);
const MAX_VIDEO_BYTES       = 500 * 1024 * 1024;
const MAX_AUDIO_BYTES       = 50  * 1024 * 1024;

const FONT_FAMILIES = ["Arial", "Georgia", "Impact", "Courier New", "Trebuchet MS", "Verdana"];

const BITRATE_META: Record<Bitrate, { label: string; detail: string }> = {
  low:    { label: "Low",    detail: "Smallest file" },
  medium: { label: "Medium", detail: "Balanced"      },
  high:   { label: "High",   detail: "Best quality"  },
};

const DEFAULT_VIDEO: VideoSettings    = { format: "mp4",    resolution: "720p",   bitrate: "medium" };
const DEFAULT_AUDIO: AudioSettings    = { musicFile: null,  musicVolume: 80, musicLoop: false, audioMode: "mix" };
const DEFAULT_SUBS:  SubtitleSettings = {
  srtFile: null, fontFamily: "Arial", fontSize: 22,
  fontColor: "#ffffff", bgColor: "#00000080",
  padding: 6, marginBottom: 32, align: "center",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true only when src is a usable media URL (blob: or a real server path, never "#" or null) */
function isValidMediaSrc(src: string | null | undefined): src is string {
  return !!src && src !== "#";
}

function fmtBytes(b: number): string {
  if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(2)} GB`;
  if (b >= 1_048_576)     return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b >= 1_024)         return `${(b / 1_024).toFixed(0)} KB`;
  return `${b} B`;
}

function fmtTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function isVideo(f: File) {
  const ext = "." + f.name.split(".").pop()?.toLowerCase();
  return ACCEPTED_VIDEO_MIME.has(f.type) || ACCEPTED_VIDEO_EXT.has(ext);
}
function isAudio(f: File) {
  const ext = "." + f.name.split(".").pop()?.toLowerCase();
  return ACCEPTED_AUDIO_MIME.has(f.type) || ACCEPTED_AUDIO_EXT.has(ext);
}

// ─────────────────────────────────────────────────────────────────────────────
// VideoDropZone
// ─────────────────────────────────────────────────────────────────────────────

function VideoDropZone({ onFile, disabled }: { onFile: (f: File) => void; disabled: boolean }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (file: File) => {
    if (!isVideo(file))               return setError(`Unsupported: "${file.name}". Use MP4, MOV, or WebM.`);
    if (file.size > MAX_VIDEO_BYTES)  return setError(`Too large (max 500 MB): ${file.name}`);
    setError(null);
    onFile(file);
  };

  return (
    <div className="flex flex-col gap-3">
      <motion.button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) pick(f); }}
        animate={dragging ? { scale: 1.015 } : { scale: 1 }}
        transition={{ duration: 0.15 }}
        className={[
          "relative w-full rounded-2xl border-2 border-dashed transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
          disabled       ? "border-slate-800 bg-slate-900/20 cursor-not-allowed opacity-50"
          : dragging     ? "border-violet-500 bg-violet-500/10 cursor-copy"
                         : "border-slate-700/60 bg-slate-900/30 hover:border-slate-600 hover:bg-slate-900/50 cursor-pointer",
        ].join(" ")}
      >
        <div className="flex flex-col items-center justify-center gap-4 py-12 px-6 pointer-events-none">
          <div className={["w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
            dragging ? "bg-violet-500/20 border border-violet-500/40" : "bg-slate-800/60 border border-slate-700/50"].join(" ")}>
            <svg className={dragging ? "w-7 h-7 text-violet-400" : "w-7 h-7 text-slate-400"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <div className="text-center">
            <p className={`text-sm font-semibold ${dragging ? "text-violet-300" : "text-slate-300"}`}>
              {dragging ? "Drop to load video" : "Drop your video here"}
            </p>
            <p className="text-xs text-slate-500 mt-1">or click to browse · MP4, MOV, WebM · max 500 MB</p>
          </div>
          <div className="flex gap-2">
            {["MP4", "MOV", "WebM"].map((f) => (
              <span key={f} className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700/50 text-slate-400">{f}</span>
            ))}
          </div>
        </div>
      </motion.button>

      <input ref={inputRef} type="file" accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
        className="hidden" disabled={disabled}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />

      {error && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs text-red-400 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {error}
        </motion.p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// useVideoPlayer — encapsulates all video element state and event handling
// ─────────────────────────────────────────────────────────────────────────────

function useVideoPlayer(src: string | null) {
  const ref      = useRef<HTMLVideoElement>(null);
  const [playing,   setPlaying]   = useState(false);
  const [current,   setCurrent]   = useState(0);
  const [duration,  setDuration]  = useState(0);
  const [volume,    setVolume]    = useState(1);       // 0–1
  const [muted,     setMuted]     = useState(false);
  const [ready,     setReady]     = useState(false);   // metadata loaded
  const [playError, setPlayError] = useState<string | null>(null);

  // Reset state whenever the source changes
  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    setReady(false);
    setPlayError(null);
  }, [src]);

  // Keep video.volume in sync with state (avoids direct DOM manipulation everywhere)
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.volume = volume;
    v.muted  = muted;
  }, [volume, muted]);

  const togglePlay = async () => {
    const v = ref.current;
    if (!v || !ready) return;

    if (!v.paused) {
      v.pause();
      setPlaying(false);
      return;
    }

    try {
      await v.play();
      setPlaying(true);
      setPlayError(null);
    } catch (err) {
      // AbortError fires when play() is interrupted by a rapid pause — safe to ignore
      if (err instanceof DOMException && err.name === "AbortError") return;
      const msg = err instanceof DOMException ? err.message : "Playback failed";
      setPlayError(msg);
      setPlaying(false);
      console.error("[VideoPlayer] play() rejected:", err);
    }
  };

  const seek = (value: number) => {
    const v = ref.current;
    if (!v || !ready) return;
    v.currentTime = value;
    setCurrent(value);
  };

  const changeVolume = (value: number) => {
    setVolume(value);
    setMuted(value === 0);
  };

  const toggleMute = () => {
    if (muted) {
      setMuted(false);
      // Restore to a sensible level if volume was at 0
      if (volume === 0) setVolume(0.5);
    } else {
      setMuted(true);
    }
  };

  // Native event handlers to attach to <video>
  const handlers = {
    onLoadedMetadata: () => {
      const v = ref.current;
      if (!v) return;
      setDuration(v.duration);
      setReady(true);
    },
    onTimeUpdate:  () => setCurrent(ref.current?.currentTime ?? 0),
    onEnded:       () => setPlaying(false),
    onPause:       () => setPlaying(false),
    onPlay:        () => setPlaying(true),
    onError:       () => {
      const v   = ref.current;
      const err = v?.error;
      const msg = err ? mediaErrorMessage(err.code) : "Video could not be loaded";
      setPlayError(msg);
      setPlaying(false);
      setReady(false);
    },
  };

  return {
    ref, playing, current, duration, volume, muted, ready, playError,
    togglePlay, seek, changeVolume, toggleMute, handlers,
  };
}

/** Convert MediaError.code to a human-readable string */
function mediaErrorMessage(code: number): string {
  switch (code) {
    case 1:  return "Playback aborted";
    case 2:  return "Network error while loading video";
    case 3:  return "Video decoding failed — the file may be corrupted";
    case 4:  return "Unsupported video format — try MP4 (H.264) or WebM (VP9)";
    default: return "Unknown playback error";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VideoPlayer — renders a single player with full custom controls
// ─────────────────────────────────────────────────────────────────────────────

function VideoPlayer({
  src,
  label,
  accentClass = "bg-violet-500",
}: {
  src: string | null;
  label: string;
  accentClass?: string;
}) {
  console.log("[VideoPlayer] src:", src, "label:", label);

  const {
    ref, playing, current, duration, volume, muted, ready, playError,
    togglePlay, seek, changeVolume, toggleMute, handlers,
  } = useVideoPlayer(src);

  // Never render a video element for invalid/placeholder sources
  if (!isValidMediaSrc(src)) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${accentClass}`} />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
        </div>
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 flex items-center justify-center"
          style={{ aspectRatio: "16/9" }}>
          <p className="text-xs text-slate-600 text-center px-4">
            Output will appear here once FFmpeg processing is wired up.
          </p>
        </div>
      </div>
    );
  }

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="flex flex-col gap-2">
      {/* Label */}
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${accentClass}`} />
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
        {!ready && !playError && (
          <span className="text-[10px] text-slate-600 animate-pulse">Loading…</span>
        )}
      </div>

      {/* Video container */}
      <div
        className="relative rounded-xl overflow-hidden bg-black border border-slate-700/60"
        style={{ aspectRatio: "16/9" }}
      >
        {/* The video element — objectURL from createObjectURL is always safe as src */}
        <video
          ref={ref}
          key={src}                   // remount element when src changes to avoid stale buffers
          preload="metadata"
          playsInline
          className="w-full h-full object-contain"
          {...handlers}
        >
          {/*
            Using <source> lets the browser pick the most-compatible type.
            The type hint is derived from the blob URL's original MIME where possible;
            omitting it is also valid — the browser will probe the stream.
          */}
          <source src={src} />
          Your browser does not support HTML5 video.
        </video>

        {/* Play/pause click overlay — only rendered when no error */}
        {!playError && (
          <button
            onClick={togglePlay}
            disabled={!ready}
            className="absolute inset-0 flex items-center justify-center group/play focus:outline-none disabled:cursor-default"
            aria-label={playing ? "Pause" : "Play"}
          >
            <AnimatePresence>
              {!playing && ready && (
                <motion.div
                  key="play-btn"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/20 group-hover/play:bg-black/80 transition-colors"
                >
                  <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5.14v14l11-7-11-7z" />
                  </svg>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        )}

        {/* Loading skeleton */}
        {!ready && !playError && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 pointer-events-none">
            <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          </div>
        )}

        {/* Playback error overlay */}
        {playError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/90 px-6 text-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-red-400 font-semibold">Playback error</p>
            <p className="text-xs text-slate-500 leading-relaxed">{playError}</p>
          </div>
        )}
      </div>

      {/* Control bar */}
      <div className={["flex flex-col gap-2 transition-opacity", !ready ? "opacity-40 pointer-events-none" : ""].join(" ")}>
        {/* Seek row */}
        <div className="flex items-center gap-3">
          {/* Play/pause */}
          <button
            onClick={togglePlay}
            disabled={!ready}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-800 hover:bg-slate-700 transition-colors shrink-0 disabled:opacity-40"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing
              ? <svg className="w-4 h-4 text-slate-200" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              : <svg className="w-4 h-4 text-slate-200 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5.14v14l11-7-11-7z"/></svg>
            }
          </button>

          {/* Seek bar */}
          <div className="relative flex-1 h-5 flex items-center">
            <div className="absolute inset-x-0 h-1.5 rounded-full bg-slate-700 overflow-hidden">
              <div className="h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
            </div>
            <input
              type="range" min={0} max={duration || 1} step={0.05} value={current}
              onChange={(e) => seek(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Seek"
            />
          </div>

          {/* Time */}
          <span className="text-xs text-slate-500 font-mono shrink-0 tabular-nums w-[88px] text-right">
            {fmtTime(current)} / {fmtTime(duration)}
          </span>
        </div>

        {/* Volume row */}
        <div className="flex items-center gap-3">
          {/* Mute toggle */}
          <button
            onClick={toggleMute}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-800/60 hover:bg-slate-700/60 transition-colors shrink-0"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted || volume === 0 ? (
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.531V19.94a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.506-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53L6.75 15.75H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.757 3.63 8.25 4.51 8.25H6.75z" />
              </svg>
            )}
          </button>

          {/* Volume slider */}
          <div className="relative w-20 h-5 flex items-center">
            <div className="absolute inset-x-0 h-1 rounded-full bg-slate-700 overflow-hidden">
              <div className="h-full rounded-full bg-slate-500" style={{ width: `${(muted ? 0 : volume) * 100}%` }} />
            </div>
            <input
              type="range" min={0} max={1} step={0.02}
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Volume"
            />
          </div>

          <span className="text-[10px] text-slate-600 font-mono tabular-nums">
            {Math.round((muted ? 0 : volume) * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BeforeAfterPlayer — side-by-side on desktop, tabbed on mobile
// ─────────────────────────────────────────────────────────────────────────────

function BeforeAfterPlayers({ original, result }: { original: VideoFile; result: ProcessResult }) {
  const [view, setView] = useState<"before" | "after" | "split">("split");

  return (
    <div className="flex flex-col gap-4">
      {/* Toggle bar */}
      <div className="flex items-center gap-2">
        {(["before", "split", "after"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={[
              "flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all border",
              view === v
                ? "bg-violet-600/20 border-violet-500/40 text-violet-300"
                : "bg-slate-800/50 border-slate-700/40 text-slate-500 hover:text-slate-300",
            ].join(" ")}>
            {v === "split" ? "Side by Side" : v}
          </button>
        ))}
      </div>

      {view === "split" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <VideoPlayer src={original.objectUrl}  label="Original"  accentClass="bg-slate-500" />
          <VideoPlayer src={result.outputUrl}    label="Processed" accentClass="bg-violet-500" />
        </div>
      ) : view === "before" ? (
        <VideoPlayer src={original.objectUrl} label="Original" accentClass="bg-slate-500" />
      ) : (
        <VideoPlayer src={result.outputUrl}   label="Processed" accentClass="bg-violet-500" />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ToggleSwitch
// ─────────────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative w-9 h-5 rounded-full transition-colors shrink-0",
        checked ? "bg-violet-600" : "bg-slate-700",
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      <span className={["absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
        checked ? "translate-x-4" : "translate-x-0.5"].join(" ")} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FilePicker — generic small audio/srt picker
// ─────────────────────────────────────────────────────────────────────────────

function FilePicker({
  file, accept, label, hint, maxBytes, validator, onChange, disabled,
}: {
  file: File | null;
  accept: string;
  label: string;
  hint: string;
  maxBytes: number;
  validator: (f: File) => boolean;
  onChange: (f: File | null) => void;
  disabled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const pick = (f: File) => {
    if (!validator(f))         return setError(`Unsupported file type.`);
    if (f.size > maxBytes)     return setError(`Too large (max ${fmtBytes(maxBytes)}).`);
    setError(null);
    onChange(f);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-slate-300">{label}</span>
      {file ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-800/50 px-3 py-2">
          <svg className="w-4 h-4 text-violet-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
          </svg>
          <span className="flex-1 text-xs text-slate-300 truncate">{file.name}</span>
          <span className="text-[10px] text-slate-500">{fmtBytes(file.size)}</span>
          <button onClick={() => { setError(null); onChange(null); }}
            className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <button type="button" disabled={disabled}
          onClick={() => ref.current?.click()}
          className="flex items-center gap-2 rounded-xl border border-dashed border-slate-700/60 bg-slate-900/40 px-3 py-2.5 text-xs text-slate-400 hover:text-slate-300 hover:border-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          {hint}
        </button>
      )}
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings Panel — tabbed: Video / Audio / Subtitles
// ─────────────────────────────────────────────────────────────────────────────

function SettingsPanel({
  video, audio, subs,
  onVideo, onAudio, onSubs,
  disabled,
}: {
  video: VideoSettings; audio: AudioSettings; subs: SubtitleSettings;
  onVideo: (s: VideoSettings) => void;
  onAudio: (s: AudioSettings) => void;
  onSubs:  (s: SubtitleSettings) => void;
  disabled: boolean;
}) {
  const [tab, setTab] = useState<SettingsTab>("video");

  const TABS: { id: SettingsTab; label: string; dot?: boolean }[] = [
    { id: "video",     label: "Video" },
    { id: "audio",     label: "Audio",     dot: !!audio.musicFile },
    { id: "subtitles", label: "Subtitles", dot: !!subs.srtFile   },
  ];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-slate-800">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={[
              "flex-1 py-3 text-xs font-semibold transition-colors relative",
              tab === t.id ? "text-violet-300 bg-violet-500/5" : "text-slate-500 hover:text-slate-300",
            ].join(" ")}>
            {t.label}
            {t.dot && <span className="absolute top-2.5 right-3 w-1.5 h-1.5 rounded-full bg-violet-500" />}
            {tab === t.id && (
              <motion.div layoutId="tab-indicator"
                className="absolute bottom-0 inset-x-0 h-0.5 bg-violet-500"
                transition={{ duration: 0.2 }} />
            )}
          </button>
        ))}
      </div>

      <div className="p-5 flex flex-col gap-5">

        {/* ── Video tab ─────────────────────────────────────────────────── */}
        {tab === "video" && (
          <>
            {/* Format */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-300">Output Format</label>
              <div className="flex gap-2">
                {(["mp4", "webm"] as OutputFormat[]).map((f) => (
                  <button key={f} disabled={disabled} onClick={() => onVideo({ ...video, format: f })}
                    className={[
                      "flex-1 py-2.5 rounded-xl text-sm font-bold uppercase transition-all border",
                      video.format === f ? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-950/50"
                                         : "bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-slate-200",
                      disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                    ].join(" ")}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-300">Resolution</label>
              <div className="flex flex-col gap-1.5">
                {(["1080p", "720p", "480p"] as Resolution[]).map((r) => (
                  <button key={r} disabled={disabled} onClick={() => onVideo({ ...video, resolution: r })}
                    className={[
                      "flex items-center justify-between px-4 py-2.5 rounded-xl text-sm transition-all border",
                      video.resolution === r ? "bg-violet-600/20 border-violet-500/50 text-violet-300"
                                             : "bg-slate-800/40 border-slate-700/40 text-slate-400 hover:text-slate-300",
                      disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                    ].join(" ")}>
                    <span className="font-semibold">{r}</span>
                    <span className="text-xs opacity-60">{r === "1080p" ? "Full HD" : r === "720p" ? "HD" : "SD"}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Bitrate */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-300">Quality / Bitrate</label>
              <div className="grid grid-cols-3 gap-2">
                {(["low", "medium", "high"] as Bitrate[]).map((b) => (
                  <button key={b} disabled={disabled} onClick={() => onVideo({ ...video, bitrate: b })}
                    className={[
                      "flex flex-col items-center py-3 rounded-xl text-xs font-semibold border gap-0.5 transition-all",
                      video.bitrate === b ? "bg-violet-600/20 border-violet-500/50 text-violet-300"
                                          : "bg-slate-800/40 border-slate-700/40 text-slate-400 hover:text-slate-300",
                      disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                    ].join(" ")}>
                    <span>{BITRATE_META[b].label}</span>
                    <span className="text-[10px] font-normal opacity-60">{BITRATE_META[b].detail}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Audio tab ─────────────────────────────────────────────────── */}
        {tab === "audio" && (
          <>
            {/* Music file */}
            <FilePicker
              file={audio.musicFile}
              accept=".mp3,.wav,audio/mpeg,audio/wav"
              label="Background Music"
              hint="Upload MP3 or WAV…"
              maxBytes={MAX_AUDIO_BYTES}
              validator={isAudio}
              onChange={(f) => onAudio({ ...audio, musicFile: f })}
              disabled={disabled}
            />

            {/* Volume */}
            {audio.musicFile && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-300">Volume</label>
                  <span className="text-xs font-bold text-violet-400">{audio.musicVolume}%</span>
                </div>
                <div className="relative h-5 flex items-center">
                  <div className="absolute inset-x-0 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${audio.musicVolume}%` }} />
                  </div>
                  <input type="range" min={0} max={100} value={audio.musicVolume}
                    onChange={(e) => onAudio({ ...audio, musicVolume: Number(e.target.value) })}
                    disabled={disabled}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                </div>
              </div>
            )}

            {/* Loop */}
            {audio.musicFile && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Loop audio</span>
                <Toggle checked={audio.musicLoop} onChange={(v) => onAudio({ ...audio, musicLoop: v })} disabled={disabled} />
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-slate-800" />

            {/* Voice mode */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-300">Voice / Audio Track</label>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                When background music is added, choose how it combines with the original audio.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["replace", "mix"] as AudioMode[]).map((m) => (
                  <button key={m} disabled={disabled} onClick={() => onAudio({ ...audio, audioMode: m })}
                    className={[
                      "flex flex-col items-center py-3 rounded-xl text-xs font-semibold border gap-1 transition-all",
                      audio.audioMode === m ? "bg-violet-600/20 border-violet-500/50 text-violet-300"
                                            : "bg-slate-800/40 border-slate-700/40 text-slate-400 hover:text-slate-300",
                      disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                    ].join(" ")}>
                    <span className="capitalize">{m}</span>
                    <span className="text-[10px] font-normal opacity-60">
                      {m === "replace" ? "Remove original" : "Blend together"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Subtitles tab ──────────────────────────────────────────────── */}
        {tab === "subtitles" && (
          <>
            <FilePicker
              file={subs.srtFile}
              accept=".srt,text/plain"
              label="Subtitle File"
              hint="Upload .SRT file…"
              maxBytes={1 * 1024 * 1024}
              validator={(f) => f.name.toLowerCase().endsWith(".srt")}
              onChange={(f) => onSubs({ ...subs, srtFile: f })}
              disabled={disabled}
            />

            {subs.srtFile && (
              <>
                {/* Font + size */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-300">Font Family</label>
                    <select value={subs.fontFamily}
                      onChange={(e) => onSubs({ ...subs, fontFamily: e.target.value })}
                      disabled={disabled}
                      className="bg-slate-800 border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50">
                      {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-300">Font Size (px)</label>
                    <input type="number" min={10} max={72} value={subs.fontSize}
                      onChange={(e) => onSubs({ ...subs, fontSize: Number(e.target.value) })}
                      disabled={disabled}
                      className="bg-slate-800 border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50" />
                  </div>
                </div>

                {/* Colors */}
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { key: "fontColor" as const, label: "Text Color" },
                    { key: "bgColor"   as const, label: "Background" },
                  ] as const).map(({ key, label }) => (
                    <div key={key} className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-300">{label}</label>
                      <div className="flex items-center gap-2 bg-slate-800 border border-slate-700/60 rounded-xl px-3 py-1.5">
                        <input type="color" value={subs[key].slice(0, 7)}
                          onChange={(e) => onSubs({ ...subs, [key]: e.target.value })}
                          disabled={disabled}
                          className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent disabled:opacity-50" />
                        <span className="text-xs text-slate-400 font-mono">{subs[key].slice(0, 7)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Padding + margin */}
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { key: "padding"      as const, label: "Padding (px)", min: 0, max: 40 },
                    { key: "marginBottom" as const, label: "Bottom Margin (px)", min: 0, max: 200 },
                  ] as const).map(({ key, label, min, max }) => (
                    <div key={key} className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-300">{label}</label>
                      <input type="number" min={min} max={max} value={subs[key]}
                        onChange={(e) => onSubs({ ...subs, [key]: Number(e.target.value) })}
                        disabled={disabled}
                        className="bg-slate-800 border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50" />
                    </div>
                  ))}
                </div>

                {/* Alignment */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-300">Alignment</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["left", "center", "right"] as SubtitleAlign[]).map((a) => (
                      <button key={a} disabled={disabled} onClick={() => onSubs({ ...subs, align: a })}
                        className={[
                          "py-2 rounded-xl text-xs font-semibold capitalize border transition-all",
                          subs.align === a ? "bg-violet-600/20 border-violet-500/50 text-violet-300"
                                           : "bg-slate-800/40 border-slate-700/40 text-slate-400 hover:text-slate-300",
                          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                        ].join(" ")}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview hint */}
                <div
                  className="relative rounded-xl bg-black overflow-hidden border border-slate-700/40"
                  style={{ aspectRatio: "16/6" }}
                >
                  <div className="absolute inset-0 bg-linear-to-b from-slate-800/60 to-slate-900/60" />
                  <div
                    className="absolute inset-x-0 flex items-end justify-center pb-2"
                    style={{ bottom: subs.marginBottom / 4, textAlign: subs.align }}
                  >
                    <span
                      className="rounded px-2 py-1 leading-snug"
                      style={{
                        fontFamily: subs.fontFamily,
                        fontSize:   `${Math.max(10, Math.round(subs.fontSize * 0.55))}px`,
                        color:      subs.fontColor,
                        backgroundColor: subs.bgColor,
                        padding:    `${subs.padding / 2}px ${subs.padding}px`,
                      }}
                    >
                      Subtitle preview text
                    </span>
                  </div>
                  <p className="absolute top-2 left-0 right-0 text-center text-[10px] text-slate-600 pointer-events-none">
                    Live preview
                  </p>
                </div>
              </>
            )}

            {!subs.srtFile && (
              <p className="text-xs text-slate-600 text-center py-2">Upload an .SRT file to configure subtitle styling.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusBar
// ─────────────────────────────────────────────────────────────────────────────

function StatusBar({ status, error, progress }: { status: JobStatus; error: string | null; progress: number }) {
  if (status === "idle") return null;

  const active = status === "uploading" || status === "processing";
  const isDone = status === "completed";
  const isFail = status === "failed";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
      className={[
        "rounded-2xl border p-4 flex flex-col gap-3",
        isFail ? "border-red-500/30 bg-red-500/10"
        : isDone ? "border-emerald-500/30 bg-emerald-500/10"
                 : "border-slate-700/60 bg-slate-900/60",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        {active && <div className="w-4 h-4 rounded-full border-2 border-violet-500 border-t-transparent animate-spin shrink-0" />}
        {isDone && (
          <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
        )}
        {isFail && (
          <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center shrink-0">
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )}
        <span className={["text-sm font-semibold", isFail ? "text-red-400" : isDone ? "text-emerald-400" : "text-slate-200"].join(" ")}>
          {isFail ? (error ?? "Processing failed") : isDone ? "Processing complete!" : status === "uploading" ? "Uploading…" : "Processing with FFmpeg…"}
        </span>
        {active && <span className="ml-auto text-xs font-bold text-violet-400">{progress}%</span>}
      </div>
      {active && (
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <motion.div className="h-full rounded-full bg-violet-500"
            animate={{ width: `${progress}%` }} transition={{ duration: 0.4, ease: "easeOut" }} />
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ResultCard
// ─────────────────────────────────────────────────────────────────────────────

function ResultCard({ result }: { result: ProcessResult }) {
  const [copied, setCopied] = useState(false);
  const hasOutput = isValidMediaSrc(result.outputUrl);
  const copy = async () => {
    if (!result.outputUrl) return;
    await navigator.clipboard.writeText(window.location.origin + result.outputUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-emerald-500/20 bg-linear-to-b from-emerald-500/10 to-transparent p-5 flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Original",   value: fmtBytes(result.originalSize),   color: "text-slate-300"  },
          { label: "Compressed", value: fmtBytes(result.compressedSize),  color: "text-emerald-300"},
          { label: "Reduction",  value: `${result.reductionPercent}%`,    color: "text-emerald-400"},
        ].map(({ label, value, color }) => (
          <div key={label} className="flex flex-col gap-1 text-center">
            <p className={`text-lg font-bold ${color}`}>{value}</p>
            <p className="text-[10px] text-slate-500 font-medium">{label}</p>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-700/50" />
      {hasOutput ? (
        <div className="flex gap-2">
          <a href={result.outputUrl!} download={result.outputName}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm py-2.5 px-4 rounded-xl transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download {result.outputFormat.toUpperCase()}
          </a>
          <button onClick={copy}
            className={["flex items-center gap-1.5 text-xs font-medium px-3 py-2.5 rounded-xl border transition-all",
              copied ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-slate-700 text-slate-400 hover:text-slate-200"].join(" ")}>
            {copied ? "Copied!" : "Copy URL"}
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-500 text-center py-1">
          Download will be available once FFmpeg processing is enabled.
        </p>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function VideoPage() {
  const [video,    setVideo]    = useState<VideoFile | null>(null);
  const [vSettings, setVSettings] = useState<VideoSettings>(DEFAULT_VIDEO);
  const [aSettings, setASettings] = useState<AudioSettings>(DEFAULT_AUDIO);
  const [sSettings, setSSettings] = useState<SubtitleSettings>(DEFAULT_SUBS);
  const [status,   setStatus]   = useState<JobStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error,    setError]    = useState<string | null>(null);
  const [result,   setResult]   = useState<ProcessResult | null>(null);
  const [mounted,  setMounted]  = useState(false);

  useEffect(() => { const id = setTimeout(() => setMounted(true), 0); return () => clearTimeout(id); }, []);

  // Track the latest video in a ref so the unmount cleanup can revoke its object URL
  const latestVideoRef = useRef<VideoFile | null>(null);
  useEffect(() => { latestVideoRef.current = video; }, [video]);
  useEffect(() => () => { if (latestVideoRef.current) URL.revokeObjectURL(latestVideoRef.current.objectUrl); }, []);

  const handleVideoFile = useCallback((file: File) => {
    const objectUrl = URL.createObjectURL(file);
    setVideo({ file, objectUrl, duration: null });
    setStatus("idle"); setResult(null); setError(null); setProgress(0);

    // Use a separate blob URL for the duration probe so we don't revoke the main player URL
    const probeUrl = URL.createObjectURL(file);
    const vid = document.createElement("video");
    vid.preload = "metadata";
    vid.onloadedmetadata = () => {
      setVideo((prev) => prev ? { ...prev, duration: isFinite(vid.duration) ? vid.duration : null } : prev);
      URL.revokeObjectURL(probeUrl);
    };
    vid.onerror = () => URL.revokeObjectURL(probeUrl);
    vid.src = probeUrl;
  }, []);

  const handleRemove = useCallback(() => {
    if (video) URL.revokeObjectURL(video.objectUrl);
    setVideo(null); setStatus("idle"); setResult(null); setError(null); setProgress(0);
  }, [video]);

  const handleProcess = useCallback(async () => {
    if (!video) return;
    setStatus("uploading"); setProgress(0); setResult(null); setError(null);
    try {
      // ── Placeholder — replace with real API call when FFmpeg is wired ──
      // const form = new FormData();
      // form.append("file", video.file);
      // form.append("options", JSON.stringify({ video: vSettings, audio: aSettings, subtitles: sSettings }));
      // const res = await fetch("/api/video/process", { method: "POST", body: form });
      // const data = await res.json();
      await simulateProgress(setProgress, setStatus);
      setResult({
        originalSize: video.file.size,
        compressedSize: Math.round(video.file.size * 0.45),
        reductionPercent: 55,
        outputUrl: null,   // no real output URL until FFmpeg is wired
        outputName: `processed_${video.file.name.replace(/\.[^.]+$/, "")}.${vSettings.format}`,
        outputFormat: vSettings.format,
      });
      setStatus("completed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
      setStatus("failed");
    }
  }, [video, vSettings, aSettings, sSettings]);

  const isProcessing = status === "uploading" || status === "processing";
  const canProcess   = video !== null && !isProcessing;

  return (
    <div className="min-h-screen bg-background text-white flex flex-col">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-background/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <span className="text-base font-bold tracking-tight group-hover:text-indigo-300 transition-colors">Compressly</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/tool"      className="text-sm text-slate-400 hover:text-slate-200 transition-colors font-medium">Images</Link>
              <span className="text-sm font-semibold text-violet-400">Video</span>
              <Link href="/docs"      className="text-sm text-slate-400 hover:text-slate-200 transition-colors font-medium">API Docs</Link>
              <Link href="/dashboard" className="text-sm text-slate-400 hover:text-slate-200 transition-colors font-medium">Dashboard</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-slate-500 font-medium bg-slate-800/80 border border-slate-700/50 px-3 py-1 rounded-full">
              Beta · FFmpeg powered
            </span>
            <Link href="/tool" className="text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Images
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">

          {/* Page heading */}
          <div className="flex flex-col items-center text-center gap-3">
            <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-semibold px-4 py-1.5 rounded-full">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Video Optimizer
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Compress, convert and <span className="text-violet-400">edit videos</span>
            </h1>
            <p className="text-slate-400 max-w-lg leading-relaxed text-sm">
              Reduce size, change format, add background music, burn subtitles — all in one pass via FFmpeg.
            </p>
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium px-4 py-2 rounded-xl">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              FFmpeg integration is in development — processing is simulated for now
            </div>
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">

            {/* Left column */}
            <div className="flex flex-col gap-5">

              {/* Drop zone or preview */}
              <AnimatePresence mode="wait">
                {!video ? (
                  <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <VideoDropZone onFile={handleVideoFile} disabled={isProcessing} />
                  </motion.div>
                ) : (
                  <motion.div key="player" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-4">
                    {/* File info row */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate">{video.file.name}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-slate-500">{fmtBytes(video.file.size)}</span>
                          {video.duration !== null && (
                            <><span className="text-slate-700">·</span>
                            <span className="text-xs text-slate-500">{fmtTime(video.duration)}</span></>
                          )}
                          <span className="text-slate-700">·</span>
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                            {video.file.name.split(".").pop()?.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      {!isProcessing && (
                        <button onClick={handleRemove}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors shrink-0">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {/* Original preview */}
                    <VideoPlayer src={video.objectUrl} label="Original" accentClass="bg-slate-500" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Before/After comparison — shown after completion */}
              <AnimatePresence>
                {result && video && status === "completed" && (
                  <motion.div key="compare" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <BeforeAfterPlayers original={video} result={result} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Status */}
              <AnimatePresence>
                {status !== "idle" && <StatusBar status={status} error={error} progress={progress} />}
              </AnimatePresence>

              {/* Result card */}
              <AnimatePresence>
                {result && status === "completed" && <ResultCard result={result} />}
              </AnimatePresence>

              {/* Process button */}
              {mounted && (
                <motion.button
                  onClick={handleProcess}
                  disabled={!canProcess}
                  whileHover={canProcess ? { scale: 1.01 } : {}}
                  whileTap={canProcess  ? { scale: 0.99 } : {}}
                  className={[
                    "w-full py-4 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2.5",
                    canProcess
                      ? "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-950/50 cursor-pointer"
                      : "bg-slate-800 text-slate-600 cursor-not-allowed",
                  ].join(" ")}
                >
                  {isProcessing ? (
                    <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    {status === "uploading" ? "Uploading…" : "Processing…"}</>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                      </svg>
                    Process Video</>
                  )}
                </motion.button>
              )}
            </div>

            {/* Right column — settings */}
            <SettingsPanel
              video={vSettings} audio={aSettings} subs={sSettings}
              onVideo={setVSettings} onAudio={setASettings} onSubs={setSSettings}
              disabled={isProcessing}
            />
          </div>
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 py-8 px-6 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <span className="text-sm font-semibold">Compressly</span>
            <span className="text-slate-700 text-xs ml-2">Video · Beta</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/"          className="hover:text-slate-300 transition-colors">Home</Link>
            <Link href="/tool"      className="hover:text-slate-300 transition-colors">Images</Link>
            <Link href="/docs"      className="hover:text-slate-300 transition-colors">API Docs</Link>
            <Link href="/dashboard" className="hover:text-slate-300 transition-colors">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Simulation helper — replace when real API is wired
// ─────────────────────────────────────────────────────────────────────────────

async function simulateProgress(
  setProgress: (n: number) => void,
  setStatus: (s: JobStatus) => void,
): Promise<void> {
  for (let p = 0; p <= 40; p += 5) { setProgress(p); await tick(55); }
  setStatus("processing");
  for (let p = 42; p <= 100; p += 4) { setProgress(p); await tick(75); }
}

function tick(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }
