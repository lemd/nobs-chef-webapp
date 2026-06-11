import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { scrapeRecipePage } from "../_shared/scrapeUrl.ts";
import { parseRecipeWithClaude } from "../_shared/openRouterClient.ts";

async function urlToHash(url: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(url));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  const secret = Deno.env.get("PERSONAL_SECRET");
  if (!secret || !authHeader || authHeader !== `Bearer ${secret}`) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const { url, force } = (await req.json()) as {
    url?: string;
    force?: boolean;
  };

  if (!url || typeof url !== "string") {
    return jsonResponse(
      { error: "Request body must include a 'url' string." },
      400
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const hash = await urlToHash(url);

  // ── Cache hit ──────────────────────────────────────────────────────────────
  if (!force) {
    const { data: cached } = await supabase
      .from("recipes")
      .select("data")
      .eq("url_hash", hash)
      .maybeSingle();

    if (cached) {
      console.log(`[scrape] cache hit: ${url}`);
      return jsonResponse({ ...cached.data, _cached: true });
    }
  }

  try {
    console.log(`[scrape] ${url}`);
    const rawContent = await scrapeRecipePage(url);
    console.log(`[scrape] extracted ${rawContent.length} chars`);

    const recipe = await parseRecipeWithClaude(rawContent);
    console.log(`[scrape] parsed: "${recipe.title}"`);

    const recipeWithUrl = { ...recipe, sourceUrl: url };

    await supabase.from("recipes").upsert(
      {
        url_hash: hash,
        source_url: url,
        title: recipe.title,
        data: recipeWithUrl,
        saved_at: new Date().toISOString(),
      },
      { onConflict: "url_hash" }
    );

    return jsonResponse(recipeWithUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[scrape] error:", message);
    return jsonResponse({ error: message }, 500);
  }
});
