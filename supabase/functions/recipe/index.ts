/**
 * recipe function
 *
 * GET  /recipe?file=hash.json        → fetch recipe by hash
 * PUT  /recipe?file=hash.json        → save edited recipe data
 * POST /recipe?fork=1&file=…&book_id → fork into caller's owned book
 * POST /recipe/image?hash=X          → upload/replace hero image
 * DELETE /recipe/image?hash=X        → remove hero image override
 */
import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import {
  canReadBook,
  getRecipeBookIds,
  getUserOwnedBook,
  loadForkSourceMeta,
  recipeResponse,
  verifyRecipeReadAccess,
  verifyRecipeWriteAccess,
} from "../_shared/bookAccess.ts";
import { syncRecipeIngredients } from "../_shared/syncRecipeIngredients.ts";
import type { Recipe } from "../_shared/recipe.ts";

function stripUserNotes(data: Record<string, unknown>): Record<string, unknown> {
  const steps = data.steps;
  if (!Array.isArray(steps)) return data;
  return {
    ...data,
    steps: steps.map((step) => {
      if (!step || typeof step !== "object") return step;
      return { ...(step as Record<string, unknown>), userNote: null };
    }),
  };
}

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
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const urlObj = new URL(req.url);
  const pathParts = urlObj.pathname.split("/").filter(Boolean);
  const action = pathParts[pathParts.length - 1];

  // ── POST /recipe?fork=1&file=hash.json&book_id=X ───────────────────────────
  if (req.method === "POST" && urlObj.searchParams.get("fork") === "1") {
    const file = urlObj.searchParams.get("file");
    const sourceBookIdParam = urlObj.searchParams.get("book_id");
    if (!file || !sourceBookIdParam) {
      return jsonResponse({ error: "file and book_id required" }, 400);
    }

    const sourceBookId = Number(sourceBookIdParam);
    if (!Number.isFinite(sourceBookId)) {
      return jsonResponse({ error: "Invalid book_id" }, 400);
    }

    const hash = file.replace(/\.json$/, "");
    const access = await verifyRecipeReadAccess(supabase, user.id, hash);
    if (!access.ok) return jsonResponse({ error: access.error }, access.status);

    const { data: sourceBook } = await supabase
      .from("recipe_books")
      .select("id, name, visibility, owner_id")
      .eq("id", sourceBookId)
      .maybeSingle();

    if (!sourceBook) return jsonResponse({ error: "Book not found" }, 404);
    if (sourceBook.visibility !== "public") {
      return jsonResponse({ error: "Only recipes in public books can be forked" }, 403);
    }

    const sourceBookIds = await getRecipeBookIds(supabase, access.recipeRow.id);
    if (!sourceBookIds.includes(sourceBookId)) {
      return jsonResponse({ error: "Recipe is not in that book" }, 400);
    }

    const ownedBook = await getUserOwnedBook(supabase, user.id);
    if (!ownedBook) {
      return jsonResponse({ error: "You need your own recipe book to fork into" }, 400);
    }

    if (sourceBook.owner_id === user.id && sourceBookId === ownedBook.id) {
      return jsonResponse({ error: "This recipe is already in your book" }, 400);
    }

    const { data: existingForks } = await supabase
      .from("recipes")
      .select("id, url_hash")
      .eq("forked_from_recipe_id", access.recipeRow.id)
      .eq("user_id", user.id);

    if (existingForks?.length) {
      for (const fork of existingForks) {
        const forkBookIds = await getRecipeBookIds(supabase, fork.id);
        if (forkBookIds.includes(ownedBook.id)) {
          const forkMeta = await loadForkSourceMeta(supabase, {
            forked_from_recipe_id: access.recipeRow.id,
            forked_from_book_id: sourceBookId,
          });
          const { data: forkRow } = await supabase
            .from("recipes")
            .select("id, url_hash, title, source_url, image_url, data, forked_from_recipe_id, forked_from_book_id")
            .eq("id", fork.id)
            .single();
          if (forkRow) {
            return jsonResponse({
              hash: fork.url_hash,
              alreadyForked: true,
              ownedBookId: ownedBook.id,
              ...recipeResponse(forkRow, forkMeta),
            });
          }
        }
      }
    }

    const forkHash = `fork_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const copiedData = stripUserNotes({ ...access.recipeRow.data });
    const forkTitle = typeof copiedData.title === "string"
      ? copiedData.title
      : access.recipeRow.title;

    const { data: inserted, error: insertErr } = await supabase
      .from("recipes")
      .insert({
        url_hash: forkHash,
        source_url: access.recipeRow.source_url,
        title: forkTitle,
        data: copiedData,
        image_url: access.recipeRow.image_url,
        user_id: user.id,
        forked_from_recipe_id: access.recipeRow.id,
        forked_from_book_id: sourceBookId,
      })
      .select("id, url_hash, title, source_url, image_url, data, forked_from_recipe_id, forked_from_book_id")
      .single();

    if (insertErr || !inserted) {
      return jsonResponse({ error: insertErr?.message ?? "Failed to fork recipe" }, 500);
    }

    await supabase
      .from("book_recipes")
      .upsert({ book_id: ownedBook.id, recipe_id: inserted.id }, { onConflict: "book_id,recipe_id" });

    await syncRecipeIngredients(copiedData as Recipe, inserted.id, supabase);

    const forkMeta = await loadForkSourceMeta(supabase, inserted);

    return jsonResponse({
      hash: forkHash,
      alreadyForked: false,
      ownedBookId: ownedBook.id,
      ...recipeResponse(inserted, forkMeta),
    }, 201);
  }

  // ── POST|DELETE /recipe/image?hash=X ─────────────────────────────────────
  if ((req.method === "POST" || req.method === "DELETE") && action === "image") {
    const hash = urlObj.searchParams.get("hash");
    if (!hash) return jsonResponse({ error: "hash required" }, 400);

    const access = await verifyRecipeWriteAccess(supabase, user.id, hash);
    if (!access.ok) return jsonResponse({ error: access.error }, access.status);
    const recipeRow = access.recipeRow;

    if (req.method === "DELETE") {
      if (recipeRow.image_url) {
        const match = recipeRow.image_url.match(/recipe-images\/(.+)$/);
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
      const match = recipeRow.image_url.match(/recipe-images\/(.+)$/);
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

  // ── PUT /recipe?file=hash.json ─────────────────────────────────────────────
  if (req.method === "PUT") {
    const file = urlObj.searchParams.get("file");
    if (!file) return jsonResponse({ error: "file required" }, 400);

    const hash = file.replace(/\.json$/, "");
    const access = await verifyRecipeWriteAccess(supabase, user.id, hash);
    if (!access.ok) return jsonResponse({ error: access.error }, access.status);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    if (typeof body.title !== "string" || !body.title.trim()) {
      return jsonResponse({ error: "title is required" }, 400);
    }
    if (!Array.isArray(body.ingredientGroups) || !Array.isArray(body.steps)) {
      return jsonResponse({ error: "ingredientGroups and steps are required" }, 400);
    }

    const existing = access.recipeRow.data;
    const { imageUrl: _drop, forkedFrom: _fork, ...rest } = body;
    const merged: Record<string, unknown> = {
      ...existing,
      ...rest,
      title: body.title.trim(),
      sourceUrl: body.sourceUrl ?? existing.sourceUrl,
    };

    const { error: updateErr } = await supabase
      .from("recipes")
      .update({
        title: merged.title as string,
        data: merged,
      })
      .eq("id", access.recipeRow.id);

    if (updateErr) return jsonResponse({ error: updateErr.message }, 500);

    const forkMeta = await loadForkSourceMeta(supabase, access.recipeRow);
    return jsonResponse(recipeResponse(access.recipeRow, forkMeta));
  }

  // ── GET /recipe?file=hash.json ────────────────────────────────────────────
  const file = urlObj.searchParams.get("file");

  if (file) {
    const hash = file.replace(/\.json$/, "");
    const access = await verifyRecipeReadAccess(supabase, user.id, hash);
    if (!access.ok) return jsonResponse({ error: access.error }, access.status);
    const forkMeta = await loadForkSourceMeta(supabase, access.recipeRow);
    return jsonResponse(recipeResponse(access.recipeRow, forkMeta));
  }

  const { data, error } = await supabase
    .from("recipes")
    .select("id, url_hash, title, source_url, image_url, data, forked_from_recipe_id, forked_from_book_id")
    .order("saved_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return jsonResponse({ error: "No recipes cached yet. Scrape a URL first." }, 404);
  }

  const access = await verifyRecipeReadAccess(supabase, user.id, data.url_hash);
  if (!access.ok) return jsonResponse({ error: access.error }, access.status);
  const forkMeta = await loadForkSourceMeta(supabase, access.recipeRow);
  return jsonResponse(recipeResponse(access.recipeRow, forkMeta));
});
