<div align="center">

<img src="public/file.svg" width="48" />

# Compressly

**Production-grade image optimization platform with smart size targeting, queue-based processing, and hash caching.**

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org)
[![Sharp](https://img.shields.io/badge/Sharp-0.34-blueviolet)](https://sharp.pixelplumbing.com)
[![BullMQ](https://img.shields.io/badge/BullMQ-Redis-red)](https://bullmq.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

---

## Introduction

Compressly is a self-hosted image compression platform that converts and compresses images to a **user-specified target size** — not just a quality setting. Upload a JPEG, PNG, WebP, GIF, or AVIF; get back the smallest possible file that still passes your quality floor.

It ships as a Next.js web app with a built-in developer API, making it usable both as a visual tool and as a backend compression service.

### Why Compressly?

Most image compressors ask you to pick a quality level (e.g., 80%). Compressly works backward: you specify a **target file size** (e.g., 100 KB) and it binary-searches for the highest quality that still fits under that budget. The result is always the best possible image for the size you need, not a guess.

---

## Features

| Feature | Details |
|---|---|
| **4 output formats** | WebP, AVIF, JPEG, PNG (lossless) |
| **Smart size targeting** | Binary-search quality engine — hits ≤50/100/200 KB or your custom target |
| **Transparency-aware** | Auto-upgrades JPEG→WebP when an alpha channel is detected |
| **Hash-based caching** | SHA-256(buffer + options) → instant response for repeat uploads |
| **Queue-based processing** | BullMQ + Redis async worker; sync fallback when Redis is down |
| **Re-optimize** | Re-compress any previously uploaded file with new settings, no re-upload |
| **File lifecycle cleanup** | Uploaded originals and output files auto-deleted after 1 hour |
| **Developer API** | REST endpoints for programmatic access — see [API.md](./API.md) |
| **Rate limiting** | 30 requests/minute per IP with standard `X-RateLimit-*` headers |
| **Magic-byte validation** | File content validated by byte signature, not MIME header |
| **Bulk ZIP download** | Download all compressed images as a single ZIP |
| **Settings persistence** | Compression preferences saved to `localStorage` |

---

## Architecture Overview

```
                         ┌─────────────────────────────────────────────────┐
                         │                POST /api/compress                │
                         └────────────────────┬────────────────────────────┘
                                              │
                              ┌───────────────▼──────────────┐
                              │   1. Rate limit check (IP)    │
                              └───────────────┬──────────────┘
                                              │
                              ┌───────────────▼──────────────┐
                              │   2. Magic-byte validation    │
                              └───────────────┬──────────────┘
                                              │
                              ┌───────────────▼──────────────┐
                              │  3. SHA-256 hash(buf+opts)    │
                              └───────────────┬──────────────┘
                                              │
                       ┌──────────────────────▼──────────────────────┐
                       │           4. Cache hit in /generated/cache?  │
                       └──────┬───────────────────────────────┬───────┘
                              │ yes                           │ no
                      ┌───────▼────────┐          ┌──────────▼──────────┐
                      │ Return URL now │          │  5. Redis available? │
                      └────────────────┘          └──────┬─────────┬────┘
                                                         │ yes     │ no
                                              ┌──────────▼─┐   ┌───▼──────────────┐
                                              │ Queue job  │   │ Sync compression  │
                                              │ → jobId    │   │ → result + cache  │
                                              └──────┬─────┘   └───────────────────┘
                                                     │
                                    ┌────────────────▼─────────────────┐
                                    │  compressionWorker.ts (BullMQ)   │
                                    │  - compressImage()               │
                                    │  - copy to /generated/cache/     │
                                    └──────────────────────────────────┘
```

### Sync Fallback

If Redis is unreachable, `isRedisAvailable()` returns `false` and the compress route processes the image synchronously, then caches the result. No queue features are available but all other functionality works normally.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org) (App Router, TypeScript) |
| **Image processing** | [Sharp](https://sharp.pixelplumbing.com) |
| **Queue** | [BullMQ](https://bullmq.io) + [IORedis](https://github.com/redis/ioredis) |
| **Storage** | Local filesystem (`/public/`) |
| **Animations** | [Framer Motion](https://www.framer.com/motion/) |
| **Styling** | Tailwind CSS v4 |
| **Runtime** | Node.js 18+ |

---

## Project Structure

```
compressly/
├── app/
│   ├── api/
│   │   ├── compress/        # POST /api/compress
│   │   ├── reoptimize/      # POST /api/reoptimize
│   │   ├── status/[jobId]/  # GET  /api/status/:jobId
│   │   ├── result/[jobId]/  # GET  /api/result/:jobId
│   │   └── download-zip/    # POST /api/download-zip
│   ├── components/
│   │   ├── DropZone.tsx     # Drag-and-drop upload area
│   │   ├── FileCard.tsx     # Per-file result card with Re-optimize button
│   │   ├── SettingsPanel.tsx # Format / size / resize controls
│   │   └── StatsBar.tsx     # Batch summary + Download All
│   ├── docs/
│   │   └── page.tsx         # Interactive API documentation page
│   ├── hooks/
│   │   └── useSettings.ts   # Settings persistence via localStorage
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx             # Main application page
│
├── lib/
│   ├── cleanup.ts           # Auto-cleanup of tmp dirs (1-hour TTL)
│   ├── compress.ts          # Core compression engine (binary-search)
│   ├── hash.ts              # SHA-256 hash + cache read/write
│   ├── magicBytes.ts        # File type detection by byte signature
│   ├── presets.ts           # Format list, preset definitions, size options
│   ├── queue.ts             # IORedis connection + BullMQ queue
│   ├── rateLimit.ts         # In-memory rate limiter (30 req/min per IP)
│   ├── settings.ts          # CompressionSettings interface + localStorage
│   ├── types.ts             # Shared TypeScript types
│   └── utils.ts             # formatBytes, sanitizeBasename
│
├── workers/
│   ├── compressionWorker.ts # Standalone BullMQ worker process
│   └── tsconfig.json        # Separate tsconfig for the worker
│
├── public/
│   ├── uploads/
│   │   └── tmp/             # Preserved originals (1-hour TTL, UUID-named)
│   └── generated/
│       ├── tmp/             # Compressed output files (1-hour TTL)
│       └── cache/           # Hash-cached outputs (persistent)
│
├── .env.local.example       # Environment variable template
└── package.json
```

---

## Installation & Setup

### Prerequisites

- Node.js 18+
- Redis 6+ (for queue mode — optional, app falls back to sync without it)

### 1. Clone and install

```bash
git clone https://github.com/your-username/compressly.git
cd compressly
npm install
```

### 2. Configure environment (optional)

```bash
cp .env.local.example .env.local
# Edit .env.local to set REDIS_URL if needed
```

### 3. Start Redis

**WSL2 (Windows):**
```bash
wsl redis-server
```

**macOS (Homebrew):**
```bash
brew services start redis
```

**Docker:**
```bash
docker run -p 6379:6379 redis:alpine
```

### 4. Run the application

```bash
# Terminal 1 — Next.js web server
npm run dev

# Terminal 2 — BullMQ compression worker (requires Redis)
npm run worker
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Without Redis**, skip Terminal 2. The app compresses images synchronously — all features work except job queuing.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL for the BullMQ queue |

Create a `.env.local` file (copy from `.env.local.example`) to override defaults.

---

## API Documentation

See **[API.md](./API.md)** for the full API reference, including request/response examples, error codes, and integration samples.

### Quick Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/compress` | Upload and compress images |
| `GET` | `/api/status/:jobId` | Poll job status |
| `GET` | `/api/result/:jobId` | Retrieve completed result |
| `POST` | `/api/reoptimize` | Re-compress without re-upload |
| `POST` | `/api/download-zip` | Download batch as ZIP |

Also available at [http://localhost:3000/docs](http://localhost:3000/docs).

---

## Caching System

Every compression request generates a deterministic cache key:

```
key = SHA-256(fileBuffer + JSON.stringify(options))
```

Before any processing, Compressly scans `public/generated/cache/` for a file named `cache_<key>.<ext>`. If found, the cached URL is returned **immediately** with zero CPU usage — no re-compression, no queuing. If not found, the compressed result is written to the cache after processing so future identical requests are instant.

Cache files are **persistent** — they are never automatically deleted. This makes the cache progressively more effective over time.

---

## File Lifecycle Management

| Directory | Lifetime | Purpose |
|---|---|---|
| `public/uploads/tmp/` | **1 hour** | Preserved originals (enable Re-optimize feature) |
| `public/generated/tmp/` | **1 hour** | Compressed output files |
| `public/generated/cache/` | **Permanent** | Hash-cached optimized files |

Cleanup runs lazily — at most once every 10 minutes — triggered at the start of each compress or re-optimize request. Files are identified for deletion by their filesystem modification time (`mtime`). `.gitkeep` placeholder files are always skipped.

---

## Security

### Magic-Byte Validation

File type is verified by reading the first 12 bytes of the uploaded buffer and matching against known byte signatures. This prevents fake file extensions and malicious content disguised as images — MIME headers and `Content-Type` are deliberately ignored.

Supported signatures: JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), WebP (`RIFF....WEBP`), GIF (`47 49 46 38`), AVIF (`ftyp` box).

### Rate Limiting

Each IP address is limited to **30 compress requests per minute**. The limit is tracked in-memory and resets automatically. Standard HTTP headers are included:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 24
X-RateLimit-Reset: 1743093060
Retry-After: 12        ← only on 429 responses
```

### Path Traversal Protection

The `uploadId` parameter accepted by `/api/reoptimize` and the BullMQ worker is validated against a strict alphanumeric regex (`/^[a-zA-Z0-9_\-.]+$/`) before being used in filesystem operations.

### File Size Limit

Individual uploads are capped at **20 MB**. Requests exceeding this limit are rejected with `400 Bad Request`.

---

## Performance

### Binary-Search Quality Engine

For lossy formats (WebP, AVIF, JPEG), Compressly doesn't encode at a fixed quality. Instead it:

1. Tries `qualityStart` (e.g., 85) — if the result fits the target, use it.
2. Otherwise, binary-search between `qualityMin` (e.g., 20) and `qualityStart - 1`.
3. Return the highest quality value whose output is ≤ target size.

This maximizes visual quality for any given size budget.

### Concurrency

- **API route**: processes multiple uploaded files in parallel using `concurrentMap()`, capped at `Math.min(CPU count, 10)`.
- **Worker**: BullMQ concurrency is identical — `Math.min(CPU count, 10)` jobs run in parallel.
- **Sharp**: configured with `sharp.concurrency(0)` (use all vCores within each job) and `sharp.cache(false)` in the worker.

### Queue System

Async processing via BullMQ means:
- The HTTP response is returned in milliseconds (just a `jobId`).
- Heavy CPU work happens in the worker process, isolated from the web server.
- Failed jobs are automatically retried up to 2 times with exponential backoff.
- Completed and failed jobs are kept in Redis for 2 hours, then pruned.

---

## Future Improvements

- **API key authentication** — per-developer keys with usage tracking
- **CLI tool** — `npx compressly compress ./images/ --format webp --target 100`
- **CDN integration** — push cached files to S3/R2/Cloudflare on completion
- **Analytics dashboard** — bytes saved, compression ratios, cache hit rate
- **Webhook support** — `POST` a callback URL to receive job results
- **Size-based cache eviction** — prune cache when it exceeds a configurable disk quota
- **Batch presets** — save named compression profiles for reuse

---

## License

MIT — see [LICENSE](LICENSE) for details.
