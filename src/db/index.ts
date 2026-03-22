import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing in .env");
}

const client = postgres(connectionString, { 
  max: 1,
  onnotice: (notice) => console.log("Postgres Notice:", notice) 
});

export const db = drizzle(client, { schema });