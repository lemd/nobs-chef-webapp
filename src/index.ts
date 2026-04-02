import "dotenv/config";
import { scrapeRecipePage } from "./scraper/scrapeUrl.js";
import { parseRecipeWithClaude } from "./services/openRouterClient.js";
import { hasCached, readCache, writeCache, cachePathForUrl } from "./lib/cache.js";
import type { Recipe } from "./types/recipe.js";

async function run(url: string): Promise<Recipe> {
  console.log(`\nRedipe – Recipe Extractor`);
  console.log(`${"─".repeat(50)}`);
  console.log(`URL: ${url}\n`);

  // ── Cache hit? ──────────────────────────────────────────────────────────────
  if (hasCached(url)) {
    const cached = readCache(url) as Recipe;
    console.log(`✓ Cache hit – loading from ${cachePathForUrl(url)}\n`);
    return cached;
  }

  // ── Step 1: Scrape ──────────────────────────────────────────────────────────
  console.log("1/2  Scraping page...");
  const rawContent = await scrapeRecipePage(url);
  console.log(`     Extracted ${rawContent.length.toLocaleString()} characters\n`);

  // ── Step 2: Parse with Claude ───────────────────────────────────────────────
  console.log("2/2  Sending to Claude (OpenRouter) for structured extraction...");
  const recipe = await parseRecipeWithClaude(rawContent);
  console.log(`     Done – "${recipe.title}"\n`);

  return recipe;
}

// ── Entry point ───────────────────────────────────────────────────────────────
const url = process.argv[2];
if (!url) {
  console.error("Usage: npm start <url>");
  process.exit(1);
}

run(url)
  .then((recipe) => {
    const output = JSON.stringify(recipe, null, 2);

    // Print to stdout
    console.log("─".repeat(50));
    console.log("RESULT:\n");
    console.log(output);

    // Save to per-URL cache file
    const outPath = writeCache(url, recipe);
    console.log(`\n✓ Saved to ${outPath}`);
  })
  .catch((err) => {
    console.error("\n✗ Error:", (err as Error).message);
    process.exit(1);
  });
