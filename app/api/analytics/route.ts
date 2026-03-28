import { getSnapshot } from "@/lib/analytics";
import { getQueue, isRedisAvailable } from "@/lib/queue";

export async function GET() {
  const snapshot = getSnapshot();

  // Pull active job count from BullMQ when Redis is available
  let activeJobs = 0;
  try {
    const redisUp = await isRedisAvailable().catch(() => false);
    if (redisUp) {
      const queue = getQueue();
      const counts = await queue.getJobCounts("waiting", "active", "delayed");
      activeJobs = (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0);
    }
  } catch {
    // non-critical — leave activeJobs as 0
  }

  return Response.json({ ...snapshot, activeJobs });
}
