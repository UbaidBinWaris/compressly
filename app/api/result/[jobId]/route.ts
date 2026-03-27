import { NextRequest } from "next/server";
import { Job } from "bullmq";
import { getQueue, isRedisAvailable, type JobResult, type JobPayload } from "@/lib/queue";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  if (!jobId || typeof jobId !== "string") {
    return Response.json({ error: "Missing jobId" }, { status: 400 });
  }

  const available = await isRedisAvailable().catch(() => false);
  if (!available) {
    return Response.json(
      { error: "Queue system unavailable" },
      { status: 503 }
    );
  }

  try {
    const queue = getQueue();
    const job = await Job.fromId<JobPayload, JobResult>(queue, jobId);

    if (!job) {
      return Response.json({ error: "Job not found or expired" }, { status: 404 });
    }

    const state = await job.getState();
    if (state !== "completed") {
      return Response.json(
        { error: `Job is not yet completed (current state: ${state})` },
        { status: 202 }
      );
    }

    const result = job.returnvalue;
    if (!result) {
      return Response.json({ error: "Job completed but result is unavailable" }, { status: 500 });
    }

    return Response.json({
      jobId,
      outputUrl: result.cachedUrl ?? result.outputUrl,
      outputName: result.outputName,
      originalSize: result.originalSize,
      compressedSize: result.compressedSize,
      reductionPercent: result.reductionPercent,
      outputFormat: result.outputFormat,
      uploadId: result.uploadId,
      formatOverridden: result.formatOverridden,
      quality: result.quality,
      cached: !!result.cachedUrl,
    });
  } catch (err) {
    console.error("[api/result] Error:", err);
    return Response.json({ error: "Failed to fetch job result" }, { status: 500 });
  }
}
