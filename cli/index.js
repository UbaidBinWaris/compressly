#!/usr/bin/env node
// @ts-check

/**
 * Compressly CLI
 * Usage: compressly <file> [options]
 *
 * Options:
 *   --format=<webp|avif|jpeg|png>   Output format (default: webp)
 *   --size=<KB>                     Target size in KB (default: 100)
 *   --quality=<1-100>               Starting quality (default: 85)
 *   --no-metadata                   Strip EXIF metadata (default: true)
 *   --host=<url>                    API base URL (default: http://localhost:3000)
 *   --help                          Show this help message
 *   --version                       Show version
 *
 * Examples:
 *   compressly photo.jpg --size=100 --format=webp
 *   compressly ./images/banner.png --format=avif --size=50
 *   compressly photo.jpg --host=https://your-vps.com --format=jpeg
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { FormData, File } = require("buffer"); // Node 18+ built-ins
const PACKAGE_VERSION = "0.1.0";

// ── ANSI colours ──────────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
};

const success = (msg) => console.log(`${c.green}✓${c.reset} ${msg}`);
const info = (msg) => console.log(`${c.cyan}ℹ${c.reset} ${msg}`);
const warn = (msg) => console.log(`${c.yellow}⚠${c.reset} ${msg}`);
const error = (msg) => console.error(`${c.red}✗${c.reset} ${msg}`);
const bold = (msg) => `${c.bold}${msg}${c.reset}`;
const dim = (msg) => `${c.dim}${msg}${c.reset}`;

// ── Argument parsing ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { file: null, format: "webp", size: 100, quality: 85, metadata: false, host: "http://localhost:3000" };
  const raw = argv.slice(2);

  if (raw.length === 0 || raw.includes("--help") || raw.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  if (raw.includes("--version") || raw.includes("-v")) {
    console.log(`compressly v${PACKAGE_VERSION}`);
    process.exit(0);
  }

  for (const token of raw) {
    if (token.startsWith("--")) {
      const [key, value] = token.slice(2).split("=");
      switch (key) {
        case "format":
          if (!["webp", "avif", "jpeg", "png"].includes(value)) {
            error(`Unknown format "${value}". Use: webp | avif | jpeg | png`);
            process.exit(1);
          }
          args.format = value;
          break;
        case "size":
          args.size = parseInt(value, 10);
          if (isNaN(args.size) || args.size <= 0) {
            error("--size must be a positive integer (KB)");
            process.exit(1);
          }
          break;
        case "quality":
          args.quality = parseInt(value, 10);
          if (isNaN(args.quality) || args.quality < 1 || args.quality > 100) {
            error("--quality must be between 1 and 100");
            process.exit(1);
          }
          break;
        case "host":
          args.host = value?.replace(/\/$/, "");
          break;
        case "no-metadata":
          args.metadata = true; // strip metadata = true (flag means yes, strip it)
          break;
        default:
          warn(`Unknown option --${key} — ignored`);
      }
    } else if (!args.file) {
      args.file = token;
    }
  }

  return args;
}

function printHelp() {
  console.log(`
${bold("compressly")} — Image compression CLI

${bold("USAGE")}
  compressly ${c.cyan}<file>${c.reset} [options]

${bold("OPTIONS")}
  ${c.cyan}--format${c.reset}=webp|avif|jpeg|png   Output format ${dim("(default: webp)")}
  ${c.cyan}--size${c.reset}=<KB>                   Target size in KB ${dim("(default: 100)")}
  ${c.cyan}--quality${c.reset}=<1-100>              Starting quality ${dim("(default: 85)")}
  ${c.cyan}--host${c.reset}=<url>                  API host ${dim("(default: http://localhost:3000)")}
  ${c.cyan}--no-metadata${c.reset}                 Strip EXIF/metadata ${dim("(default)")}
  ${c.cyan}--help${c.reset}                        Show this help
  ${c.cyan}--version${c.reset}                     Show version

${bold("EXAMPLES")}
  compressly photo.jpg --size=100 --format=webp
  compressly banner.png --format=avif --size=50 --quality=80
  compressly large.jpg --host=https://your-vps.com
`);
}

// ── Polling helpers ───────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollStatus(host, jobId, maxAttempts = 120) {
  const POLL_INTERVAL = 1500;
  const STATES = { pending: "⏳ Queued…", processing: "🔄 Processing…" };
  let lastStatus = "";

  for (let i = 0; i < maxAttempts; i++) {
    await sleep(POLL_INTERVAL);
    const res = await fetch(`${host}/api/status/${jobId}`).catch(() => null);
    if (!res || !res.ok) continue;

    const { status } = await res.json();

    if (status !== lastStatus) {
      if (STATES[status]) process.stdout.write(`\r  ${STATES[status]}          `);
      lastStatus = status;
    }

    if (status === "completed") {
      process.stdout.write("\r                              \r");
      return true;
    }
    if (status === "failed") {
      process.stdout.write("\r                              \r");
      return false;
    }
  }
  return false; // timed out
}

// ── Bytes formatting ──────────────────────────────────────────────────────────

function fmt(bytes) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  // ── Resolve input file ──────────────────────────────────────────────────────
  const filePath = path.resolve(args.file);
  if (!fs.existsSync(filePath)) {
    error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const stat = fs.statSync(filePath);
  if (stat.size > 20 * 1024 * 1024) {
    error(`File exceeds 20 MB limit: ${fmt(stat.size)}`);
    process.exit(1);
  }

  const filename = path.basename(filePath);
  console.log();
  console.log(`  ${bold("Compressly CLI")} ${dim(`v${PACKAGE_VERSION}`)}`);
  console.log(`  ${dim("─────────────────────────────────────────")}`);
  info(`File    : ${bold(filename)} ${dim(`(${fmt(stat.size)})`)} `);
  info(`Target  : ${bold(`${args.format.toUpperCase()}`)} @ ≤${bold(`${args.size} KB`)}`);
  info(`API     : ${dim(args.host)}`);
  console.log();

  // ── Build request ───────────────────────────────────────────────────────────
  const fileBuffer = fs.readFileSync(filePath);
  const file = new File([fileBuffer], filename, { type: "application/octet-stream" });

  const options = JSON.stringify({
    format: args.format,
    targetSizeKB: args.size,
    qualityStart: args.quality,
    qualityMin: 20,
    qualityStep: 5,
    stripMetadata: true,
    resize: null,
  });

  const formData = new FormData();
  formData.set("files", file, filename);
  formData.set("options", options);

  // ── POST /api/compress ──────────────────────────────────────────────────────
  process.stdout.write(`  ⚡ Uploading…`);
  let compressRes;
  try {
    compressRes = await fetch(`${args.host}/api/compress`, {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    process.stdout.write("\r                              \r");
    error(`Cannot reach API at ${args.host}`);
    error(err.message);
    process.exit(1);
  }

  if (!compressRes.ok) {
    process.stdout.write("\r                              \r");
    const body = await compressRes.json().catch(() => ({}));
    error(`API error (${compressRes.status}): ${body.error ?? "Unknown error"}`);
    process.exit(1);
  }

  const { results } = await compressRes.json();
  const item = results?.[0];

  if (!item) {
    process.stdout.write("\r                              \r");
    error("Empty response from API");
    process.exit(1);
  }

  if (item.error) {
    process.stdout.write("\r                              \r");
    error(`Compression error: ${item.error}`);
    process.exit(1);
  }

  // ── Handle async (jobId) or sync (outputUrl) ────────────────────────────────
  let result = item;

  if (item.jobId) {
    process.stdout.write(`\r  ⏳ Queued (job ${item.jobId})…       `);
    const done = await pollStatus(args.host, item.jobId);

    if (!done) {
      error("Job failed or timed out");
      process.exit(1);
    }

    const resultRes = await fetch(`${args.host}/api/result/${item.jobId}`);
    if (!resultRes.ok) {
      error("Failed to fetch result");
      process.exit(1);
    }
    result = await resultRes.json();
  } else {
    process.stdout.write("\r                              \r");
  }

  // ── Print result ────────────────────────────────────────────────────────────
  const saved = result.originalSize - result.compressedSize;
  const url = `${args.host}${result.outputUrl}`;

  console.log(`  ${c.green}${c.bold}✓ Done!${c.reset}`);
  console.log();
  info(`Output  : ${bold(result.outputName)}`);
  info(`Format  : ${bold(result.outputFormat?.toUpperCase() ?? "—")}${result.quality ? ` @ quality ${result.quality}` : ""}`);
  info(`Original: ${dim(fmt(result.originalSize ?? stat.size))}`);
  info(`Output  : ${bold(fmt(result.compressedSize))} ${c.green}(${result.reductionPercent}% smaller, saved ${fmt(saved)})${c.reset}`);
  if (result.cached) info(`Cache   : ${c.magenta}Instant cache hit — no recompression${c.reset}`);
  if (result.formatOverridden) warn(`Format was auto-upgraded to preserve transparency`);
  console.log();
  console.log(`  ${c.blue}🔗 URL${c.reset}  : ${url}`);
  console.log();
}

main().catch((err) => {
  error(String(err?.message ?? err));
  process.exit(1);
});
