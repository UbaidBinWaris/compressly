import path from "path";
import fs from "fs/promises";
import { NextRequest } from "next/server";
import { compressImage, DEFAULT_OPTIONS } from "@/lib/compress";
import { maybeCleanup, UPLOADS_TMP_DIR } from "@/lib/cleanup";
import type { CompressionOptions } from "@/lib/settings";

// Prevent path traversal: only plain filenames (no slashes or dots in first position)
const SAFE_FILENAME_RE = /^[a-zA-Z0-9_\-.]+$/;

export async function POST(request: NextRequest) {
  await maybeCleanup();

  let body: { uploadId?: string; options?: Partial<CompressionOptions>; originalName?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { uploadId, options: rawOptions, originalName = "image" } = body;

  // Validate uploadId to prevent path traversal
  if (!uploadId || !SAFE_FILENAME_RE.test(uploadId)) {
    return Response.json({ error: "Invalid uploadId" }, { status: 400 });
  }

  const uploadPath = path.join(UPLOADS_TMP_DIR, uploadId);

  // Check file exists
  try {
    await fs.access(uploadPath);
  } catch {
    return Response.json(
      { error: "Original file not found — it may have expired. Please re-upload." },
      { status: 404 }
    );
  }

  let buffer: Buffer;
  try {
    buffer = await fs.readFile(uploadPath);
  } catch {
    return Response.json({ error: "Failed to read original file" }, { status: 500 });
  }

  const options: CompressionOptions = {
    targetSizeKB: Number(rawOptions?.targetSizeKB) || DEFAULT_OPTIONS.targetSizeKB,
    format: rawOptions?.format ?? DEFAULT_OPTIONS.format,
    qualityStart: Number(rawOptions?.qualityStart) || DEFAULT_OPTIONS.qualityStart,
    qualityMin: Number(rawOptions?.qualityMin) || DEFAULT_OPTIONS.qualityMin,
    qualityStep: Number(rawOptions?.qualityStep) || DEFAULT_OPTIONS.qualityStep,
    resize: rawOptions?.resize ?? null,
    stripMetadata: rawOptions?.stripMetadata ?? DEFAULT_OPTIONS.stripMetadata,
  };

  try {
    const result = await compressImage(buffer, originalName, options);
    return Response.json({ result, error: null });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Re-optimization failed" },
      { status: 500 }
    );
  }
}
