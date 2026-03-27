export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Strips unsafe characters from a filename base and limits its length.
 * Result is safe to embed in a filesystem path.
 */
export function sanitizeBasename(raw: string, maxLen = 32): string {
  return raw
    .replace(/[^a-zA-Z0-9_\-]/g, "_") // keep alphanumeric, _ and -
    .replace(/_+/g, "_")               // collapse consecutive underscores
    .slice(0, maxLen)
    .replace(/^_+|_+$/g, "")          // trim leading/trailing underscores
    || "file";                          // fallback if the name was entirely non-ASCII
}
