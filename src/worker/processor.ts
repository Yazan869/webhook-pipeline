import axios from "axios";
import { db } from "../db/index.js";
import { jobs, pipelines, subscribers } from "../db/schema.js";
import { eq } from "drizzle-orm";

async function processJobs() {
  const [job] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.status, "pending"))
    .limit(1);
  if (!job) return;

  try {
    await db
      .update(jobs)
      .set({ status: "processing" })
      .where(eq(jobs.id, job.id));
    const [pipeline] = await db
      .select()
      .from(pipelines)
      .where(eq(pipelines.id, job.pipelineId))
      .limit(1);
    const subs = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.pipelineId, job.pipelineId));

    let payload = { ...(job.payload as object) };
    if (pipeline?.actionType === "TRANSFORM_UPPERCASE")
      payload = JSON.parse(JSON.stringify(payload).toUpperCase());
    if (pipeline?.actionType === "ENRICH_TIMESTAMP")
      payload = { ...payload, processed_at: new Date().toISOString() };
    if (pipeline?.actionType === "FILTER_SENSITIVE") {
      const {
        password: _p,
        secret: _s,
        token: _t,
        ...clean
      } = payload as Record<string, unknown>;
      payload = clean;
    }

    for (const s of subs) {
      await axios.post(s.targetUrl, payload, { timeout: 5000 });
    }

    await db
      .update(jobs)
      .set({ status: "completed", processedAt: new Date() })
      .where(eq(jobs.id, job.id));
    console.log(`✅ Job ${job.id} done.`);
  } catch (err: unknown) {
    const error = err as Error;
    const currentRetries = parseInt(job.retryCount);
    if (currentRetries < 3) {
      console.log(
        `⚠️ Job ${job.id} failed, retrying... (${currentRetries + 1}/3)`
      );
      await db
        .update(jobs)
        .set({
          status: "pending",
          retryCount: (currentRetries + 1).toString(),
          lastError: error.message,
        })
        .where(eq(jobs.id, job.id));
    } else {
      console.error(`❌ Job ${job.id} failed permanently.`);
      await db
        .update(jobs)
        .set({ status: "failed", lastError: error.message })
        .where(eq(jobs.id, job.id));
    }
  }
}

setInterval(processJobs, 5000);