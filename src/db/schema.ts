import { pgTable, text, timestamp, uuid, jsonb, pgEnum } from "drizzle-orm/pg-core";

// 1. Define the types of processing our "Zapier-lite" can do
export const actionTypeEnum = pgEnum("action_type", [
  "TRANSFORM_UPPERCASE", 
  "ENRICH_TIMESTAMP", 
  "FILTER_SENSITIVE"
]);

// 2. Pipelines: The core logic container
export const pipelines = pgTable("pipelines", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  sourcePath: text("source_path").notNull().unique(), // Unique URL for the webhook
  actionType: actionTypeEnum("action_type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 3. Subscribers: Where the data goes after processing
export const subscribers = pgTable("subscribers", {
  id: uuid("id").primaryKey().defaultRandom(),
  pipelineId: uuid("pipeline_id").references(() => pipelines.id, { onDelete: "cascade" }).notNull(),
  targetUrl: text("target_url").notNull(),
});

// 4. Jobs: The Queue (This is where webhooks wait to be processed)
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  pipelineId: uuid("pipeline_id").references(() => pipelines.id, { onDelete: "cascade" }).notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status", { enum: ["pending", "processing", "completed", "failed"] }).default("pending").notNull(),
  retryCount: text("retry_count").default("0").notNull(), // Track attempts
  lastError: text("last_error"), // Store what went wrong
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});
