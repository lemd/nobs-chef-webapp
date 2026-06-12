/**
 * book function — manage recipe books
 *
 * GET  /book                      → list all books the caller belongs to
 * GET  /book/members?book_id=X    → list members of a book with user metadata
 * POST /book                      → create a new book (caller becomes owner + member)
 * POST /book/leave?book_id=X      → leave a book (not allowed if owner)
 * POST /book/drawing?book_id=X    → upload/replace transparent PNG drawing overlay (owner only)
 * DELETE /book/drawing?book_id=X  → remove drawing overlay (owner only)
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

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const action = pathParts.pop(); // last segment: "book" | "members" | "leave"

  // ── GET /book/members?book_id=X ───────────────────────────────────────────
  if (req.method === "GET" && action === "members") {
    const bookId = url.searchParams.get("book_id");
    if (!bookId) return jsonResponse({ error: "book_id required" }, 400);

    const { data: membership } = await supabase
      .from("recipe_book_members")
      .select("role")
      .eq("book_id", bookId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) return jsonResponse({ error: "Not a member" }, 403);

    const { data: members, error } = await supabase
      .from("recipe_book_members")
      .select("user_id, role, joined_at")
      .eq("book_id", bookId);

    if (error) return jsonResponse({ error: error.message }, 500);

    const membersWithMeta = await Promise.all(
      (members ?? []).map(async (m: { user_id: string; role: string; joined_at: string }) => {
        const { data: { user: u } } = await supabase.auth.admin.getUserById(m.user_id);
        return {
          userId: m.user_id,
          role: m.role,
          joinedAt: m.joined_at,
          email: u?.email ?? null,
          name: u?.user_metadata?.full_name ?? u?.email ?? null,
          avatarUrl: u?.user_metadata?.avatar_url ?? null,
        };
      })
    );

    return jsonResponse(membersWithMeta);
  }

  // ── GET /book: list books ─────────────────────────────────────────────────
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("recipe_book_members")
      .select("role, joined_at, recipe_books(id, name, owner_id, created_at, drawing_url, banner_url)")
      .eq("user_id", user.id);

    if (error) return jsonResponse({ error: error.message }, 500);

    const books = (data ?? []).map((row: Record<string, unknown>) => ({
      ...(row.recipe_books as Record<string, unknown>),
      role: row.role,
      joinedAt: row.joined_at,
    }));

    return jsonResponse(books);
  }

  // ── POST /book/leave?book_id=X ────────────────────────────────────────────
  if (req.method === "POST" && action === "leave") {
    const bookId = url.searchParams.get("book_id");
    if (!bookId) return jsonResponse({ error: "book_id required" }, 400);

    const { data: book } = await supabase
      .from("recipe_books")
      .select("owner_id")
      .eq("id", bookId)
      .maybeSingle();

    if (!book) return jsonResponse({ error: "Book not found" }, 404);

    const isOwner = book.owner_id === user.id;

    if (isOwner) {
      // Count remaining members
      const { count } = await supabase
        .from("recipe_book_members")
        .select("*", { count: "exact", head: true })
        .eq("book_id", bookId);

      if ((count ?? 0) > 1) {
        return jsonResponse(
          { error: "You cannot leave a book you own while others are members. Transfer ownership first." },
          403
        );
      }

      // Owner is the only member — delete the book (cascades members + book_recipes)
      const { error: deleteErr } = await supabase
        .from("recipe_books")
        .delete()
        .eq("id", bookId);

      if (deleteErr) return jsonResponse({ error: deleteErr.message }, 500);
      return jsonResponse({ ok: true, deleted: true });
    }

    // Non-owner: just remove membership
    const { error } = await supabase
      .from("recipe_book_members")
      .delete()
      .eq("book_id", bookId)
      .eq("user_id", user.id);

    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ ok: true, deleted: false });
  }

  // ── POST /book/banner?book_id=X — upload/replace banner image (owner only) ──
  if ((req.method === "POST" || req.method === "DELETE") && action === "banner") {
    const bookId = url.searchParams.get("book_id");
    if (!bookId) return jsonResponse({ error: "book_id required" }, 400);

    const { data: book } = await supabase
      .from("recipe_books")
      .select("owner_id, banner_url")
      .eq("id", bookId)
      .maybeSingle();

    if (!book) return jsonResponse({ error: "Book not found" }, 404);
    if (book.owner_id !== user.id) return jsonResponse({ error: "Only the book owner can change the banner" }, 403);

    if (req.method === "DELETE") {
      if (book.banner_url) {
        const match = (book.banner_url as string).match(/book-banners\/(.+)$/);
        if (match) await supabase.storage.from("book-banners").remove([match[1]]);
      }
      await supabase.from("recipe_books").update({ banner_url: null }).eq("id", bookId);
      return jsonResponse({ ok: true, banner_url: null });
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return jsonResponse({ error: "Content-Type must be an image type" }, 400);
    }
    const ext = contentType.includes("webp") ? "webp" : contentType.includes("png") ? "png" : "jpg";

    const arrayBuffer = await req.arrayBuffer();
    if (arrayBuffer.byteLength > 5 * 1024 * 1024) {
      return jsonResponse({ error: "Banner image exceeds 5 MB limit" }, 413);
    }

    // Remove old banner
    if (book.banner_url) {
      const match = (book.banner_url as string).match(/book-banners\/(.+)$/);
      if (match) await supabase.storage.from("book-banners").remove([match[1]]);
    }

    const storagePath = `${bookId}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("book-banners")
      .upload(storagePath, new Uint8Array(arrayBuffer), { contentType, upsert: false });

    if (uploadErr) return jsonResponse({ error: uploadErr.message }, 500);

    const { data: publicData } = supabase.storage.from("book-banners").getPublicUrl(storagePath);
    const bannerUrl = publicData.publicUrl;

    const { error: updateErr } = await supabase
      .from("recipe_books")
      .update({ banner_url: bannerUrl })
      .eq("id", bookId);

    if (updateErr) return jsonResponse({ error: updateErr.message }, 500);
    return jsonResponse({ ok: true, banner_url: bannerUrl });
  }

  // ── POST /book/drawing?book_id=X — upload PNG overlay (owner only) ─────────
  if ((req.method === "POST" || req.method === "DELETE") && action === "drawing") {
    const bookId = url.searchParams.get("book_id");
    if (!bookId) return jsonResponse({ error: "book_id required" }, 400);

    const { data: book } = await supabase
      .from("recipe_books")
      .select("owner_id, drawing_url")
      .eq("id", bookId)
      .maybeSingle();

    if (!book) return jsonResponse({ error: "Book not found" }, 404);
    if (book.owner_id !== user.id) return jsonResponse({ error: "Only the book owner can edit the drawing" }, 403);

    // DELETE — clear drawing
    if (req.method === "DELETE") {
      if (book.drawing_url) {
        // Extract storage path from the URL: ...storage/v1/object/public/book-drawings/<path>
        const match = (book.drawing_url as string).match(/book-drawings\/(.+)$/);
        if (match) await supabase.storage.from("book-drawings").remove([match[1]]);
      }
      const { error: clearErr } = await supabase
        .from("recipe_books")
        .update({ drawing_url: null })
        .eq("id", bookId);
      if (clearErr) return jsonResponse({ error: clearErr.message }, 500);
      return jsonResponse({ ok: true, drawing_url: null });
    }

    // POST — upload new PNG
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("image/png")) {
      return jsonResponse({ error: "Content-Type must be image/png" }, 400);
    }

    const arrayBuffer = await req.arrayBuffer();
    if (arrayBuffer.byteLength > 2 * 1024 * 1024) {
      return jsonResponse({ error: "Drawing exceeds 2 MB limit" }, 413);
    }

    const storagePath = `${bookId}/${Date.now()}.png`;

    // Remove old drawing if present
    if (book.drawing_url) {
      const match = (book.drawing_url as string).match(/book-drawings\/(.+)$/);
      if (match) await supabase.storage.from("book-drawings").remove([match[1]]);
    }

    const { error: uploadErr } = await supabase.storage
      .from("book-drawings")
      .upload(storagePath, new Uint8Array(arrayBuffer), {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadErr) return jsonResponse({ error: uploadErr.message }, 500);

    const { data: publicData } = supabase.storage
      .from("book-drawings")
      .getPublicUrl(storagePath);

    const drawingUrl = publicData.publicUrl;

    const { error: updateErr } = await supabase
      .from("recipe_books")
      .update({ drawing_url: drawingUrl })
      .eq("id", bookId);

    if (updateErr) return jsonResponse({ error: updateErr.message }, 500);

    return jsonResponse({ ok: true, drawing_url: drawingUrl });
  }

  // ── POST /book: create book ───────────────────────────────────────────────
  if (req.method === "POST") {
    const { name } = (await req.json()) as { name?: string };
    if (!name?.trim()) {
      return jsonResponse({ error: "name is required" }, 400);
    }

    const { data: book, error: bookErr } = await supabase
      .from("recipe_books")
      .insert({ name: name.trim(), owner_id: user.id })
      .select("id, name, owner_id, created_at")
      .single();

    if (bookErr || !book) {
      return jsonResponse({ error: bookErr?.message ?? "Failed to create book" }, 500);
    }

    const { error: memberErr } = await supabase
      .from("recipe_book_members")
      .insert({ book_id: book.id, user_id: user.id, role: "owner" });

    if (memberErr) return jsonResponse({ error: memberErr.message }, 500);

    return jsonResponse({ ...book, role: "owner" }, 201);
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
});
