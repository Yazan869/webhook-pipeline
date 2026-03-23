import express, { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import { pipelines, subscribers, jobs } from "../db/schema.js";
import { eq, desc, count } from "drizzle-orm";

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

app.post("/api/pipelines", async (req: Request, res: Response) => {
  const { name, actionType, subscriberUrls } = req.body;
  try {
    const sourcePath = uuidv4();
    const [newPipeline] = await db
      .insert(pipelines)
      .values({ name, actionType, sourcePath })
      .returning();

    if (subscriberUrls && Array.isArray(subscriberUrls)) {
      for (const url of subscriberUrls) {
        await db
          .insert(subscribers)
          .values({ pipelineId: newPipeline!.id, targetUrl: url });
      }
    }
    res.status(201).json({
      message: "Pipeline created",
      webhookUrl: `http://localhost:${PORT}/wh/${sourcePath}`,
      pipeline: newPipeline,
    });
  } catch {
    res.status(500).json({ error: "Failed to create" });
  }
});

app.get("/api/pipelines", async (_req: Request, res: Response) => {
  const all = await db.select().from(pipelines);
  res.json(all);
});

app.get("/api/pipelines/:id/jobs", async (req: Request, res: Response) => {
  const results = await db
    .select()
    .from(jobs)
    .where(eq(jobs.pipelineId, req.params.id as string))
    .orderBy(desc(jobs.createdAt));
  res.json(results);
});

app.delete("/api/pipelines/:id", async (req: Request, res: Response) => {
  await db.delete(pipelines).where(eq(pipelines.id, req.params.id as string));
  res.status(204).send();
});

app.post("/wh/:sourcePath", async (req: Request, res: Response) => {
  const { sourcePath } = req.params;
  const [pipeline] = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.sourcePath, sourcePath as string))
    .limit(1);

  if (!pipeline) return res.status(404).json({ error: "Not found" });

  await db
    .insert(jobs)
    .values({ pipelineId: pipeline.id, payload: req.body, status: "pending" });
  res.status(202).json({ message: "Accepted" });
});

app.get("/api/stats", async (_req: Request, res: Response) => {
  try {
    const [total] = await db.select({ value: count() }).from(jobs);
    const [completed] = await db
      .select({ value: count() })
      .from(jobs)
      .where(eq(jobs.status, "completed"));
    const [failed] = await db
      .select({ value: count() })
      .from(jobs)
      .where(eq(jobs.status, "failed"));
    const [pending] = await db
      .select({ value: count() })
      .from(jobs)
      .where(eq(jobs.status, "pending"));

    const totalVal = Number(total?.value || 0);
    const completedVal = Number(completed?.value || 0);

    res.json({
      totalJobs: totalVal,
      completedJobs: completedVal,
      failedJobs: Number(failed?.value || 0),
      pendingJobs: Number(pending?.value || 0),
      successRate:
        totalVal > 0
          ? ((completedVal / totalVal) * 100).toFixed(2) + "%"
          : "0%",
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

app.listen(PORT, () =>
  console.log(`🚀 API Server running at http://localhost:${PORT}`)
);
