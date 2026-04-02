import axios from "axios";
import * as cheerio from "cheerio";

/**
 * Fetches a URL and returns cleaned recipe-relevant HTML.
 *
 * Strategy:
 *  1. Try to find inline JSON-LD (schema.org/Recipe) – richest signal.
 *  2. Fall back to stripping nav/footer/ads and returning the main content HTML.
 */
export async function scrapeRecipePage(url: string): Promise<string> {
  const { data: rawHtml } = await axios.get<string>(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; Redipe/1.0; +https://github.com/redipe)",
      Accept: "text/html,application/xhtml+xml",
    },
    timeout: 15_000,
  });

  const $ = cheerio.load(rawHtml);

  // ── 1. Look for schema.org/Recipe JSON-LD ──────────────────────────────────
  const jsonLdContent = extractJsonLd($);
  if (jsonLdContent) {
    console.log("  ✓ Found schema.org/Recipe JSON-LD – using as source");
    return jsonLdContent;
  }

  // ── 2. Fall back: strip noise, return cleaned article HTML ─────────────────
  console.log("  ✓ No JSON-LD found – extracting main content HTML");
  return extractMainContent($);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractJsonLd($: cheerio.CheerioAPI): string | null {
  let found: string | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    if (found) return; // already found one
    try {
      const raw = $(el).html() ?? "";
      const parsed = JSON.parse(raw);

      // Handle single object or @graph array
      const candidates: unknown[] = Array.isArray(parsed["@graph"])
        ? parsed["@graph"]
        : [parsed];

      for (const item of candidates) {
        const typed = item as Record<string, unknown>;
        const type = typed["@type"];
        if (
          type === "Recipe" ||
          (Array.isArray(type) && (type as string[]).includes("Recipe"))
        ) {
          found = JSON.stringify(typed, null, 2);
          break;
        }
      }
    } catch {
      // malformed JSON-LD – skip
    }
  });

  return found;
}

function extractMainContent($: cheerio.CheerioAPI): string {
  // Remove noisy elements
  $(
    [
      "script",
      "style",
      "noscript",
      "header",
      "footer",
      "nav",
      '[class*="nav"]',
      '[class*="menu"]',
      '[class*="sidebar"]',
      '[class*="advertisement"]',
      '[class*="ad-"]',
      '[id*="ad-"]',
      '[class*="social"]',
      '[class*="share"]',
      '[class*="comment"]',
      '[class*="related"]',
      "iframe",
      "svg",
    ].join(", ")
  ).remove();

  // Prefer known recipe / article containers
  const candidateSelectors = [
    '[class*="recipe"]',
    '[id*="recipe"]',
    "article",
    "main",
    '[role="main"]',
  ];

  for (const sel of candidateSelectors) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 200) {
      return el.html() ?? "";
    }
  }

  // Ultimate fallback – entire body text (stripped)
  return $("body").text().replace(/\s{3,}/g, "\n\n").slice(0, 20_000);
}
