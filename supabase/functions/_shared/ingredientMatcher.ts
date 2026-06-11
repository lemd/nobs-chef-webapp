import { SupabaseClient } from "npm:@supabase/supabase-js";

export interface MatchResult {
  ingredient_id: number | null;
  match_score: number;
  canonical_name: string | null;
}

// ── USDA FoodData Central ─────────────────────────────────────────────────────

interface UsdaSearchResult {
  fdcId: number;
  description: string;
  foodCategory?: string;
  foodPortions?: UsdaFoodPortion[];
}

interface UsdaFoodPortion {
  portionDescription: string;
  gramWeight: number;
  amount: number;
}

const USDA_BASE = "https://api.nal.usda.gov/fdc/v1";
const USDA_DATA_TYPES = "SR%20Legacy,Foundation";

/** Word overlap ratio between two strings — simple, no deps */
function wordOverlap(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  let overlap = 0;
  for (const w of setA) if (setB.has(w)) overlap++;
  return overlap / Math.max(setA.size, setB.size);
}

/** Normalize a USDA description to Claude-style lowercase */
function normalizeUsdaName(raw: string): string {
  // USDA format: "VINEGAR, BALSAMIC" → "balsamic vinegar"
  // Split on comma, reverse, lowercase, trim
  return raw
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .reverse()
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map USDA portion descriptions to our conversion keys */
function extractConversions(
  portions: UsdaFoodPortion[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of portions) {
    const desc = p.portionDescription.toLowerCase();
    const grams = Math.round(p.gramWeight / (p.amount || 1));
    if (desc.includes("cup")) out["cup_g"] = grams;
    else if (desc.includes("tbsp") || desc.includes("tablespoon")) out["tbsp_g"] = grams;
    else if (desc.includes("tsp") || desc.includes("teaspoon")) out["tsp_g"] = grams;
    else if (desc.includes("each") || desc.includes("item") || desc.includes("whole") || desc.includes("medium") || desc.includes("large") || desc.includes("small")) out["each_g"] = grams;
    else if (desc.includes("slice") || desc.includes("piece")) out["piece_g"] = grams;
    else if (desc.includes("oz")) out["oz_g"] = Math.round(p.gramWeight);
  }
  return out;
}

async function usdaSearch(
  name: string,
  apiKey: string
): Promise<UsdaSearchResult | null> {
  const encoded = encodeURIComponent(name);
  const url = `${USDA_BASE}/foods/search?query=${encoded}&dataType=${USDA_DATA_TYPES}&pageSize=5&api_key=${apiKey}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    const json = await res.json() as { foods?: UsdaSearchResult[] };
    const foods = json.foods ?? [];
    if (foods.length === 0) return null;

    // Pick best match by word overlap
    let best: UsdaSearchResult | null = null;
    let bestScore = 0;
    for (const food of foods) {
      const normalized = normalizeUsdaName(food.description);
      const score = wordOverlap(name, normalized);
      if (score > bestScore) {
        bestScore = score;
        best = food;
      }
    }
    // Require at least 40% word overlap to accept
    return bestScore >= 0.4 ? best : null;
  } catch {
    return null;
  }
}

async function usdaDetail(
  fdcId: number,
  apiKey: string
): Promise<UsdaFoodPortion[]> {
  const url = `${USDA_BASE}/food/${fdcId}?api_key=${apiKey}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return [];
    const json = await res.json() as { foodPortions?: UsdaFoodPortion[] };
    return json.foodPortions ?? [];
  } catch {
    return [];
  }
}

// ── Main matcher ──────────────────────────────────────────────────────────────

export async function matchIngredient(
  rawName: string,
  supabase: SupabaseClient
): Promise<MatchResult> {
  const name = rawName.toLowerCase().trim();
  const usdaKey = Deno.env.get("USDA_API_KEY");

  // 1. Exact local match
  {
    const { data } = await supabase
      .from("ingredients")
      .select("id, name")
      .eq("name", name)
      .maybeSingle();
    if (data) {
      return { ingredient_id: data.id, match_score: 1.0, canonical_name: data.name };
    }
  }

  // 2. Alias local match
  {
    const { data } = await supabase
      .from("ingredients")
      .select("id, name")
      .contains("aliases", [name])
      .maybeSingle();
    if (data) {
      return { ingredient_id: data.id, match_score: 0.9, canonical_name: data.name };
    }
  }

  // 3. USDA lookup
  if (usdaKey) {
    const usdaResult = await usdaSearch(name, usdaKey);
    if (usdaResult) {
      const fdcId = usdaResult.fdcId;
      const usdaCanonical = normalizeUsdaName(usdaResult.description);
      const category = usdaResult.foodCategory?.toLowerCase() ?? null;

      // Check if this USDA ID already exists (deduplication via fdcId)
      const { data: existing } = await supabase
        .from("ingredients")
        .select("id, name, aliases")
        .eq("usda_fdc_id", fdcId)
        .maybeSingle();

      if (existing) {
        // Same USDA ingredient under a different name — add as alias
        if (existing.name !== name && !(existing.aliases as string[]).includes(name)) {
          await supabase
            .from("ingredients")
            .update({ aliases: [...(existing.aliases as string[]), name] })
            .eq("id", existing.id);
        }
        const score = wordOverlap(name, existing.name);
        return { ingredient_id: existing.id, match_score: score, canonical_name: existing.name };
      }

      // New ingredient — fetch portions and insert
      const portions = await usdaDetail(fdcId, usdaKey);
      const conversions = extractConversions(portions);

      // Aliases: include USDA canonical name if it differs from Claude's name
      const aliases = usdaCanonical !== name ? [usdaCanonical] : [];

      const { data: inserted } = await supabase
        .from("ingredients")
        .insert({
          name,
          aliases,
          usda_fdc_id: fdcId,
          category,
          conversions,
        })
        .select("id")
        .single();

      if (inserted) {
        const score = wordOverlap(name, usdaCanonical);
        return { ingredient_id: inserted.id, match_score: score, canonical_name: name };
      }
    }
  }

  // 4. No match — store as NULL, will retry on future scrapes
  return { ingredient_id: null, match_score: 0, canonical_name: null };
}

// ── Retry unmatched ingredients for a recipe ──────────────────────────────────

export async function retryUnmatched(
  recipeId: number,
  supabase: SupabaseClient
): Promise<void> {
  const { data: unmatched } = await supabase
    .from("recipe_ingredients")
    .select("id, raw_name")
    .eq("recipe_id", recipeId)
    .is("ingredient_id", null);

  if (!unmatched || unmatched.length === 0) return;

  for (const row of unmatched) {
    const result = await matchIngredient(row.raw_name, supabase);
    if (result.ingredient_id !== null) {
      await supabase
        .from("recipe_ingredients")
        .update({
          ingredient_id: result.ingredient_id,
          match_score: result.match_score,
        })
        .eq("id", row.id);
    }
  }
}
