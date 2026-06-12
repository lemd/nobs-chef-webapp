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

  let query = supabase
    .from("recipes")
    .select("url_hash, title, source_url, saved_at, data");

  if (bookIds.length > 0) {
    // Recipes in user's books, OR recipes uploaded by this user
    query = query.or(`book_id.in.(${bookIds.join(",")}),user_id.eq.${user.id}`);
  } else {
    // No books yet — just show recipes uploaded by this user
    query = query.eq("user_id", user.id);
  }

  const { data, error } = await query.order("saved_at", { ascending: false });

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
