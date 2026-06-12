import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getUserFromRequest } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get all book IDs the user belongs to
  const { data: memberships } = await supabase
    .from("recipe_book_members")
    .select("book_id")
    .eq("user_id", user.id);

  const bookIds = (memberships ?? []).map((m: { book_id: number }) => m.book_id);

  let recipeIds: number[] = [];

  if (bookIds.length > 0) {
    // Get recipe IDs from the junction table for all user's books
    const { data: bookRecipes } = await supabase
      .from("book_recipes")
      .select("recipe_id")
      .in("book_id", bookIds);

    recipeIds = (bookRecipes ?? []).map((r: { recipe_id: number }) => r.recipe_id);

    // Also include legacy recipes uploaded by this user (before junction table)
    const { data: legacyRecipes } = await supabase
      .from("recipes")
      .select("id")
      .eq("user_id", user.id)
      .not("id", "in", recipeIds.length > 0 ? `(${recipeIds.join(",")})` : "(0)");

    const legacyIds = (legacyRecipes ?? []).map((r: { id: number }) => r.id);
    recipeIds = [...new Set([...recipeIds, ...legacyIds])];
  }

  if (recipeIds.length === 0) {
    return jsonResponse([]);
  }

  const { data, error } = await supabase
    .from("recipes")
    .select("url_hash, title, source_url, saved_at, data")
    .in("id", recipeIds)
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
