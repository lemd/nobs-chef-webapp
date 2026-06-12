/**
 * book function — manage recipe books
 *
 * GET  /book           → list all books the caller belongs to
 * POST /book           → create a new book (caller becomes owner + member)
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

  // ── GET: list books ───────────────────────────────────────────────────────
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("recipe_book_members")
      .select("role, joined_at, recipe_books(id, name, owner_id, created_at)")
      .eq("user_id", user.id);

    if (error) return jsonResponse({ error: error.message }, 500);

    const books = (data ?? []).map((row: Record<string, unknown>) => ({
      ...(row.recipe_books as Record<string, unknown>),
      role: row.role,
      joinedAt: row.joined_at,
    }));

    return jsonResponse(books);
  }

  // ── POST: create book ─────────────────────────────────────────────────────
  if (req.method === "POST") {
    const { name } = (await req.json()) as { name?: string };
    if (!name?.trim()) {
      return jsonResponse({ error: "name is required" }, 400);
    }

    // Insert book
    const { data: book, error: bookErr } = await supabase
      .from("recipe_books")
      .insert({ name: name.trim(), owner_id: user.id })
      .select("id, name, owner_id, created_at")
      .single();

    if (bookErr || !book) {
      return jsonResponse({ error: bookErr?.message ?? "Failed to create book" }, 500);
    }

    // Add owner as member
    const { error: memberErr } = await supabase
      .from("recipe_book_members")
      .insert({ book_id: book.id, user_id: user.id, role: "owner" });

    if (memberErr) {
      return jsonResponse({ error: memberErr.message }, 500);
    }

    return jsonResponse({ ...book, role: "owner" }, 201);
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
});
