/**
 * Execute full-setup.sql against the remote Supabase database.
 * Uses the `pg` package to connect via the pooler endpoint.
 *
 * Usage: node scripts/run-setup.mjs
 *
 * Requires the database password as env var: SUPABASE_DB_PASSWORD
 * Or pass it as the first argument: node scripts/run-setup.mjs <password>
 */

import pg from "pg";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROJECT_REF = "dmxaallhflqzjmlfpqot";

// Try env var first, then CLI arg
const password = process.env.SUPABASE_DB_PASSWORD || process.argv[2];

if (!password) {
  console.error(`
╔═══════════════════════════════════════════════════════════╗
║  Missing database password!                              ║
║                                                          ║
║  Get it from:                                            ║
║  Supabase Dashboard → Project Settings → Database        ║
║  → Connection string → Password                          ║
║                                                          ║
║  Then run:                                               ║
║  node scripts/run-setup.mjs YOUR_PASSWORD                ║
╚═══════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

const connectionString = `postgresql://postgres.${PROJECT_REF}:${password}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

const sql = readFileSync(resolve(__dirname, "full-setup.sql"), "utf-8");

async function main() {
  console.log("🔌 Connecting to Supabase...");

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("✅ Connected!\n");

    console.log("🚀 Running full-setup.sql...");
    const result = await client.query(sql);

    // The last statement returns the summary
    const rows = Array.isArray(result) ? result[result.length - 1]?.rows : result.rows;
    if (rows?.[0]?.result) {
      console.log(`\n✅ ${rows[0].result}`);
    } else {
      console.log("\n✅ Setup completed successfully!");
    }
  } catch (err) {
    console.error("\n❌ Error:", err.message);
    if (err.message.includes("password")) {
      console.error("\nHint: Check your database password in Supabase Dashboard → Project Settings → Database");
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
