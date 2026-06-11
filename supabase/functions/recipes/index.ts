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
    .select("url_hash, title, source_url, saved_at, data")
    .order("saved_at", { ascending: false });

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  type RecipeData = {
    tags?: unknown;
    ingredientGroups?: Array<{ items: Array<{ name: string }> }>;
  };

  const files = (data ?? []).map((r) => {
    const d = r.data as RecipeData;
    const ingredientNames = (d.ingredientGroups ?? [])
      .flatMap((g) => g.items.map((i) => i.name.toLowerCase()))
      .join(" ");
    return {
      filename: `${r.url_hash}.json`,
      title: r.title,
      sourceUrl: r.source_url,
      savedAt: r.saved_at,
      tags: d.tags ?? null,
      ingredientNames,
    };
  });

  return jsonResponse(files);
});
