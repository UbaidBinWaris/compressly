/**
 * Magic-byte file type validation.
 * Checks the first 12 bytes of a buffer against known image signatures.
 * This is more reliable than trusting the Content-Type header or file extension.
 */

type KnownMime =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif"
  | "image/avif";

interface MagicEntry {
  mime: KnownMime;
  bytes: (number | null)[]; // null = wildcard (any byte)
  offset?: number;
}

const SIGNATURES: MagicEntry[] = [
  // JPEG: FF D8 FF
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // GIF87a / GIF89a
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  // WebP: RIFF....WEBP (bytes 0-3 + 8-11)
  {
    mime: "image/webp",
    bytes: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
  },
  // AVIF / HEIF: ftyp box at offset 4
  // First 4 bytes = box size (vary), bytes 4-7 = "ftyp"
  {
    mime: "image/avif",
    bytes: [null, null, null, null, 0x66, 0x74, 0x79, 0x70],
  },
];

/**
 * Returns the detected MIME type from the buffer's magic bytes,
 * or null if the format is not a known safe image type.
 */
export function detectMimeType(buffer: Buffer): KnownMime | null {
  for (const sig of SIGNATURES) {
    const offset = sig.offset ?? 0;
    if (buffer.length < offset + sig.bytes.length) continue;

    const match = sig.bytes.every(
      (b, i) => b === null || buffer[offset + i] === b
    );
    if (match) return sig.mime;
  }
  return null;
}

/** The set of MIME types accepted for upload */
export const ALLOWED_MIMES = new Set<KnownMime>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);
