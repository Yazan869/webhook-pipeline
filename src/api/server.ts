import express, { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import { pipelines, subscribers, jobs } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// 1. Create Pipeline
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
  } catch (_err) {
    res.status(500).json({ error: "Failed to create" });
  }
});

// 2. List all Pipelines
app.get("/api/pipelines", async (_req: Request, res: Response) => {
  const all = await db.select().from(pipelines);
  res.json(all);
});

// 3. Get Pipeline History
app.get("/api/pipelines/:id/jobs", async (req: Request, res: Response) => {
  const results = await db
    .select()
    .from(jobs)
    .where(eq(jobs.pipelineId, req.params.id as string))
    .orderBy(desc(jobs.createdAt));
  res.json(results);
});

// 4. Delete Pipeline
app.delete("/api/pipelines/:id", async (req: Request, res: Response) => {
  await db.delete(pipelines).where(eq(pipelines.id, req.params.id as string));
  res.status(204).send();
});

// 5. Webhook Ingestion
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

app.listen(PORT, () =>
  console.log(`🚀 API Server running at http://localhost:${PORT}`)
);