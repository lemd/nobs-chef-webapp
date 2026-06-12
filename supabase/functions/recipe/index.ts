/**
 * recipe function
 *
 * GET  /recipe?file=hash.json   → fetch recipe by hash (merges image_url override)
 * POST /recipe/image?hash=X     → upload/replace hero image (any member of a containing book)
 * DELETE /recipe/image?hash=X   → remove hero image override
 */
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

  const urlObj = new URL(req.url);
  const pathParts = urlObj.pathname.split("/").filter(Boolean);
  const action = pathParts[pathParts.length - 1]; // "recipe" | "image"

  // ── POST|DELETE /recipe/image?hash=X ─────────────────────────────────────
  if ((req.method === "POST" || req.method === "DELETE") && action === "image") {
    const hash = urlObj.searchParams.get("hash");
    if (!hash) return jsonResponse({ error: "hash required" }, 400);

    const { data: recipeRow } = await supabase
      .from("recipes")
      .select("id, image_url")
      .eq("url_hash", hash)
      .maybeSingle();

    if (!recipeRow) return jsonResponse({ error: "Recipe not found" }, 404);

    // Verify user is a member of at least one book containing this recipe
    const { data: memberships } = await supabase
      .from("recipe_book_members")
      .select("book_id")
      .eq("user_id", user.id);

    const bookIds = (memberships ?? []).map((m: { book_id: number }) => m.book_id);
    if (bookIds.length === 0) return jsonResponse({ error: "Access denied" }, 403);

    const { count } = await supabase
      .from("book_recipes")
      .select("*", { count: "exact", head: true })
      .eq("recipe_id", recipeRow.id)
      .in("book_id", bookIds);

    if (!count) return jsonResponse({ error: "Access denied" }, 403);

    if (req.method === "DELETE") {
      if (recipeRow.image_url) {
        const match = (recipeRow.image_url as string).match(/recipe-images\/(.+)$/);
        if (match) await supabase.storage.from("recipe-images").remove([match[1]]);
      }
      await supabase.from("recipes").update({ image_url: null }).eq("id", recipeRow.id);
      return jsonResponse({ ok: true, image_url: null });
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return jsonResponse({ error: "Content-Type must be an image type" }, 400);
    }
    const ext = contentType.includes("webp") ? "webp" : contentType.includes("png") ? "png" : "jpg";

    const arrayBuffer = await req.arrayBuffer();
    if (arrayBuffer.byteLength > 5 * 1024 * 1024) {
      return jsonResponse({ error: "Image exceeds 5 MB limit" }, 413);
    }

    if (recipeRow.image_url) {
      const match = (recipeRow.image_url as string).match(/recipe-images\/(.+)$/);
      if (match) await supabase.storage.from("recipe-images").remove([match[1]]);
    }

    const storagePath = `${hash}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("recipe-images")
      .upload(storagePath, new Uint8Array(arrayBuffer), { contentType, upsert: false });

    if (uploadErr) return jsonResponse({ error: uploadErr.message }, 500);

    const { data: publicData } = supabase.storage.from("recipe-images").getPublicUrl(storagePath);
    const imageUrl = publicData.publicUrl;

    const { error: updateErr } = await supabase
      .from("recipes")
      .update({ image_url: imageUrl })
      .eq("id", recipeRow.id);

    if (updateErr) return jsonResponse({ error: updateErr.message }, 500);
    return jsonResponse({ ok: true, image_url: imageUrl });
  }

  // ── GET /recipe?file=hash.json ────────────────────────────────────────────
  const { searchParams } = urlObj;
  const file = searchParams.get("file");

  let query = supabase.from("recipes").select("data, image_url");

  if (file) {
    const hash = file.replace(/\.json$/, "");
    const { data, error } = await query.eq("url_hash", hash).maybeSingle();
    if (error || !data) {
      return jsonResponse({ error: "File not found." }, 404);
    }
    const row = data as { data: Record<string, unknown>; image_url: string | null };
    return jsonResponse(row.image_url ? { ...row.data, imageUrl: row.image_url } : row.data);
  }

  const { data, error } = await query
    .order("saved_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return jsonResponse({ error: "No recipes cached yet. Scrape a URL first." }, 404);
  }

  const row = data as { data: Record<string, unknown>; image_url: string | null };
  return jsonResponse(row.image_url ? { ...row.data, imageUrl: row.image_url } : row.data);
});
