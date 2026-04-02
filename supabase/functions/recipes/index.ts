import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await supabase
    .from("recipes")
    .select("url_hash, title, saved_at")
    .order("saved_at", { ascending: false });

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  const files = (data ?? []).map((r) => ({
    filename: `${r.url_hash}.json`,
    title: r.title,
    savedAt: r.saved_at,
  }));

  return jsonResponse(files);
});
