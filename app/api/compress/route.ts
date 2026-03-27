import { NextRequest } from "next/server";
import { compressImage } from "@/lib/compress";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB per file

export async function POST(request: NextRequest) {
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

  const results = await Promise.all(
    files.map(async (file) => {
      // Validate type
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return {
          error: `Unsupported file type: ${file.type}`,
          originalName: file.name,
        };
      }

      // Validate size
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return {
          error: `File too large (max 20 MB): ${file.name}`,
          originalName: file.name,
        };
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const result = await compressImage(buffer, file.name);
        return { ...result, error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return { error: message, originalName: file.name };
      }
    })
  );

  return Response.json({ results });
}
