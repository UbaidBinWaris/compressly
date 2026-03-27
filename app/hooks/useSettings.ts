"use client";

import { useCallback, useEffect, useState } from "react";
import { PRESETS } from "@/lib/presets";
import {
  CompressionSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from "@/lib/settings";

const STORAGE_KEY = "compressly_settings_v1";

export function useSettings() {
  const [settings, setSettingsState] = useState<CompressionSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  /** True when settings were loaded from localStorage (not first-time defaults) */
  const [wasRestored, setWasRestored] = useState(false);

  useEffect(() => {
    const persisted =
      typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) !== null;
    setSettingsState(loadSettings());
    setWasRestored(persisted);
    setHydrated(true);
  }, []);

  const setSettings = useCallback(
    (updater: CompressionSettings | ((prev: CompressionSettings) => CompressionSettings)) => {
      setSettingsState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        saveSettings(next);
        return next;
      });
    },
    []
  );

  /** Selecting a preset resets target size + resize to that preset's defaults */
  const applyPreset = useCallback(
    (key: CompressionSettings["preset"]) => {
      const preset = PRESETS[key];
      setSettings((prev) => ({
        ...prev,
        preset: key,
        targetSizeKB: preset.defaultTargetSizeKB,
        isCustomSize: false,
        resize: preset.defaultResize
          ? {
              enabled: true,
              width: String(preset.defaultResize.width),
              height: String(preset.defaultResize.height),
              maintainAspect: true,
            }
          : { enabled: false, width: "", height: "", maintainAspect: true },
      }));
    },
    [setSettings]
  );

  return { settings, setSettings, applyPreset, hydrated, wasRestored };
}
