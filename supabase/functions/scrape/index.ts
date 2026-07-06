import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { scrapeRecipePage } from "../_shared/scrapeUrl.ts";
import { parseRecipeWithClaude } from "../_shared/openRouterClient.ts";
import { syncRecipeIngredients } from "../_shared/syncRecipeIngredients.ts";
import { getUserFromRequest } from "../_shared/auth.ts";

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

  const user = await getUserFromRequest(req);
  if (!user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const { url, text, force, book_id } = (await req.json()) as {
    url?: string;
    text?: string;
    force?: boolean;
    book_id?: number;
  };

  const isPasteMode = !url && typeof text === "string" && text.trim().length > 0;

  if (!isPasteMode && (!url || typeof url !== "string")) {
    return jsonResponse(
      { error: "Request body must include a 'url' or 'text' field." },
      400
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // For pasted text, hash the content itself; for URL, hash the URL
  const hashInput = isPasteMode ? text!.trim() : url!;
  const hash = await urlToHash(hashInput);
  const sourceUrl = isPasteMode ? `text:${hash}` : url!;

  // ── Cache hit ──────────────────────────────────────────────────────────────
  if (!force) {
    const { data: cached } = await supabase
      .from("recipes")
      .select("id, data")
      .eq("url_hash", hash)
      .maybeSingle();

    if (cached) {
      console.log(`[scrape] cache hit: ${sourceUrl}`);
      // Still associate this recipe with the requesting book
      if (book_id && cached.id) {
        await supabase
          .from("book_recipes")
          .upsert({ book_id, recipe_id: cached.id }, { onConflict: "book_id,recipe_id" });
      }
      return jsonResponse({ ...cached.data, _cached: true, _hash: hash });
    }
  }

  try {
    let rawContent: string;
    if (isPasteMode) {
      console.log(`[scrape] text paste: ${text!.length} chars`);
      rawContent = text!.trim();
    } else {
      console.log(`[scrape] ${url}`);
      rawContent = await scrapeRecipePage(url!);
      console.log(`[scrape] extracted ${rawContent.length} chars`);
    }

    const recipe = await parseRecipeWithClaude(rawContent);
    console.log(`[scrape] parsed: "${recipe.title}"`);

    const recipeWithUrl = { ...recipe, sourceUrl };

    const { data: upserted } = await supabase.from("recipes").upsert(
      {
        url_hash: hash,
        source_url: sourceUrl,
        title: recipe.title,
        data: recipeWithUrl,
        saved_at: new Date().toISOString(),
        user_id: user.id,
      },
      { onConflict: "url_hash" }
    ).select("id").single();

    if (upserted) {
      await syncRecipeIngredients(recipe, upserted.id, supabase);
      // Link to the requesting book via junction table
      if (book_id) {
        await supabase
          .from("book_recipes")
          .upsert({ book_id, recipe_id: upserted.id }, { onConflict: "book_id,recipe_id" });
      }
    }

    return jsonResponse({ ...recipeWithUrl, _hash: hash });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[scrape] error:", message);
    return jsonResponse({ error: message }, 500);
  }
});
