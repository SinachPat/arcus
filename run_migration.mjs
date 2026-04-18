import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

// Supabase JS client doesn't support raw DDL, but we can use the
// Supabase Management API with the service key via fetch
const projectRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
console.log("Project ref:", projectRef);

const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${key}`,
  },
  body: JSON.stringify({
    query: "ALTER TABLE public.user_question_history ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false;"
  }),
});

const result = await res.json();
console.log("Status:", res.status);
console.log("Result:", JSON.stringify(result));
