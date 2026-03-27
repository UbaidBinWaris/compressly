import os from "os";
import { NextRequest } from "next/server";
import { compressImage, concurrentMap, DEFAULT_OPTIONS } from "@/lib/compress";
import { maybeCleanup } from "@/lib/cleanup";
import type { CompressionOptions } from "@/lib/settings";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB per file
const CONCURRENCY_LIMIT = Math.min(10, Math.max(1, os.cpus().length));

export async function POST(request: NextRequest) {
  // Lazy cleanup: runs at most once per 10 minutes across all requests
  await maybeCleanup();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const files = formData.getAll("files") as File[];
  if (!files || files.length === 0) {
    return Response.json({ error: "No files uploaded" }, { status: 400 });
  }

  // Parse compression options (JSON string appended by the client)
  let options: CompressionOptions = DEFAULT_OPTIONS;
  const optionsRaw = formData.get("options");
  if (typeof optionsRaw === "string") {
    try {
      const parsed = JSON.parse(optionsRaw) as Partial<CompressionOptions>;
      options = {
        targetSizeKB: Number(parsed.targetSizeKB) || DEFAULT_OPTIONS.targetSizeKB,
        format: parsed.format ?? DEFAULT_OPTIONS.format,
        qualityStart: Number(parsed.qualityStart) || DEFAULT_OPTIONS.qualityStart,
        qualityMin: Number(parsed.qualityMin) || DEFAULT_OPTIONS.qualityMin,
        qualityStep: Number(parsed.qualityStep) || DEFAULT_OPTIONS.qualityStep,
        resize: parsed.resize ?? null,
        stripMetadata: parsed.stripMetadata ?? DEFAULT_OPTIONS.stripMetadata,
      };
    } catch {
      // Use defaults
    }
  }

  const results = await concurrentMap(files, CONCURRENCY_LIMIT, async (file) => {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return { error: `Unsupported file type: ${file.type}`, originalName: file.name };
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return { error: `File too large (max 20 MB): ${file.name}`, originalName: file.name };
    }
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await compressImage(buffer, file.name, options);
      return { ...result, error: null };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Compression failed",
        originalName: file.name,
      };
    }
  });

  return Response.json({ results });
}
