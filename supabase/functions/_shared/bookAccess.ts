import type { SupabaseClient } from "npm:@supabase/supabase-js";

export type RecipeRow = {
  id: number;
  url_hash: string;
  title: string;
  source_url: string;
  image_url: string | null;
  data: Record<string, unknown>;
  forked_from_recipe_id: number | null;
  forked_from_book_id: number | null;
};

export type ForkSourceMeta = {
  bookId: number;
  bookName: string;
  recipeHash: string;
  recipeTitle: string;
};

export async function getUserOwnedBook(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ id: number; name: string } | null> {
  const { data } = await supabase
    .from("recipe_book_members")
    .select("book_id, recipe_books(id, name, created_at)")
    .eq("user_id", userId)
    .eq("role", "owner");

  type Row = { book_id: number; recipe_books: { id: number; name: string; created_at: string } | null };
  const owned = ((data ?? []) as Row[])
    .map((row) => row.recipe_books)
    .filter((book): book is { id: number; name: string; created_at: string } => !!book)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  return owned[0] ?? null;
}

export async function canReadBook(
  supabase: SupabaseClient,
  userId: string,
  bookId: number,
): Promise<boolean> {
  const { data: membership } = await supabase
    .from("recipe_book_members")
    .select("book_id")
    .eq("book_id", bookId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membership) return true;

  const { data: book } = await supabase
    .from("recipe_books")
    .select("visibility")
    .eq("id", bookId)
    .maybeSingle();

  return book?.visibility === "public";
}

export async function getRecipeBookIds(
  supabase: SupabaseClient,
  recipeId: number,
): Promise<number[]> {
  const { data: links } = await supabase
    .from("book_recipes")
    .select("book_id")
    .eq("recipe_id", recipeId);

  return (links ?? []).map((row: { book_id: number }) => row.book_id);
}

export async function verifyRecipeReadAccess(
  supabase: SupabaseClient,
  userId: string,
  hash: string,
): Promise<
  | { ok: true; recipeRow: RecipeRow }
  | { ok: false; error: string; status: number }
> {
  const { data: recipeRow } = await supabase
    .from("recipes")
    .select("id, url_hash, title, source_url, image_url, data, forked_from_recipe_id, forked_from_book_id")
    .eq("url_hash", hash)
    .maybeSingle();

  if (!recipeRow) return { ok: false, error: "Recipe not found", status: 404 };

  const bookIds = await getRecipeBookIds(supabase, recipeRow.id);
  if (bookIds.length === 0) {
    return { ok: false, error: "Access denied", status: 403 };
  }

  const { data: memberships } = await supabase
    .from("recipe_book_members")
    .select("book_id")
    .eq("user_id", userId)
    .in("book_id", bookIds);

  if ((memberships ?? []).length > 0) {
    return { ok: true, recipeRow: recipeRow as RecipeRow };
  }

  const { count } = await supabase
    .from("recipe_books")
    .select("*", { count: "exact", head: true })
    .in("id", bookIds)
    .eq("visibility", "public");

  if (!count) return { ok: false, error: "Access denied", status: 403 };

  return { ok: true, recipeRow: recipeRow as RecipeRow };
}

export async function verifyRecipeWriteAccess(
  supabase: SupabaseClient,
  userId: string,
  hash: string,
): Promise<
  | { ok: true; recipeRow: RecipeRow }
  | { ok: false; error: string; status: number }
> {
  const read = await verifyRecipeReadAccess(supabase, userId, hash);
  if (!read.ok) return read;

  const bookIds = await getRecipeBookIds(supabase, read.recipeRow.id);
  const { count } = await supabase
    .from("recipe_book_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("book_id", bookIds);

  if (!count) {
    return { ok: false, error: "Access denied", status: 403 };
  }

  return read;
}

export async function loadForkSourceMeta(
  supabase: SupabaseClient,
  recipeRow: Pick<RecipeRow, "forked_from_recipe_id" | "forked_from_book_id">,
): Promise<ForkSourceMeta | null> {
  if (!recipeRow.forked_from_recipe_id || !recipeRow.forked_from_book_id) return null;

  const [{ data: sourceRecipe }, { data: sourceBook }] = await Promise.all([
    supabase
      .from("recipes")
      .select("url_hash, title")
      .eq("id", recipeRow.forked_from_recipe_id)
      .maybeSingle(),
    supabase
      .from("recipe_books")
      .select("id, name")
      .eq("id", recipeRow.forked_from_book_id)
      .maybeSingle(),
  ]);

  if (!sourceRecipe || !sourceBook) return null;

  return {
    bookId: sourceBook.id as number,
    bookName: sourceBook.name as string,
    recipeHash: sourceRecipe.url_hash as string,
    recipeTitle: sourceRecipe.title as string,
  };
}

export function recipeResponse(
  recipeRow: RecipeRow,
  forkedFrom: ForkSourceMeta | null,
): Record<string, unknown> {
  const data = recipeRow.data ?? {};
  const withImage = recipeRow.image_url
    ? { ...data, imageUrl: recipeRow.image_url }
    : { ...data };
  return forkedFrom ? { ...withImage, forkedFrom } : withImage;
}
