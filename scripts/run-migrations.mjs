/**
 * Run schema + seed migrations against Supabase.
 * Tries multiple connection methods.
 */
import pg from "pg";
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
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const projectRef = supabaseUrl.replace("https://", "").replace(".supabase.co", "");

// Try direct DB connection (db.PROJECT_REF.supabase.co)
const connStrings = [
  `postgresql://postgres:${serviceRoleKey}@db.${projectRef}.supabase.co:5432/postgres`,
  `postgresql://postgres.${projectRef}:${serviceRoleKey}@aws-0-us-west-1.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres.${projectRef}:${serviceRoleKey}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
];

async function tryConnect(connString, label) {
  const client = new pg.Client({
    connectionString: connString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log(`✅ Connected via: ${label}`);
    return client;
  } catch (err) {
    console.log(`❌ ${label}: ${err.message.substring(0, 80)}`);
    return null;
  }
}

async function main() {
  console.log(`Project: ${projectRef}\n`);
  console.log("Trying connection methods...");

  let client = null;
  const labels = ["Direct DB", "Pooler us-west-1:5432", "Pooler us-east-1:5432"];

  for (let i = 0; i < connStrings.length; i++) {
    client = await tryConnect(connStrings[i], labels[i]);
    if (client) break;
  }

  if (!client) {
    console.error("\n⚠️ Could not connect to the database.");
    console.error("You need to run the migrations manually in the Supabase Dashboard SQL Editor:");
    console.error(`  1. Go to: https://supabase.com/dashboard/project/${projectRef}/sql/new`);
    console.error("  2. Paste and run each file in order:");
    console.error("     - supabase/migrations/001_schema.sql");
    console.error("     - supabase/migrations/002_rls.sql");
    console.error("     - supabase/migrations/003_seed.sql");
    process.exit(1);
  }

  try {
    const migrationsDir = join(root, "supabase", "migrations");
    const files = ["001_schema.sql", "002_rls.sql", "003_seed.sql"];

    for (const file of files) {
      const path = join(migrationsDir, file);
      const sql = readFileSync(path, "utf-8");

      console.log(`\n── Running: ${file} ──`);
      try {
        await client.query(sql);
        console.log(`  ✅ Success`);
      } catch (err) {
        if (err.message.includes("already exists") || err.message.includes("duplicate")) {
          console.log(`  ⚠️  Partially applied: ${err.message.substring(0, 120)}`);
        } else {
          console.error(`  ❌ Error: ${err.message}`);
          throw err;
        }
      }
    }

    // Verify
    const { rows: exams } = await client.query("SELECT id, name FROM exams");
    console.log(`\nVerification:`);
    console.log(`  Exams: ${exams.length} (${exams.map(e => e.name).join(", ")})`);

    const { rows: domains } = await client.query("SELECT id, name FROM domains ORDER BY display_order");
    console.log(`  Domains: ${domains.length}`);
    domains.forEach(d => console.log(`    - ${d.name}`));

    const { rows: badges } = await client.query("SELECT code, name FROM badges");
    console.log(`  Badges: ${badges.length}`);

    const { rows: questions } = await client.query("SELECT count(*) as cnt FROM questions");
    console.log(`  Questions: ${questions[0].cnt}`);

    console.log("\n✅ All migrations complete!");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("\nFatal:", err.message);
  process.exit(1);
});
