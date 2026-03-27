"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PRESET_LIST, TARGET_SIZES, OUTPUT_FORMATS } from "@/lib/presets";
import type { CompressionSettings } from "@/lib/settings";

interface SettingsPanelProps {
  settings: CompressionSettings;
  onChange: (s: CompressionSettings) => void;
  onPreset: (key: CompressionSettings["preset"]) => void;
}

export default function SettingsPanel({
  settings,
  onChange,
  onPreset,
}: SettingsPanelProps) {
  const [open, setOpen] = useState(false);

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
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <svg
            className="w-4 h-4 text-indigo-400"
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
          Advanced Options
          {/* Active settings badges */}
          <div className="flex items-center gap-1.5 ml-1">
            <Badge>{settings.format.toUpperCase()}</Badge>
            <Badge>{effectiveSize} KB</Badge>
            <Badge>{PRESET_LIST.find((p) => p.key === settings.preset)?.label}</Badge>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-700/50 px-5 py-5 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ── Preset ── */}
              <Section label="Preset">
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_LIST.map((preset) => (
                    <button
                      key={preset.key}
                      onClick={() => onPreset(preset.key)}
                      className={[
                        "flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-all",
                        settings.preset === preset.key
                          ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
                          : "border-slate-700 bg-slate-900/40 text-slate-400 hover:border-slate-600 hover:text-slate-300",
                      ].join(" ")}
                    >
                      <span className="text-xs font-semibold">{preset.label}</span>
                      <span className="text-[11px] opacity-70 leading-snug mt-0.5">
                        {preset.description}
                      </span>
                    </button>
                  ))}
                </div>
              </Section>

              {/* ── Output format ── */}
              <Section label="Output Format">
                <div className="flex gap-2">
                  {OUTPUT_FORMATS.map((fmt) => (
                    <button
                      key={fmt.value}
                      onClick={() => set("format", fmt.value)}
                      className={[
                        "flex-1 py-2 rounded-lg border text-xs font-semibold transition-all",
                        settings.format === fmt.value
                          ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
                          : "border-slate-700 bg-slate-900/40 text-slate-400 hover:border-slate-600 hover:text-slate-300",
                      ].join(" ")}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
              </Section>

              {/* ── Target size ── */}
              <Section label="Target Size">
                <div className="flex flex-wrap gap-2">
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
                        "px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all",
                        !settings.isCustomSize && settings.targetSizeKB === sz.value
                          ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
                          : "border-slate-700 bg-slate-900/40 text-slate-400 hover:border-slate-600 hover:text-slate-300",
                      ].join(" ")}
                    >
                      {sz.label}
                    </button>
                  ))}

                  {/* Custom toggle */}
                  <button
                    onClick={() => set("isCustomSize", !settings.isCustomSize)}
                    className={[
                      "px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all",
                      settings.isCustomSize
                        ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
                        : "border-slate-700 bg-slate-900/40 text-slate-400 hover:border-slate-600 hover:text-slate-300",
                    ].join(" ")}
                  >
                    Custom
                  </button>
                </div>

                {/* Custom size input */}
                <AnimatePresence initial={false}>
                  {settings.isCustomSize && (
                    <motion.div
                      key="custom"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden mt-2"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={10}
                          max={10000}
                          value={settings.customSizeKB}
                          onChange={(e) =>
                            set("customSizeKB", Math.max(10, Number(e.target.value)))
                          }
                          className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                        <span className="text-xs text-slate-500">KB</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Section>

              {/* ── Resize ── */}
              <Section label="Resize">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Toggle
                    checked={settings.resize.enabled}
                    onChange={(v) => setResize("enabled", v)}
                  />
                  <span className="text-xs text-slate-400">
                    {settings.resize.enabled ? "Enabled" : "Disabled"}
                  </span>
                </label>

                <AnimatePresence initial={false}>
                  {settings.resize.enabled && (
                    <motion.div
                      key="resize-fields"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-500 w-12">Width</label>
                          <input
                            type="number"
                            min={1}
                            placeholder="px"
                            value={settings.resize.width}
                            onChange={(e) => setResize("width", e.target.value)}
                            className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-500 w-12">Height</label>
                          <input
                            type="number"
                            min={1}
                            placeholder="px"
                            value={settings.resize.height}
                            onChange={(e) => setResize("height", e.target.value)}
                            className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
                          <Toggle
                            checked={settings.resize.maintainAspect}
                            onChange={(v) => setResize("maintainAspect", v)}
                          />
                          <span className="text-xs text-slate-400">
                            Maintain aspect ratio
                          </span>
                        </label>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Section>

              {/* ── Metadata ── */}
              <Section label="Metadata">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Toggle
                    checked={settings.stripMetadata}
                    onChange={(v) => set("stripMetadata", v)}
                  />
                  <span className="text-xs text-slate-400">
                    Strip EXIF / metadata
                  </span>
                </label>
              </Section>

              {/* ── Download behaviour ── */}
              <Section label="Download Behaviour">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Toggle
                    checked={settings.autoDownload}
                    onChange={(v) => set("autoDownload", v)}
                  />
                  <span className="text-xs text-slate-400">
                    Auto-download ZIP when batch completes
                  </span>
                </label>
              </Section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
        {label}
      </p>
      {children}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold bg-slate-700/80 text-slate-400 px-1.5 py-0.5 rounded-md">
      {children}
    </span>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        "relative w-8 h-4.5 rounded-full transition-colors duration-200 flex-shrink-0",
        checked ? "bg-indigo-500" : "bg-slate-700",
      ].join(" ")}
      style={{ height: "18px", width: "32px" }}
    >
      <span
        className={[
          "absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform duration-200",
          checked ? "translate-x-3.5" : "translate-x-0",
        ].join(" ")}
        style={{ width: "14px", height: "14px" }}
      />
    </button>
  );
}
