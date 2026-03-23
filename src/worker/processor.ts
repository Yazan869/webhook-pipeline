import axios from "axios";
import { db } from "../db/index.js";
import { jobs, pipelines, subscribers } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";

async function processJobs() {
  try {
    // ATOMIC LOCKING: Find a job AND mark it as processing in one step.
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
      RETURNING *
    `);

    const job = result[0] as typeof jobs.$inferSelect | undefined;
    if (!job) return;

    console.log(`🚀 Worker picked up job: ${job.id}`);

    const [pipeline] = await db
      .select()
      .from(pipelines)
      .where(eq(pipelines.id, job.pipelineId))
      .limit(1);

    const subs = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.pipelineId, job.pipelineId));

    let payload = { ...(job.payload as Record<string, unknown>) };

    // Apply Transformation logic
    if (pipeline?.actionType === "TRANSFORM_UPPERCASE") {
      payload = JSON.parse(JSON.stringify(payload).toUpperCase());
    }
    if (pipeline?.actionType === "ENRICH_TIMESTAMP") {
      payload = { ...payload, processed_at: new Date().toISOString() };
    }
    if (pipeline?.actionType === "FILTER_SENSITIVE") {
      // THE FIX: Filter keys without using 'any' or 'delete'
      const sensitiveKeys = ["password", "secret", "token"];
      payload = Object.fromEntries(
        Object.entries(payload).filter(
          ([key]) => !sensitiveKeys.includes(key.toLowerCase())
        )
      );
    }

    // Delivery to all subscribers
    for (const s of subs) {
      console.log(`  -> Delivering to: ${s.targetUrl}`);
      await axios.post(s.targetUrl, payload, { timeout: 5000 });
    }

    // Finalize job
    await db
      .update(jobs)
      .set({ status: "completed", processedAt: new Date() })
      .where(eq(jobs.id, job.id));

    console.log(`✅ Job ${job.id} completed.`);
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Worker error:", error.message);
  }
}

console.log("⚙️  Worker service started...");
setInterval(processJobs, 5000);
