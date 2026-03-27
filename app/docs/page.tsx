import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "API Documentation — Compressly",
  description: "Developer API reference for the Compressly image compression platform.",
};

// ── Code block component ──────────────────────────────────────────────────────

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-slate-950 border border-slate-800 rounded-xl p-5 text-sm text-slate-300 font-mono overflow-x-auto leading-relaxed whitespace-pre">
      {children}
    </pre>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-slate-800 text-indigo-300 text-[13px] font-mono px-1.5 py-0.5 rounded">
      {children}
    </code>
  );
}

function Badge({ children, color = "indigo" }: { children: string; color?: "indigo" | "emerald" | "amber" | "slate" }) {
  const colors = {
    indigo: "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
    emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    amber: "bg-amber-500/15 text-amber-300 border-amber-500/25",
    slate: "bg-slate-700 text-slate-300 border-slate-600",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colors[color]}`}>
      {children}
    </span>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-6 scroll-mt-24">
      <h2 className="text-2xl font-bold text-white border-b border-slate-800 pb-4">{title}</h2>
      {children}
    </section>
  );
}

function Endpoint({
  method,
  path,
  description,
  children,
}: {
  method: "GET" | "POST";
  path: string;
  description: string;
  children: React.ReactNode;
}) {
  const methodColor = method === "POST"
    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="flex items-center gap-3">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${methodColor}`}>
          {method}
        </span>
        <code className="text-slate-100 font-mono text-sm font-semibold">{path}</code>
      </div>
      <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
      {children}
    </div>
  );
}

// ── Docs page ─────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const navLinks = [
    { href: "#overview", label: "Overview" },
    { href: "#authentication", label: "Authentication" },
    { href: "#endpoints", label: "Endpoints" },
    { href: "#errors", label: "Errors" },
    { href: "#examples", label: "Examples" },
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#020617]/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <span className="text-base font-semibold group-hover:text-indigo-300 transition-colors">Compressly</span>
            </Link>
            <span className="text-slate-700">/</span>
            <span className="text-slate-400 text-sm font-medium">API Reference</span>
          </div>
          <Badge color="emerald">v1.0</Badge>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12 flex gap-12">
        {/* ── Sidebar nav ── */}
        <aside className="hidden lg:flex flex-col gap-1 w-52 shrink-0 sticky top-28 self-start">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Contents</p>
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-slate-400 hover:text-white py-1.5 px-3 rounded-lg hover:bg-slate-800/60 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 min-w-0 flex flex-col gap-16">

          {/* Overview */}
          <Section id="overview" title="Overview">
            <p className="text-slate-400 leading-relaxed">
              The Compressly API allows you to compress images programmatically using the same
              engine that powers the web app. The API is <strong className="text-slate-200">REST-based</strong> and
              operates in two modes:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">⚡</span>
                  <span className="font-semibold text-sm">Sync Mode</span>
                  <InlineCode>?sync=true</InlineCode>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Compresses and returns the result immediately in the same request.
                  Best for simple integrations. Also used automatically when the queue is unavailable.
                </p>
              </div>
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🔄</span>
                  <span className="font-semibold text-sm">Async Mode</span>
                  <Badge>Default</Badge>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Returns a <InlineCode>jobId</InlineCode> immediately. Poll <InlineCode>/api/status/:jobId</InlineCode> until
                  completed, then fetch the result. Ideal for large files or batch processing.
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 flex flex-col gap-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Base URL</p>
              <InlineCode>http://localhost:3000</InlineCode>
              <p className="text-xs text-slate-500 mt-1">Replace with your VPS hostname in production.</p>
            </div>
          </Section>

          {/* Authentication */}
          <Section id="authentication" title="Authentication">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 flex gap-3">
              <span className="text-amber-400 text-lg shrink-0">🔓</span>
              <div>
                <p className="text-sm font-semibold text-amber-300 mb-1">No authentication required (v1)</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The API is currently open. Rate limiting is enforced at <strong className="text-slate-300">30 requests/minute per IP</strong>.
                  API key authentication will be added in a future version.
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 p-5 flex flex-col gap-3">
              <p className="text-sm font-semibold text-slate-300">Rate Limit Headers</p>
              <div className="grid grid-cols-1 gap-1.5 font-mono text-xs">
                {[
                  ["X-RateLimit-Limit", "Maximum requests per minute"],
                  ["X-RateLimit-Remaining", "Requests remaining in current window"],
                  ["X-RateLimit-Reset", "Unix timestamp when the window resets"],
                  ["Retry-After", "Seconds to wait (only on 429 responses)"],
                ].map(([header, desc]) => (
                  <div key={header} className="flex gap-3 items-baseline">
                    <span className="text-indigo-300 w-52 shrink-0">{header}</span>
                    <span className="text-slate-500">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Endpoints */}
          <Section id="endpoints" title="Endpoints">

            <Endpoint
              method="POST"
              path="/api/compress"
              description="Upload one or more images for compression. Returns job IDs in async mode, or results directly in sync mode / cache hits."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Request (multipart/form-data)</p>
                  <div className="flex flex-col gap-2 text-xs font-mono">
                    {[
                      ["files", "File[]", "One or more image files (JPEG, PNG, WebP, GIF, AVIF)"],
                      ["options", "JSON string", "Compression options object (see below)"],
                    ].map(([field, type, desc]) => (
                      <div key={field} className="flex flex-col gap-0.5 bg-slate-900 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-indigo-300">{field}</span>
                          <span className="text-slate-600">{type}</span>
                        </div>
                        <span className="text-slate-500">{desc}</span>
                      </div>
                    ))}
                  </div>
                  <Code>{`// options object shape
{
  "format": "webp",        // webp | avif | jpeg | png
  "targetSizeKB": 100,     // target output size in KB
  "qualityStart": 85,      // starting quality (1-100)
  "qualityMin": 20,        // minimum quality floor
  "qualityStep": 5,        // binary search step
  "stripMetadata": true,   // strip EXIF data
  "resize": null           // { width, height, maintainAspect }
                           // or null for no resize
}`}</Code>
                </div>
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Response</p>
                  <Code>{`// Async mode (Redis available)
{
  "results": [
    { "jobId": "5", "error": null,
      "originalName": "photo.jpg" },
    { "jobId": "6", "error": null,
      "originalName": "banner.png" }
  ]
}

// Sync mode / cache hit
{
  "results": [
    {
      "outputUrl": "/generated/cache/cache_abc.webp",
      "outputName": "photo_ts_q78.webp",
      "originalSize": 2048000,
      "compressedSize": 97280,
      "reductionPercent": 95,
      "outputFormat": "webp",
      "quality": 78,
      "cached": true,
      "error": null
    }
  ]
}`}</Code>
                </div>
              </div>
            </Endpoint>

            <Endpoint
              method="GET"
              path="/api/status/:jobId"
              description="Poll the status of a queued compression job. Returns a simple status string."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Response</p>
                  <Code>{`{
  "jobId": "5",
  "status": "pending"
  // pending | processing | completed | failed
}`}</Code>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status Values</p>
                  <div className="flex flex-col gap-2 text-xs">
                    {[
                      ["pending", "slate", "Job is queued, waiting for a worker"],
                      ["processing", "amber", "Worker is currently compressing the image"],
                      ["completed", "emerald", "Done — fetch /api/result/:jobId"],
                      ["failed", "slate", "Job failed — see failedReason in response"],
                    ].map(([status, color, desc]) => (
                      <div key={status} className="flex items-start gap-3 bg-slate-900 rounded-lg p-3">
                        <Badge color={color as "emerald" | "amber" | "slate"}>{status as string}</Badge>
                        <span className="text-slate-400 leading-snug">{desc as string}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Endpoint>

            <Endpoint
              method="GET"
              path="/api/result/:jobId"
              description="Retrieve the final compressed file URL and metadata after a job has completed. Returns 202 if the job is still in progress."
            >
              <Code>{`// 200 OK — job completed
{
  "jobId": "5",
  "outputUrl": "/generated/cache/cache_d3f4a1b2.webp",
  "outputName": "photo_1743093000_q78.webp",
  "originalSize": 2048000,
  "compressedSize": 97280,
  "reductionPercent": 95,
  "outputFormat": "webp",
  "quality": 78,
  "formatOverridden": false,
  "cached": true
}

// 202 Accepted — not yet done
{
  "error": "Job is not yet completed (current state: active)"
}

// 404 Not Found — expired or invalid job
{
  "error": "Job not found or expired"
}`}</Code>
            </Endpoint>

            <Endpoint
              method="POST"
              path="/api/reoptimize"
              description="Re-compress a previously uploaded image with new settings — without re-uploading the original file."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Request (application/json)</p>
                  <Code>{`{
  "uploadId": "uuid_timestamp.jpg",
  "originalName": "photo.jpg",
  "options": { ...same as /api/compress }
}`}</Code>
                </div>
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Response</p>
                  <Code>{`{
  "result": {
    "outputUrl": "/generated/tmp/photo_ts_q85.webp",
    "outputName": "photo_ts_q85.webp",
    "compressedSize": 85000,
    "reductionPercent": 92,
    "outputFormat": "webp",
    "quality": 85,
    "formatOverridden": false,
    "uploadId": "uuid_ts.jpg"
  },
  "error": null
}`}</Code>
                </div>
              </div>
            </Endpoint>
          </Section>

          {/* Errors */}
          <Section id="errors" title="Error Reference">
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Meaning</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Common Cause</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {[
                    ["400", "Bad Request", "Invalid form data, missing files, or bad options JSON"],
                    ["404", "Not Found", "Job ID expired (> 2 hours) or never existed"],
                    ["415", "Unsupported Media Type", "File fails magic-byte validation (not a real image)"],
                    ["429", "Too Many Requests", "Rate limit exceeded — check Retry-After header"],
                    ["500", "Internal Server Error", "Compression failed — image may be corrupt"],
                    ["503", "Service Unavailable", "Redis / queue system is not running"],
                  ].map(([code, meaning, cause]) => (
                    <tr key={code} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-indigo-300">{code}</td>
                      <td className="py-3 px-4 text-slate-300">{meaning}</td>
                      <td className="py-3 px-4 text-slate-500 text-xs">{cause}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Examples */}
          <Section id="examples" title="Request Examples">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-slate-300">Compress with cURL (async)</p>
                <Code>{`curl -X POST http://localhost:3000/api/compress \\
  -F "files=@/path/to/photo.jpg" \\
  -F 'options={"format":"webp","targetSizeKB":100}'

# Response:
# { "results": [{ "jobId": "12", "error": null, "originalName": "photo.jpg" }] }

# Poll status:
curl http://localhost:3000/api/status/12

# Fetch result:
curl http://localhost:3000/api/result/12`}</Code>
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-slate-300">Compress synchronously (no Redis needed)</p>
                <Code>{`curl -X POST "http://localhost:3000/api/compress?sync=true" \\
  -F "files=@/path/to/photo.png" \\
  -F 'options={"format":"png","targetSizeKB":200,"stripMetadata":true}'`}</Code>
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-slate-300">JavaScript / TypeScript fetch example</p>
                <Code>{`const formData = new FormData();
formData.append("files", imageFile);
formData.append("options", JSON.stringify({
  format: "avif",
  targetSizeKB: 50,
  qualityStart: 80,
  qualityMin: 20,
  stripMetadata: true,
}));

const res = await fetch("/api/compress", {
  method: "POST",
  body: formData,
});
const { results } = await res.json();

for (const result of results) {
  if (result.jobId) {
    // Poll until done
    while (true) {
      await new Promise((r) => setTimeout(r, 1500));
      const status = await fetch(\`/api/status/\${result.jobId}\`).then(r => r.json());
      if (status.status === "completed") {
        const data = await fetch(\`/api/result/\${result.jobId}\`).then(r => r.json());
        console.log("Compressed URL:", data.outputUrl);
        break;
      }
      if (status.status === "failed") throw new Error("Compression failed");
    }
  } else {
    // Sync / cache hit
    console.log("URL:", result.outputUrl, "Size:", result.compressedSize);
  }
}`}</Code>
              </div>
            </div>
          </Section>

        </main>
      </div>
    </div>
  );
}
