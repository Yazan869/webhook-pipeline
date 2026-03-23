import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  dialect: "postgresql", 
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: "postgres://yazan_admin:yazan_password_123@127.0.0.1:5432/pipeline_db",
  },
  verbose: true,
  strict: true,
});