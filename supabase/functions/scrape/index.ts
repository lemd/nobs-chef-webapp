import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { scrapeRecipePage } from "../_shared/scrapeUrl.ts";
import { parseRecipeWithClaude } from "../_shared/openRouterClient.ts";
import { matchIngredient, retryUnmatched } from "../_shared/ingredientMatcher.ts";
import type { Recipe } from "../_shared/recipe.ts";

async function urlToHash(url: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(url));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12);
}

async function syncRecipeIngredients(
  recipe: Recipe,
  recipeId: number,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  // Flatten all ingredient groups into a single ordered list
  const rows: {
    recipe_id: number;
    raw_name: string;
    quantity: string | null;
    unit: string | null;
    notes: string | null;
    group_name: string | null;
    position: number;
    ingredient_id: number | null;
    match_score: number;
  }[] = [];

  let position = 0;
  for (const group of recipe.ingredientGroups) {
    for (const item of group.items) {
      const result = await matchIngredient(item.name, supabase);
      rows.push({
        recipe_id: recipeId,
        raw_name: item.name,
        quantity: item.quantity ?? null,
        unit: item.unit ?? null,
        notes: item.notes ?? null,
        group_name: group.group ?? null,
        position,
        ingredient_id: result.ingredient_id,
        match_score: result.match_score,
      });
      position++;
    }
  }

  if (rows.length > 0) {
    await supabase
      .from("recipe_ingredients")
      .upsert(rows, { onConflict: "recipe_id,position" });
  }

  // Retry any previously unmatched ingredients on this recipe
  await retryUnmatched(recipeId, supabase);
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

    const { data: upserted } = await supabase.from("recipes").upsert(
      {
        url_hash: hash,
        source_url: url,
        title: recipe.title,
        data: recipeWithUrl,
        saved_at: new Date().toISOString(),
      },
      { onConflict: "url_hash" }
    ).select("id").single();

    if (upserted) {
      await syncRecipeIngredients(recipe, upserted.id, supabase);
    }

    return jsonResponse(recipeWithUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[scrape] error:", message);
    return jsonResponse({ error: message }, 500);
  }
});
