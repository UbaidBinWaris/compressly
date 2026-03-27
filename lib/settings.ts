import type { OutputFormat, PresetKey } from "./presets";

export interface CompressionSettings {
  preset: PresetKey;
  targetSizeKB: number;
  isCustomSize: boolean;
  customSizeKB: number;
  format: OutputFormat;
  resize: {
    enabled: boolean;
    width: string;
    height: string;
    maintainAspect: boolean;
  };
  stripMetadata: boolean;
  autoDownload: boolean;
}

/** The options actually sent to the server — derived from CompressionSettings + Preset */
export interface CompressionOptions {
  targetSizeKB: number;
  format: OutputFormat;
  qualityStart: number;
  qualityMin: number;
  qualityStep: number;
  resize: {
    width: number | null;
    height: number | null;
    maintainAspect: boolean;
  } | null;
  stripMetadata: boolean;
}

export const DEFAULT_SETTINGS: CompressionSettings = {
  preset: "web",
  targetSizeKB: 100,
  isCustomSize: false,
  customSizeKB: 100,
  format: "webp",
  resize: {
    enabled: false,
    width: "",
    height: "",
    maintainAspect: true,
  },
  stripMetadata: true,
  autoDownload: false,
};

const STORAGE_KEY = "compressly_settings_v1";

export function loadSettings(): CompressionSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    // Merge with defaults so new fields are always present
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: CompressionSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Ignore quota errors
  }
}
