import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { canReadBook, loadForkSourceMeta } from "../_shared/bookAccess.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const url = new URL(req.url);
  const bookIdParam = url.searchParams.get("book_id");
  if (!bookIdParam) {
    return jsonResponse({ error: "book_id required" }, 400);
  }

  const bookId = Number(bookIdParam);
  if (!Number.isFinite(bookId)) {
    return jsonResponse({ error: "Invalid book_id" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const allowed = await canReadBook(supabase, user.id, bookId);
  if (!allowed) {
    return jsonResponse({ error: "Not allowed to view this book" }, 403);
  }

  const { data: bookRecipes } = await supabase
    .from("book_recipes")
    .select("recipe_id")
    .eq("book_id", bookId);

  let recipeIds = (bookRecipes ?? []).map((r: { recipe_id: number }) => r.recipe_id);

  const { data: membership } = await supabase
    .from("recipe_book_members")
    .select("book_id")
    .eq("book_id", bookId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership) {
    const { data: userBooks } = await supabase
      .from("recipe_book_members")
      .select("book_id, recipe_books(created_at)")
      .eq("user_id", user.id);

    type BookRow = { book_id: number; recipe_books: { created_at: string } | null };
    const primaryBookId = (userBooks as BookRow[] | null ?? [])
      .slice()
      .sort(
        (a, b) =>
          (a.recipe_books?.created_at ?? "").localeCompare(b.recipe_books?.created_at ?? ""),
      )[0]?.book_id;

    if (bookId === primaryBookId) {
      const { data: allLinked } = await supabase.from("book_recipes").select("recipe_id");
      const linkedIds = new Set((allLinked ?? []).map((r: { recipe_id: number }) => r.recipe_id));

      const { data: legacyRecipes } = await supabase
        .from("recipes")
        .select("id")
        .eq("user_id", user.id);

      const legacyIds = (legacyRecipes ?? [])
        .map((r: { id: number }) => r.id)
        .filter((id: number) => !linkedIds.has(id));

      recipeIds = [...new Set([...recipeIds, ...legacyIds])];
    }
  }

  if (recipeIds.length === 0) {
    return jsonResponse([]);
  }

  const { data, error } = await supabase
    .from("recipes")
    .select("url_hash, title, source_url, saved_at, data, forked_from_recipe_id, forked_from_book_id")
    .in("id", recipeIds)
    .order("saved_at", { ascending: false });

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  type RecipeData = {
    tags?: unknown;
    ingredientGroups?: Array<{ items: Array<{ name: string }> }>;
  };

  const files = await Promise.all((data ?? []).map(async (r) => {
    const d = r.data as RecipeData;
    const ingredientNames = (d.ingredientGroups ?? [])
      .flatMap((g) => g.items.map((i) => i.name.toLowerCase()))
      .join(" ");
    const forkedFrom = await loadForkSourceMeta(supabase, {
      forked_from_recipe_id: r.forked_from_recipe_id,
      forked_from_book_id: r.forked_from_book_id,
    });
    return {
      filename: `${r.url_hash}.json`,
      title: r.title,
      sourceUrl: r.source_url,
      savedAt: r.saved_at,
      tags: d.tags ?? null,
      ingredientNames,
      forkedFrom,
    };
  }));

  return jsonResponse(files);
});
