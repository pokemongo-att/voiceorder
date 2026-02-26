import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL. Please set it in .env.local");
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql);
