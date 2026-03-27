import { NextRequest } from "next/server";
import archiver from "archiver";
import path from "path";
import fs from "fs";
import { Readable } from "stream";

export async function POST(request: NextRequest) {
  let body: { filenames: string[] };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { filenames } = body;

  if (!Array.isArray(filenames) || filenames.length === 0) {
    return Response.json({ error: "No filenames provided" }, { status: 400 });
  }

  // Sanitize: only allow bare filenames — no path traversal
  const sanitized = filenames.filter(
    (f) => typeof f === "string" && /^[\w-]+\.(webp|avif|jpg)$/.test(f)
  );

  if (sanitized.length === 0) {
    return Response.json({ error: "No valid filenames" }, { status: 400 });
  }

  const GENERATED_DIR = path.join(process.cwd(), "public", "generated");

  // Build the zip in memory via a Node.js Readable and pipe it to a Web ReadableStream
  const archive = archiver("zip", { zlib: { level: 6 } });

  for (const filename of sanitized) {
    const filePath = path.join(GENERATED_DIR, filename);
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: filename });
    }
  }

  // Convert Node stream → Web ReadableStream
  const nodeReadable = new Readable({ read() {} });

  archive.on("data", (chunk: Buffer) => nodeReadable.push(chunk));
  archive.on("end", () => nodeReadable.push(null));
  archive.on("error", (err: Error) => nodeReadable.destroy(err));

  archive.finalize();

  const webStream = Readable.toWeb(nodeReadable) as ReadableStream;

  return new Response(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="compressly-images.zip"',
    },
  });
}
