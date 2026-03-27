# Compressly API Reference

> **Base URL:** `http://localhost:3000`
> Replace with your VPS hostname in production.

The Compressly API is REST-based and operates in two modes:

| Mode | How to use | Best for |
|---|---|---|
| **Async** (default) | Returns `jobId`; poll for status | Large files, batch processing |
| **Sync** | Append `?sync=true` | Simple integrations, testing |

The async mode requires Redis. When Redis is unavailable, the API automatically falls back to sync mode.

---

## Authentication

No authentication is required in v1. Rate limiting is enforced at **30 requests per minute per IP address**.

### Rate Limit Headers

Every response from `/api/compress` includes:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 24
X-RateLimit-Reset: 1743093060    ← Unix timestamp
Retry-After: 12                  ← only on 429 responses
```

---

## Endpoints

---

### `POST /api/compress`

Upload one or more images for compression. Returns job IDs (async) or results directly (sync / cache hit).

#### Request

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `files` | `File[]` | ✅ | One or more image files (max 20 MB each) |
| `options` | JSON string | ❌ | Compression options (see below) |

**Options object:**

```jsonc
{
  "format": "webp",         // "webp" | "avif" | "jpeg" | "png"
  "targetSizeKB": 100,      // Target output size in kilobytes
  "qualityStart": 85,       // Starting quality for binary search (1–100)
  "qualityMin": 20,         // Minimum quality floor (1–100)
  "qualityStep": 5,         // Binary search step size
  "stripMetadata": true,    // Remove EXIF/ICC metadata
  "resize": null            // null | { "width": 800, "height": 600, "maintainAspect": true }
}
```

**Query parameters:**

| Parameter | Description |
|---|---|
| `?sync=true` | Force synchronous processing (skip queue) |

#### Response — Async mode

```json
{
  "results": [
    {
      "jobId": "12",
      "originalName": "photo.jpg",
      "error": null
    },
    {
      "jobId": "13",
      "originalName": "banner.png",
      "error": null
    }
  ]
}
```

#### Response — Sync mode / Cache hit

```json
{
  "results": [
    {
      "outputUrl": "/generated/cache/cache_d3f4a1b2c9.webp",
      "outputName": "photo_1743093000_q78.webp",
      "originalSize": 2048000,
      "compressedSize": 97280,
      "reductionPercent": 95,
      "outputFormat": "webp",
      "uploadId": "550e8400-e29b_1743093000.jpg",
      "formatOverridden": false,
      "quality": 78,
      "cached": true,
      "originalName": "photo.jpg",
      "error": null
    }
  ]
}
```

#### Response — Error (per file)

```json
{
  "results": [
    {
      "originalName": "document.pdf",
      "error": "Unsupported file type for \"document.pdf\". Accepted: JPEG, PNG, WebP, GIF, AVIF."
    }
  ]
}
```

#### cURL example

```bash
# Async (default)
curl -X POST http://localhost:3000/api/compress \
  -F "files=@photo.jpg" \
  -F "files=@banner.png" \
  -F 'options={"format":"webp","targetSizeKB":100,"stripMetadata":true}'

# Sync
curl -X POST "http://localhost:3000/api/compress?sync=true" \
  -F "files=@photo.jpg" \
  -F 'options={"format":"avif","targetSizeKB":50}'
```

---

### `GET /api/status/:jobId`

Poll the status of a queued compression job.

#### Path parameters

| Parameter | Type | Description |
|---|---|---|
| `jobId` | string | Job ID returned by `/api/compress` |

#### Response — 200 OK

```json
{
  "jobId": "12",
  "status": "completed"
}
```

```json
{
  "jobId": "12",
  "status": "pending"
}
```

```json
{
  "jobId": "12",
  "status": "failed",
  "reason": "Input file is missing or corrupted"
}
```

#### Status values

| Status | Meaning |
|---|---|
| `pending` | Job is queued; waiting for a worker |
| `processing` | Worker is currently compressing |
| `completed` | Done — fetch `/api/result/:jobId` |
| `failed` | Job failed — check `reason` field |

#### Response — 503 Service Unavailable

```json
{ "error": "Queue system unavailable" }
```

Returned when Redis is not running.

#### cURL example

```bash
curl http://localhost:3000/api/status/12
```

---

### `GET /api/result/:jobId`

Retrieve the compressed file URL and metadata once the job is completed.

#### Path parameters

| Parameter | Type | Description |
|---|---|---|
| `jobId` | string | Job ID returned by `/api/compress` |

#### Response — 200 OK (completed)

```json
{
  "jobId": "12",
  "outputUrl": "/generated/cache/cache_d3f4a1b2c9.webp",
  "outputName": "photo_1743093000_q78.webp",
  "originalSize": 2048000,
  "compressedSize": 97280,
  "reductionPercent": 95,
  "outputFormat": "webp",
  "uploadId": "550e8400-e29b_1743093000.jpg",
  "formatOverridden": false,
  "quality": 78,
  "cached": true
}
```

**Field reference:**

| Field | Type | Description |
|---|---|---|
| `outputUrl` | string | Relative URL to download the file |
| `outputName` | string | Filename: `original_timestamp_qQuality.ext` |
| `originalSize` | number | Input file size in bytes |
| `compressedSize` | number | Output file size in bytes |
| `reductionPercent` | number | Size reduction as a percentage (0–100) |
| `outputFormat` | string | Actual output format (may differ from requested if transparency was detected) |
| `uploadId` | string | ID of the preserved original — required for `/api/reoptimize` |
| `formatOverridden` | boolean | `true` if format was changed (e.g., JPEG→WebP for transparency) |
| `quality` | number | Final quality value used (1–100 for lossy; compressionLevel 0–9 for PNG) |
| `cached` | boolean | `true` if result was served from hash cache |

#### Response — 202 Accepted (not yet complete)

```json
{
  "error": "Job is not yet completed (current state: active)"
}
```

#### Response — 404 Not Found

```json
{ "error": "Job not found or expired" }
```

Jobs are kept for 2 hours after completion. After that, they are pruned from Redis.

#### cURL example

```bash
curl http://localhost:3000/api/result/12
```

---

### `POST /api/reoptimize`

Re-compress a previously uploaded image with new settings without re-uploading the original file. Requires the `uploadId` from a previous compress result (valid for 1 hour).

#### Request

**Content-Type:** `application/json`

```json
{
  "uploadId": "550e8400-e29b_1743093000.jpg",
  "originalName": "photo.jpg",
  "options": {
    "format": "avif",
    "targetSizeKB": 50,
    "qualityStart": 80,
    "qualityMin": 20,
    "stripMetadata": true,
    "resize": null
  }
}
```

#### Response — 200 OK

```json
{
  "result": {
    "outputUrl": "/generated/tmp/photo_1743093060_q62.avif",
    "outputName": "photo_1743093060_q62.avif",
    "originalSize": 2048000,
    "compressedSize": 48500,
    "reductionPercent": 97,
    "outputFormat": "avif",
    "uploadId": "550e8400-e29b_1743093000.jpg",
    "formatOverridden": false,
    "quality": 62
  },
  "error": null
}
```

#### Response — 404 Not Found

```json
{ "error": "Original file not found — it may have expired. Please re-upload." }
```

Original files are deleted after 1 hour.

#### cURL example

```bash
curl -X POST http://localhost:3000/api/reoptimize \
  -H "Content-Type: application/json" \
  -d '{
    "uploadId": "550e8400-e29b_1743093000.jpg",
    "originalName": "photo.jpg",
    "options": { "format": "avif", "targetSizeKB": 50 }
  }'
```

---

### `POST /api/download-zip`

Bundle a list of compressed files into a ZIP archive for download.

#### Request

**Content-Type:** `application/json`

```json
{
  "filenames": [
    "photo_1743093000_q78.webp",
    "banner_1743093001_q71.webp"
  ]
}
```

Files are resolved from `public/generated/` (both `tmp/` and `cache/` are searched).

#### Response

Binary ZIP stream with `Content-Type: application/zip`.

---

## Error Reference

| HTTP Status | Meaning | Common Cause |
|---|---|---|
| `400` | Bad Request | Missing files, invalid JSON options, or bad `uploadId` |
| `404` | Not Found | Job expired (> 2 hours) or original file expired (> 1 hour) |
| `415` | Unsupported Media Type | File fails magic-byte validation |
| `429` | Too Many Requests | Rate limit exceeded — check `Retry-After` header |
| `500` | Internal Server Error | Compression failed (corrupt image) |
| `503` | Service Unavailable | Redis / queue not running |

All error responses follow the shape:

```json
{ "error": "Human-readable error message" }
```

---

## Integration Examples

### JavaScript / TypeScript

```typescript
async function compressImage(file: File, targetKB = 100): Promise<string> {
  const formData = new FormData();
  formData.append("files", file);
  formData.append("options", JSON.stringify({
    format: "webp",
    targetSizeKB: targetKB,
    qualityStart: 85,
    qualityMin: 20,
    stripMetadata: true,
  }));

  const res = await fetch("/api/compress", { method: "POST", body: formData });
  const { results } = await res.json();
  const item = results[0];

  if (item.error) throw new Error(item.error);

  // Sync / cache hit — URL available immediately
  if (item.outputUrl) return item.outputUrl;

  // Async — poll for result
  const { jobId } = item;
  while (true) {
    await new Promise((r) => setTimeout(r, 1500));
    const { status } = await fetch(`/api/status/${jobId}`).then(r => r.json());
    if (status === "failed") throw new Error("Compression job failed");
    if (status === "completed") {
      const result = await fetch(`/api/result/${jobId}`).then(r => r.json());
      return result.outputUrl;
    }
  }
}
```

### Python

```python
import requests
import time

def compress_image(filepath: str, target_kb: int = 100) -> str:
    with open(filepath, "rb") as f:
        res = requests.post(
            "http://localhost:3000/api/compress",
            files={"files": f},
            data={"options": f'{{"format":"webp","targetSizeKB":{target_kb}}}'},
        )
    res.raise_for_status()
    item = res.json()["results"][0]

    if item.get("error"):
        raise ValueError(item["error"])

    # Immediate result (sync or cache hit)
    if item.get("outputUrl"):
        return item["outputUrl"]

    # Poll for async result
    job_id = item["jobId"]
    while True:
        time.sleep(1.5)
        status_res = requests.get(f"http://localhost:3000/api/status/{job_id}").json()
        if status_res["status"] == "completed":
            return requests.get(f"http://localhost:3000/api/result/{job_id}").json()["outputUrl"]
        if status_res["status"] == "failed":
            raise RuntimeError("Compression failed")
```

### cURL (sync, full example)

```bash
# Compress + wait for result in one command (sync mode)
curl -s -X POST "http://localhost:3000/api/compress?sync=true" \
  -F "files=@/path/to/photo.jpg" \
  -F 'options={"format":"webp","targetSizeKB":100,"stripMetadata":true}' \
  | jq '.results[0] | {url: .outputUrl, size: .compressedSize, reduction: .reductionPercent}'
```
