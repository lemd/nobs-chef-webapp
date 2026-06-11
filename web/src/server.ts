import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { scrapeRecipePage } from "../../src/scraper/scrapeUrl.js";
import { parseRecipeWithClaude } from "../../src/services/openRouterClient.js";
import { hasCached, readCache, writeCache, listCached } from "../../src/lib/cache.js";

const app = express();
const PORT = process.env.PORT ?? 7010;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// ── GET /api/recipes ─────────────────────────────────────────────────────────
// Returns metadata for all cached recipes
app.get("/api/recipes", (_req, res) => {
  const files = listCached().map(({ filename, filePath, savedAt }) => {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as { title?: string };
      return { filename, title: data.title ?? filename, savedAt };
    } catch {
      return { filename, title: filename, savedAt };
    }
  });
  res.json(files);
});

// ── GET /api/recipe?file=filename.json ────────────────────────────────────────
// Returns a specific cached recipe by filename, or the most recent if omitted
app.get("/api/recipe", (req, res) => {
  const files = listCached();
  if (files.length === 0) {
    res.status(404).json({ error: "No recipes cached yet. Scrape a URL first." });
    return;
  }
  const target = req.query.file
    ? files.find((f) => f.filename === req.query.file)
    : files[0]; // most recent

  if (!target) {
    res.status(404).json({ error: "File not found." });
    return;
  }
  try {
    res.json(JSON.parse(fs.readFileSync(target.filePath, "utf-8")));
  } catch {
    res.status(500).json({ error: "Could not read cache file." });
  }
});

// ── POST /api/scrape ──────────────────────────────────────────────────────────
// Body: { "url": "https://..." }
// Returns cached result if URL was seen before, otherwise scrapes + parses
app.post("/api/scrape", async (req, res) => {
  const { url, force } = req.body as { url?: string; force?: boolean };

  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "Request body must include a 'url' string." });
    return;
  }

  // ── Cache hit ──────────────────────────────────────────────────────────────
  if (!force && hasCached(url)) {
    console.log(`[scrape] cache hit: ${url}`);
    res.json({ ...readCache(url) as object, _cached: true });
    return;
  }

  try {
    console.log(`[scrape] ${url}`);
    const rawContent = await scrapeRecipePage(url);
    console.log(`[scrape] extracted ${rawContent.length} chars`);

    const recipe = await parseRecipeWithClaude(rawContent);
    console.log(`[scrape] parsed: "${recipe.title}"`);

    const filePath = writeCache(url, recipe);
    console.log(`[scrape] saved: ${filePath}`);

    res.json(recipe);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[scrape] error:", message);
    res.status(500).json({ error: message });
  }
});

// ── SPA fallback: serve index.html for /r/:slug routes ───────────────────────
app.get("/r/:slug", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
  console.log(`\nNobs web server running → http://localhost:${PORT}\n`);
});
