/**
 * invite function — create and accept book invite links
 *
 * POST /invite/create  { book_id }         → returns { token, url }
 * POST /invite/accept  { token }           → adds caller as member, returns book
 * GET  /invite/info?token=...              → returns book info (no auth needed)
 */
import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getUserFromRequest } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const action = url.pathname.split("/").pop(); // "create" | "accept" | "info"

  // ── GET /invite/info?token= ───────────────────────────────────────────────
  if (req.method === "GET" && action === "info") {
    const token = url.searchParams.get("token");
    if (!token) return jsonResponse({ error: "token required" }, 400);

    const { data: invite, error } = await supabase
      .from("recipe_invites")
      .select("id, book_id, expires_at, accepted_at, recipe_books(name)")
      .eq("token", token)
      .maybeSingle();

    if (error || !invite) return jsonResponse({ error: "Invalid invite" }, 404);
    if (invite.accepted_at) return jsonResponse({ error: "Invite already used" }, 410);
    if (new Date(invite.expires_at) < new Date()) return jsonResponse({ error: "Invite expired" }, 410);

    return jsonResponse({
      bookId: invite.book_id,
      bookName: (invite.recipe_books as Record<string, unknown>)?.name,
      expiresAt: invite.expires_at,
    });
  }

  // All other actions require auth
  const user = await getUserFromRequest(req);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  // ── POST /invite/create ───────────────────────────────────────────────────
  if (req.method === "POST" && action === "create") {
    const { book_id } = (await req.json()) as { book_id?: number };
    if (!book_id) return jsonResponse({ error: "book_id required" }, 400);

    // Verify caller owns the book
    const { data: book } = await supabase
      .from("recipe_books")
      .select("id, name")
      .eq("id", book_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!book) return jsonResponse({ error: "Book not found or not owner" }, 403);

    const { data: invite, error } = await supabase
      .from("recipe_invites")
      .insert({ book_id, created_by: user.id })
      .select("token")
      .single();

    if (error || !invite) return jsonResponse({ error: error?.message ?? "Failed" }, 500);

    const siteUrl = Deno.env.get("SITE_URL") ?? "https://nobs-chef-webapp.vercel.app";
    return jsonResponse({
      token: invite.token,
      url: `${siteUrl}/join?token=${invite.token}`,
    });
  }

  // ── POST /invite/accept ───────────────────────────────────────────────────
  if (req.method === "POST" && action === "accept") {
    const { token } = (await req.json()) as { token?: string };
    if (!token) return jsonResponse({ error: "token required" }, 400);

    const { data: invite, error: invErr } = await supabase
      .from("recipe_invites")
      .select("id, book_id, expires_at, accepted_at, email")
      .eq("token", token)
      .maybeSingle();

    if (invErr || !invite) return jsonResponse({ error: "Invalid invite" }, 404);
    if (invite.accepted_at) return jsonResponse({ error: "Invite already used" }, 410);
    if (new Date(invite.expires_at) < new Date()) return jsonResponse({ error: "Invite expired" }, 410);
    if (invite.email && invite.email !== user.email) {
      return jsonResponse({ error: "Invite is for a different email" }, 403);
    }

    // Check not already a member
    const { data: existing } = await supabase
      .from("recipe_book_members")
      .select("user_id")
      .eq("book_id", invite.book_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) {
      await supabase
        .from("recipe_book_members")
        .insert({ book_id: invite.book_id, user_id: user.id, role: "member" });
    }

    // Mark invite accepted
    await supabase
      .from("recipe_invites")
      .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
      .eq("id", invite.id);

    const { data: book } = await supabase
      .from("recipe_books")
      .select("id, name, owner_id")
      .eq("id", invite.book_id)
      .single();

    return jsonResponse({ book, role: "member" });
  }

  return jsonResponse({ error: "Not found" }, 404);
});
