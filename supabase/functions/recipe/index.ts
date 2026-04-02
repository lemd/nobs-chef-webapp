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

  const { searchParams } = new URL(req.url);
  const file = searchParams.get("file"); // e.g. "abc123def456.json"

  let query = supabase.from("recipes").select("data");

  if (file) {
    const hash = file.replace(/\.json$/, "");
    const { data, error } = await query.eq("url_hash", hash).maybeSingle();
    if (error || !data) {
      return jsonResponse({ error: "File not found." }, 404);
    }
    return jsonResponse(data.data);
  }

  // No file specified – return most recent
  const { data, error } = await query
    .order("saved_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return jsonResponse(
      { error: "No recipes cached yet. Scrape a URL first." },
      404
    );
  }

  return jsonResponse(data.data);
});
