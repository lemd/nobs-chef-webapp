/**
 * One-off script: add tags (mealType, dietary, season) to all existing recipes
 * that don't yet have them, by asking Claude for just the tags.
 *
 * Usage: npx tsx scripts/retag.ts
 * Requires OPENROUTER_API_KEY and SUPABASE_SERVICE_ROLE_KEY in .env
 */

import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = "https://vcsuynfbykvncenmhjfh.supabase.co";
const MODEL = "anthropic/claude-sonnet-4-5";

if (!OPENROUTER_API_KEY || !SERVICE_ROLE) {
  console.error("Missing OPENROUTER_API_KEY or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

interface RecipeRow {
  url_hash: string;
  title: string;
  data: {
    title?: string;
    description?: string;
    ingredientGroups?: Array<{ items: Array<{ name: string }> }>;
    tags?: unknown;
  };
}

async function getRecipes(): Promise<RecipeRow[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/recipes?select=url_hash,title,data`, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
    },
  });
  return res.json();
}

async function patchTags(hash: string, tags: unknown, updatedData: unknown) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/recipes?url_hash=eq.${hash}`,
    {
      method: "PATCH",
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ data: updatedData }),
    }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PATCH failed for ${hash}: ${txt}`);
  }
}

async function classifyTags(recipe: RecipeRow): Promise<unknown> {
  const ingredients = (recipe.data.ingredientGroups ?? [])
    .flatMap((g) => g.items.map((i) => i.name))
    .join(", ");

  const prompt = `Given the following recipe, return ONLY a JSON object with these fields:
- "mealType": a single lowercase string (e.g. "salad", "soup", "pasta", "roast", "steak", "chicken", "fish", "dessert", "breakfast", "side dish", "sauce", "sandwich", "snack")
- "dietary": array of applicable labels from ["vegetarian", "vegan", "pescatarian", "gluten-free", "dairy-free", "nut-free", "low-carb"]. Omit key if none apply.
- "season": array from ["spring", "summer", "autumn", "winter"] or ["all year"]. Pick based on ingredient availability and dish appeal.

Recipe title: ${recipe.title}
Description: ${recipe.data.description ?? ""}
Main ingredients: ${ingredients}

Respond with ONLY the JSON object, no markdown, no extra text.`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "X-Title": "Nobs retag",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    }),
  });

  const json = await res.json();
  const content = (json.choices?.[0]?.message?.content ?? "")
    .trim()
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "");
  return JSON.parse(content.trim());
}

async function main() {
  const recipes = await getRecipes();
  const toProcess = recipes.filter((r) => !r.data.tags);
  console.log(`${recipes.length} total recipes, ${toProcess.length} without tags`);

  for (const recipe of toProcess) {
    process.stdout.write(`  ${recipe.title} ... `);
    try {
      const tags = await classifyTags(recipe);
      const updatedData = { ...recipe.data, tags };
      await patchTags(recipe.url_hash, tags, updatedData);
      console.log(`done: ${JSON.stringify(tags)}`);
    } catch (err) {
      console.log(`ERROR: ${err}`);
    }
    // Small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\nAll done.");
}

main();
