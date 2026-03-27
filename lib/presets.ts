export type PresetKey = "web" | "whatsapp" | "thumbnail" | "hq";
export type OutputFormat = "webp" | "avif" | "jpeg";

export interface Preset {
  key: PresetKey;
  label: string;
  description: string;
  defaultTargetSizeKB: number;
  qualityStart: number;
  qualityMin: number;
  qualityStep: number;
  defaultResize?: { width: number; height: number };
}

export const PRESETS: Record<PresetKey, Preset> = {
  web: {
    key: "web",
    label: "Web Optimized",
    description: "Balanced quality for websites",
    defaultTargetSizeKB: 100,
    qualityStart: 85,
    qualityMin: 20,
    qualityStep: 5,
  },
  whatsapp: {
    key: "whatsapp",
    label: "WhatsApp",
    description: "Aggressive compression for messaging",
    defaultTargetSizeKB: 50,
    qualityStart: 70,
    qualityMin: 20,
    qualityStep: 5,
  },
  thumbnail: {
    key: "thumbnail",
    label: "Thumbnail",
    description: "Small preview image with resize",
    defaultTargetSizeKB: 30,
    qualityStart: 75,
    qualityMin: 20,
    qualityStep: 5,
    defaultResize: { width: 320, height: 240 },
  },
  hq: {
    key: "hq",
    label: "High Quality",
    description: "Minimal compression, best quality",
    defaultTargetSizeKB: 200,
    qualityStart: 95,
    qualityMin: 70,
    qualityStep: 3,
  },
};

export const PRESET_LIST = Object.values(PRESETS);

export const TARGET_SIZES: { label: string; value: number }[] = [
  { label: "30 KB", value: 30 },
  { label: "50 KB", value: 50 },
  { label: "100 KB", value: 100 },
  { label: "200 KB", value: 200 },
  { label: "500 KB", value: 500 },
];

export const OUTPUT_FORMATS: { label: string; value: OutputFormat; ext: string }[] = [
  { label: "WebP", value: "webp", ext: "webp" },
  { label: "AVIF", value: "avif", ext: "avif" },
  { label: "JPEG", value: "jpeg", ext: "jpg" },
];

/** Resolves the extension for a given format */
export function formatExt(format: OutputFormat): string {
  return format === "jpeg" ? "jpg" : format;
}
