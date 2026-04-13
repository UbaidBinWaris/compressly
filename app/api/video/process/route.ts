import { NextRequest } from "next/server";
import path from "node:path";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { sanitizeBasename } from "@/lib/utils";
import { maybeCleanup, GENERATED_DIR, UPLOADS_TMP_DIR } from "@/lib/cleanup";

type OutputFormat = "mp4" | "webm";
type Resolution = "1080p" | "720p" | "480p";
type Bitrate = "low" | "medium" | "high";
type AudioMode = "replace" | "mix";

interface VideoSettings {
  format: OutputFormat;
  resolution: Resolution;
  bitrate: Bitrate;
}

interface AudioSettings {
  musicLoop: boolean;
  loopVideo: boolean;
  audioMode: AudioMode;
  musicVolume: number;
  audioStartOffset: number;
  fadeIn: number;
  fadeOut: number;
  normalize: boolean;
}

interface SubtitleSettings {
  srtFile?: File | null;
}

interface ProcessOptions {
  video: VideoSettings;
  audio: AudioSettings;
  subtitles?: SubtitleSettings;
}

const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

const OUTPUT_DIR = GENERATED_DIR;
const TMP_DIR = UPLOADS_TMP_DIR;

export const runtime = "nodejs";

type FfmpegResult = {
  code: number;
  stderr: string;
};

type FfprobeResult = {
  code: number;
  stdout: string;
  stderr: string;
};

function extFromName(name: string): string {
  const ext = path.extname(name).toLowerCase();
  return ext || ".bin";
}

function isVideoType(file: File): boolean {
  const ext = extFromName(file.name);
  return [".mp4", ".mov", ".webm"].includes(ext) || file.type.startsWith("video/");
}

function isAudioType(file: File): boolean {
  const ext = extFromName(file.name);
  return [".mp3", ".wav", ".ogg", ".aac", ".flac", ".m4a", ".opus", ".webm"].includes(ext) || file.type.startsWith("audio/");
}

function outputCodecs(format: OutputFormat): string[] {
  if (format === "webm") return ["-c:v", "libvpx-vp9", "-c:a", "libopus", "-b:a", "128k"];
  return ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k"];
}

function bitrateValue(bitrate: Bitrate): string {
  if (bitrate === "low") return "800k";
  if (bitrate === "high") return "4000k";
  return "1800k";
}

function scaleValue(resolution: Resolution): string {
  if (resolution === "1080p") return "1920:1080";
  if (resolution === "480p") return "854:480";
  return "1280:720";
}

function runFfmpeg(args: string[]): Promise<FfmpegResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => reject(err));

    child.on("close", (code) => {
      resolve({ code: code ?? 1, stderr });
    });
  });
}

function runFfprobe(args: string[]): Promise<FfprobeResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffprobe", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => reject(err));

    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function probeDuration(filePath: string): Promise<number | null> {
  try {
    const result = await runFfprobe([
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);

    if (result.code !== 0) return null;

    const duration = Number.parseFloat(result.stdout.trim());
    return Number.isFinite(duration) && duration > 0 ? duration : null;
  } catch {
    return null;
  }
}

function ffmpegNotFoundMessage(): string {
  return "FFmpeg is not installed or not available in PATH on the server.";
}

function resolveLoopPlan(
  videoDuration: number | null,
  audioDuration: number | null,
  audioStartOffset: number,
  options: ProcessOptions,
) {
  const videoDurationSafe = videoDuration ?? 0;
  const audioDurationSafe = audioDuration === null ? 0 : audioDuration + audioStartOffset;

  let targetDuration = videoDurationSafe;
  if (audioDuration !== null) {
    if (options.audio.loopVideo && options.audio.musicLoop) {
      targetDuration = Math.max(videoDurationSafe, audioDurationSafe);
    } else if (options.audio.loopVideo) {
      targetDuration = Math.max(videoDurationSafe, audioDurationSafe);
    } else if (options.audio.musicLoop) {
      targetDuration = videoDurationSafe;
    } else {
      targetDuration = Math.min(videoDurationSafe, audioDurationSafe || videoDurationSafe);
    }
  }

  const outputDuration = Math.max(0.1, targetDuration);
  return {
    outputDuration,
    loopVideo: !!audioDuration && !!options.audio.loopVideo && videoDurationSafe < outputDuration,
    loopAudio: !!audioDuration && !!options.audio.musicLoop && audioDurationSafe < outputDuration,
  };
}

export async function POST(request: NextRequest) {
  await maybeCleanup();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const videoFile = form.get("file");
  if (!(videoFile instanceof File)) {
    return Response.json({ error: "Missing video file" }, { status: 400 });
  }

  if (!isVideoType(videoFile)) {
    return Response.json({ error: "Unsupported video format. Use MP4, MOV, or WebM." }, { status: 400 });
  }

  if (videoFile.size > MAX_VIDEO_BYTES) {
    return Response.json({ error: "Video is too large (max 500 MB)." }, { status: 400 });
  }

  const musicFileRaw = form.get("musicFile");
  const musicFile = musicFileRaw instanceof File ? musicFileRaw : null;

  if (musicFile) {
    if (!isAudioType(musicFile)) {
      return Response.json({ error: "Unsupported audio format for background track." }, { status: 400 });
    }
    if (musicFile.size > MAX_AUDIO_BYTES) {
      return Response.json({ error: "Audio file is too large (max 50 MB)." }, { status: 400 });
    }
  }

  let options: ProcessOptions;
  const rawOptions = form.get("options");
  if (typeof rawOptions !== "string") {
    return Response.json({ error: "Missing processing options" }, { status: 400 });
  }

  try {
    options = JSON.parse(rawOptions) as ProcessOptions;
  } catch {
    return Response.json({ error: "Invalid options JSON" }, { status: 400 });
  }

  await mkdir(TMP_DIR, { recursive: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  const reqId = randomUUID();
  const inputBase = sanitizeBasename(path.basename(videoFile.name, path.extname(videoFile.name)), 64);
  const inVideoPath = path.join(TMP_DIR, `video_${inputBase}_${reqId}${extFromName(videoFile.name)}`);
  const outExt = options.video.format === "webm" ? ".webm" : ".mp4";
  const outName = `video_${inputBase}_${Date.now()}${outExt}`;
  const outPath = path.join(OUTPUT_DIR, outName);

  await writeFile(inVideoPath, Buffer.from(await videoFile.arrayBuffer()));

  let inAudioPath: string | null = null;
  if (musicFile) {
    inAudioPath = path.join(TMP_DIR, `audio_${reqId}${extFromName(musicFile.name)}`);
    await writeFile(inAudioPath, Buffer.from(await musicFile.arrayBuffer()));
  }

  const cleanupFiles = async () => {
    await Promise.allSettled([
      unlink(inVideoPath),
      inAudioPath ? unlink(inAudioPath) : Promise.resolve(),
    ]);
  };

  const [videoDuration, audioDuration] = await Promise.all([
    probeDuration(inVideoPath),
    inAudioPath ? probeDuration(inAudioPath) : Promise.resolve(null),
  ]);

  const audioStartOffset = Math.max(0, options.audio.audioStartOffset);
  const { outputDuration, loopVideo, loopAudio } = resolveLoopPlan(videoDuration, audioDuration, audioStartOffset, options);

  const args: string[] = ["-y"];

  if (loopVideo) args.push("-stream_loop", "-1");
  args.push("-i", inVideoPath);

  if (inAudioPath) {
    if (loopAudio) args.push("-stream_loop", "-1");
    args.push("-i", inAudioPath);
  }

  const filters: string[] = [];
  const mapArgs: string[] = ["-map", "[vout]"];

  filters.push(`[0:v]scale=${scaleValue(options.video.resolution)}[vout]`);

  if (inAudioPath) {
    const fx: string[] = [];

    const volume = Math.min(100, Math.max(0, options.audio.musicVolume)) / 100;
    fx.push(`volume=${volume.toFixed(2)}`);

    if (audioStartOffset > 0) {
      const delayMs = Math.round(audioStartOffset * 1000);
      fx.push(`adelay=${delayMs}|${delayMs}`);
    }

    if (options.audio.fadeIn > 0) {
      fx.push(`afade=t=in:st=0:d=${options.audio.fadeIn}`);
    }

    if (options.audio.normalize) {
      fx.push("loudnorm=I=-16:TP=-1.5:LRA=11");
    }

    if (options.audio.fadeOut > 0 && outputDuration > options.audio.fadeOut) {
      const fadeOutStart = Math.max(0, outputDuration - options.audio.fadeOut);
      fx.push(`afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${options.audio.fadeOut}`);
    }

    const musicChain = fx.length > 0 ? `[1:a]${fx.join(",")}[music]` : "[1:a]anull[music]";
    filters.push(musicChain);

    if (options.audio.audioMode === "replace") {
      filters.push("[music]anull[aout]");
      mapArgs.push("-map", "[aout]");
    } else {
      filters.push("[0:a][music]amix=inputs=2:duration=first:dropout_transition=2[aout]");
      mapArgs.push("-map", "[aout]");
    }
  } else {
    mapArgs.push("-map", "0:a?");
  }

  args.push(
    "-filter_complex",
    filters.join(";"),
    ...mapArgs,
    "-b:v",
    bitrateValue(options.video.bitrate),
    ...outputCodecs(options.video.format),
    "-t",
    outputDuration.toFixed(3),
    outPath,
  );

  let ffmpeg: FfmpegResult;
  try {
    ffmpeg = await runFfmpeg(args);
  } catch (err) {
    if (err instanceof Error && /ENOENT/i.test(err.message)) {
      await cleanupFiles();
      return Response.json({ error: ffmpegNotFoundMessage() }, { status: 500 });
    }
    await cleanupFiles();
    return Response.json({ error: "Failed to execute FFmpeg" }, { status: 500 });
  }

  if (ffmpeg.code !== 0) {
    await cleanupFiles();
    return Response.json(
      {
        error: "Video processing failed",
        details: ffmpeg.stderr.slice(-1200),
      },
      { status: 500 },
    );
  }

  const [inputStat, outputStat] = await Promise.all([stat(inVideoPath), stat(outPath)]);
  const reductionPercent = Math.round((1 - outputStat.size / inputStat.size) * 100);

  const response = Response.json({
    originalSize: inputStat.size,
    compressedSize: outputStat.size,
    reductionPercent,
    outputUrl: `/generated/${outName}`,
    outputName: outName,
    outputFormat: options.video.format,
    hasAudio: !!inAudioPath,
    isSimulated: false,
    loopBehavior: {
      loopAudio,
      loopVideo,
      bothRequested: !!options.audio.musicLoop && !!options.audio.loopVideo,
    },
  });
  await cleanupFiles();
  return response;
}
