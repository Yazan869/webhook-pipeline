import axios from "axios";
import { db } from "../db/index.js";
import { jobs, pipelines, subscribers } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";

interface RawJob {
  id: string;
  pipeline_id: string;
  payload: Record<string, unknown>;
  retry_count: string;
}

async function processJobs() {
  try {
    const result = await db.execute(sql`
      UPDATE ${jobs}
      SET status = 'processing'
      WHERE id = (
        SELECT id
        FROM ${jobs}
        WHERE status = 'pending'
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING id, pipeline_id, payload, retry_count
    `);

    const rawJob = result[0] as unknown as RawJob | undefined;
    if (!rawJob) return;

    const job = {
      id: rawJob.id,
      pipelineId: rawJob.pipeline_id,
      payload: rawJob.payload,
      retryCount: parseInt(rawJob.retry_count),
    };

    console.log(`Worker picked up job: ${job.id}`);

    const [pipeline] = await db
      .select()
      .from(pipelines)
      .where(eq(pipelines.id, job.pipelineId))
      .limit(1);

    const subs = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.pipelineId, job.pipelineId));

    let payload = { ...job.payload };

    if (pipeline?.actionType === "TRANSFORM_UPPERCASE") {
      payload = JSON.parse(JSON.stringify(payload).toUpperCase());
    }
    if (pipeline?.actionType === "ENRICH_TIMESTAMP") {
      payload = { ...payload, processed_at: new Date().toISOString() };
    }
    if (pipeline?.actionType === "FILTER_SENSITIVE") {
      const sensitiveKeys = ["password", "secret", "token"];
      payload = Object.fromEntries(
        Object.entries(payload).filter(
          ([key]) => !sensitiveKeys.includes(key.toLowerCase())
        )
      );
    }

    for (const s of subs) {
      console.log(`  -> Processed Data to deliver:`, JSON.stringify(payload));

      console.log(`  -> Delivering to: ${s.targetUrl}`);
      await axios.post(s.targetUrl, payload, { timeout: 5000 });
    }

    await db
      .update(jobs)
      .set({ status: "completed", processedAt: new Date() })
      .where(eq(jobs.id, job.id));

    console.log(`Job ${job.id} completed.`);
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Worker error:", error.message);

    const [failedJob] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.status, "processing"))
      .limit(1);

    if (failedJob) {
      const currentRetries = parseInt(failedJob.retryCount);
      if (currentRetries < 3) {
        console.log(
          `Job ${failedJob.id} failed, retrying... (${currentRetries + 1}/3)`
        );
        await db
          .update(jobs)
          .set({
            status: "pending",
            retryCount: (currentRetries + 1).toString(),
            lastError: error.message,
          })
          .where(eq(jobs.id, failedJob.id));
      } else {
        console.error(`Job ${failedJob.id} failed permanently.`);
        await db
          .update(jobs)
          .set({ status: "failed", lastError: error.message })
          .where(eq(jobs.id, failedJob.id));
      }
    }
  }
}

console.log("Worker service started...");
setInterval(processJobs, 5000);
