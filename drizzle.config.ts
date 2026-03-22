import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load environment variables from .env
dotenv.config();

export default defineConfig({
  // 1. Specify the database type (This fixes your error)
  dialect: "postgresql", 
  
  // 2. Point to your schema file
  schema: "./src/db/schema.ts",
  
  // 3. Specify where to save the generated SQL migration files
  out: "./src/db/migrations",
  
  // 4. Provide the connection credentials
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  
  // 5. High-level strictness for professional projects
  verbose: true,
  strict: true,
});