import { NextRequest } from "next/server";
import { Job } from "bullmq";
import { getQueue, isRedisAvailable, type JobResult } from "@/lib/queue";

type BullMQState = "waiting" | "active" | "completed" | "failed" | "delayed" | "unknown";
type PublicStatus = "pending" | "processing" | "completed" | "failed";

function mapState(state: BullMQState): PublicStatus {
  switch (state) {
    case "waiting":
    case "delayed":
      return "pending";
    case "active":
      return "processing";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    default:
      return "pending";
  }
}

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
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    const state = (await job.getState()) as BullMQState;
    const status = mapState(state);

    return Response.json({
      jobId,
      status,
      ...(status === "failed" && { reason: job.failedReason }),
    });
  } catch (err) {
    console.error("[api/status] Error:", err);
    return Response.json({ error: "Failed to fetch job status" }, { status: 500 });
  }
}

// Needed for TS — JobPayload is already typed in queue.ts but Job needs it here too
interface JobPayload {
  uploadId: string;
  originalName: string;
  options: unknown;
  hash: string;
}
