"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PRESET_LIST, TARGET_SIZES, OUTPUT_FORMATS } from "@/lib/presets";
import type { CompressionSettings } from "@/lib/settings";

interface SettingsPanelProps {
  readonly settings: CompressionSettings;
  readonly onChange: (s: CompressionSettings) => void;
  readonly onPreset: (key: CompressionSettings["preset"]) => void;
  readonly defaultOpen?: boolean;
}

export default function SettingsPanel({
  settings,
  onChange,
  onPreset,
  defaultOpen = false,
}: SettingsPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  const set = <K extends keyof CompressionSettings>(
    key: K,
    value: CompressionSettings[K]
  ) => onChange({ ...settings, [key]: value });

  const setResize = <K extends keyof CompressionSettings["resize"]>(
    key: K,
    value: CompressionSettings["resize"][K]
  ) => onChange({ ...settings, resize: { ...settings.resize, [key]: value } });

  const effectiveSize = settings.isCustomSize
    ? settings.customSizeKB
    : settings.targetSizeKB;

  return (
    <div className="rounded-2xl border border-[#1E293B] bg-[#0F172A] overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/30 transition-colors duration-150"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
            <svg
              className="w-3.5 h-3.5 text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <span className="text-sm font-semibold text-[#E2E8F0]">Settings</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold bg-[#1E293B] text-[#94A3B8] px-2 py-0.5 rounded-md">
            {settings.format.toUpperCase()}
          </span>
          <span className="text-[10px] font-bold bg-[#1E293B] text-[#94A3B8] px-2 py-0.5 rounded-md">
            {effectiveSize} KB
          </span>
          <svg
            className={[
              "w-4 h-4 text-[#64748B] transition-transform duration-200",
              open ? "rotate-180" : "",
            ].join(" ")}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-[#1E293B] divide-y divide-[#1E293B]">

              {/* ── Preset ─────────────────────────────────────────────────── */}
              <div className="px-5 py-4 flex flex-col gap-3">
                <SectionLabel>Preset</SectionLabel>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_LIST.map((preset) => (
                    <button
                      key={preset.key}
                      onClick={() => onPreset(preset.key)}
                      className={[
                        "flex flex-col items-start px-3 py-2.5 rounded-xl border text-left transition-all duration-150",
                        settings.preset === preset.key
                          ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
                          : "border-[#1E293B] bg-[#020617] text-[#94A3B8] hover:border-slate-600 hover:text-[#E2E8F0]",
                      ].join(" ")}
                    >
                      <span className="text-xs font-semibold">{preset.label}</span>
                      <span className="text-[11px] opacity-60 mt-0.5 leading-snug">
                        {preset.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Output Format ──────────────────────────────────────────── */}
              <div className="px-5 py-4 flex flex-col gap-3">
                <SectionLabel>Format</SectionLabel>
                <div className="grid grid-cols-4 gap-1.5">
                  {OUTPUT_FORMATS.map((fmt) => (
                    <button
                      key={fmt.value}
                      onClick={() => set("format", fmt.value)}
                      className={[
                        "py-2 rounded-lg border text-xs font-bold transition-all duration-150",
                        settings.format === fmt.value
                          ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
                          : "border-[#1E293B] bg-[#020617] text-[#64748B] hover:text-[#94A3B8] hover:border-slate-600",
                      ].join(" ")}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Target Size ────────────────────────────────────────────── */}
              <div className="px-5 py-4 flex flex-col gap-3">
                <SectionLabel>Target Size</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {TARGET_SIZES.map((sz) => (
                    <button
                      key={sz.value}
                      onClick={() =>
                        onChange({
                          ...settings,
                          targetSizeKB: sz.value,
                          isCustomSize: false,
                        })
                      }
                      className={[
                        "px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-150",
                        !settings.isCustomSize && settings.targetSizeKB === sz.value
                          ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
                          : "border-[#1E293B] bg-[#020617] text-[#64748B] hover:text-[#94A3B8] hover:border-slate-600",
                      ].join(" ")}
                    >
                      {sz.label}
                    </button>
                  ))}
                  <button
                    onClick={() => set("isCustomSize", !settings.isCustomSize)}
                    className={[
                      "px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-150",
                      settings.isCustomSize
                        ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
                        : "border-[#1E293B] bg-[#020617] text-[#64748B] hover:text-[#94A3B8] hover:border-slate-600",
                    ].join(" ")}
                  >
                    Custom
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {settings.isCustomSize && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="number"
                          min={10}
                          max={10000}
                          value={settings.customSizeKB}
                          onChange={(e) =>
                            set("customSizeKB", Math.max(10, Number(e.target.value)))
                          }
                          className="w-24 bg-[#020617] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-[#E2E8F0] focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                        <span className="text-xs text-[#64748B]">KB</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Transform ──────────────────────────────────────────────── */}
              <div className="px-5 py-4 flex flex-col gap-3">
                <SectionLabel>Transform</SectionLabel>
                <ToggleRow
                  label="Resize image"
                  checked={settings.resize.enabled}
                  onChange={(v) => setResize("enabled", v)}
                />

                <AnimatePresence initial={false}>
                  {settings.resize.enabled && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col gap-3 pt-1">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col gap-1.5">
                            <label htmlFor="resize-width" className="text-xs text-[#64748B]">Width (px)</label>
                            <input
                              id="resize-width"
                              type="number"
                              min={1}
                              placeholder="auto"
                              value={settings.resize.width}
                              onChange={(e) => setResize("width", e.target.value)}
                              className="bg-[#020617] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-[#E2E8F0] focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label htmlFor="resize-height" className="text-xs text-[#64748B]">Height (px)</label>
                            <input
                              id="resize-height"
                              type="number"
                              min={1}
                              placeholder="auto"
                              value={settings.resize.height}
                              onChange={(e) => setResize("height", e.target.value)}
                              className="bg-[#020617] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-[#E2E8F0] focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                          </div>
                        </div>
                        <ToggleRow
                          label="Maintain aspect ratio"
                          checked={settings.resize.maintainAspect}
                          onChange={(v) => setResize("maintainAspect", v)}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Options ────────────────────────────────────────────────── */}
              <div className="px-5 py-4 flex flex-col gap-4">
                <SectionLabel>Options</SectionLabel>
                <ToggleRow
                  label="Strip metadata"
                  description="Remove EXIF / GPS data"
                  checked={settings.stripMetadata}
                  onChange={(v) => set("stripMetadata", v)}
                />
                <ToggleRow
                  label="Auto-download ZIP"
                  description="Download when batch completes"
                  checked={settings.autoDownload}
                  onChange={(v) => set("autoDownload", v)}
                />
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
      {children}
    </p>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: Readonly<{
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}>) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col">
        <span className="text-sm text-[#94A3B8]">{label}</span>
        {description && (
          <span className="text-[11px] text-[#64748B] mt-0.5">{description}</span>
        )}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: Readonly<{
  checked: boolean;
  onChange: (v: boolean) => void;
}>) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        "relative rounded-full transition-colors duration-200 shrink-0",
        checked ? "bg-indigo-500" : "bg-[#1E293B]",
      ].join(" ")}
      style={{ width: 36, height: 20 }}
    >
      <span
        className="absolute top-[3px] left-[3px] w-3.5 h-3.5 rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: checked ? "translateX(16px)" : "translateX(0)" }}
      />
    </button>
  );
}
