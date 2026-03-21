import { streamText } from "ai";
import { defaultModel } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages } = await request.json();

  const result = streamText({
    model: defaultModel,
    messages,
    system: "You are a helpful assistant.",
  });

  return result.toTextStreamResponse();
}
