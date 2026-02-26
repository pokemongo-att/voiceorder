import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL. Set it in .env.local");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const migrationsDir = path.join(process.cwd(), "drizzle", "migrations");
if (!fs.existsSync(migrationsDir)) {
  console.error("No migrations directory found at drizzle/migrations");
  process.exit(1);
}

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b, "en"));

if (files.length === 0) {
  console.error("No .sql migrations found in drizzle/migrations");
  process.exit(1);
}

await sql`create table if not exists _migrations (id text primary key, applied_at timestamptz not null default now())`;

for (const file of files) {
  const id = file;
  const already = await sql`select id from _migrations where id = ${id} limit 1`;
  if (already.length) {
    console.log("Skip", file);
    continue;
  }
  const full = path.join(migrationsDir, file);
  const content = fs.readFileSync(full, "utf-8");
  console.log("Apply", file);
  // Neon HTTP driver doesn't support multiple statements in a single template tag reliably in some envs.
  // We'll split by ';' and run sequentially (naive but fine for our migration file).
  const statements = content
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    await sql(stmt);
  }

  await sql`insert into _migrations (id) values (${id})`;
}

console.log("Migrations complete.");
