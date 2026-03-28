"use client";

import { useEffect, useCallback, useRef, useState } from "react";

interface UsePasteUploadOptions {
  onFiles: (files: File[]) => void;
  enabled?: boolean;
}

interface PasteToastState {
  visible: boolean;
  count: number;
}

/**
 * Listens for Ctrl+V / ⌘+V paste events globally.
 * Extracts image items from the clipboard and forwards them
 * to the provided `onFiles` callback — identical to a drag-and-drop upload.
 */
export function usePasteUpload({
  onFiles,
  enabled = true,
}: UsePasteUploadOptions) {
  const [toast, setToast] = useState<PasteToastState>({ visible: false, count: 0 });
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((count: number) => {
    setToast({ visible: true, count });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast({ visible: false, count: 0 }), 3000);
  }, []);

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      if (!enabled) return;

      // Don't intercept paste inside inputs / textareas
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind !== "file") continue;

        const mimeType = item.type;
        // Only process image MIME types
        if (!mimeType.startsWith("image/")) continue;

        const file = item.getAsFile();
        if (!file) continue;

        // Give pasted images a meaningful name with timestamp
        const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
        const name = `paste_${Date.now()}_${i}.${ext}`;

        // Re-wrap as a named File so the upload flow has a proper filename
        const namedFile = new File([file], name, { type: mimeType });
        imageFiles.push(namedFile);
      }

      if (imageFiles.length === 0) return;

      e.preventDefault();
      showToast(imageFiles.length);
      onFiles(imageFiles);
    },
    [enabled, onFiles, showToast]
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("paste", handlePaste);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [handlePaste]);

  return { pasteToast: toast };
}
