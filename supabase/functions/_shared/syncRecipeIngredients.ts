import type { SupabaseClient } from "npm:@supabase/supabase-js";
import type { Recipe } from "./recipe.ts";
import { matchIngredient, retryUnmatched } from "./ingredientMatcher.ts";

export async function syncRecipeIngredients(
  recipe: Recipe,
  recipeId: number,
  supabase: SupabaseClient,
): Promise<void> {
  const rows: {
    recipe_id: number;
    raw_name: string;
    quantity: string | null;
    unit: string | null;
    notes: string | null;
    group_name: string | null;
    position: number;
    ingredient_id: number | null;
    match_score: number;
  }[] = [];

  let position = 0;
  for (const group of recipe.ingredientGroups) {
    for (const item of group.items) {
      const result = await matchIngredient(item.name, supabase);
      rows.push({
        recipe_id: recipeId,
        raw_name: item.name,
        quantity: item.quantity ?? null,
        unit: item.unit ?? null,
        notes: item.notes ?? null,
        group_name: group.group ?? null,
        position,
        ingredient_id: result.ingredient_id,
        match_score: result.match_score,
      });
      position++;
    }
  }

  if (rows.length > 0) {
    await supabase
      .from("recipe_ingredients")
      .upsert(rows, { onConflict: "recipe_id,position" });
  }

  await retryUnmatched(recipeId, supabase);
}
