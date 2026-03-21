/**
 * Seed the Supabase database using the Management API.
 *
 * Usage: SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/seed-via-api.mjs
 *
 * Get your access token from: https://supabase.com/dashboard/account/tokens
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Load .env.local
const envFile = readFileSync(join(root, ".env.local"), "utf-8");
const env = {};
for (const line of envFile.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!accessToken) {
  console.error("❌ Missing SUPABASE_ACCESS_TOKEN");
  console.error("\nTo get one:");
  console.error("  1. Go to https://supabase.com/dashboard/account/tokens");
  console.error("  2. Generate a new token");
  console.error("  3. Run: SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/seed-via-api.mjs");
  process.exit(1);
}

const projectRef = supabaseUrl.replace("https://", "").replace(".supabase.co", "");

async function runSQL(sql, label) {
  console.log(`\n── ${label} ──`);

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    console.error(`  ❌ Error (${response.status}): ${body.substring(0, 200)}`);
    return false;
  }

  console.log(`  ✅ Success`);
  return true;
}

async function main() {
  console.log(`Project: ${projectRef}`);

  const migrationsDir = join(root, "supabase", "migrations");
  const files = [
    { name: "001_schema.sql", label: "Schema (tables, enums, indexes)" },
    { name: "002_rls.sql", label: "Row Level Security policies" },
    { name: "003_seed.sql", label: "Seed data (exam, domains, badges)" },
  ];

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file.name), "utf-8");
    const ok = await runSQL(sql, file.label);
    if (!ok) {
      console.error(`\nFailed at ${file.name}. Fix the error and re-run.`);
      process.exit(1);
    }
  }

  // Verify
  const verifyResult = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          SELECT
            (SELECT count(*) FROM exams) as exams,
            (SELECT count(*) FROM domains) as domains,
            (SELECT count(*) FROM badges) as badges,
            (SELECT count(*) FROM questions) as questions
        `,
      }),
    }
  );

  if (verifyResult.ok) {
    const data = await verifyResult.json();
    console.log("\n── Verification ──");
    console.log(`  ${JSON.stringify(data)}`);
  }

  console.log("\n✅ Database setup complete!");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
