import * as cheerio from "npm:cheerio";

/**
 * Fetches a URL and returns cleaned recipe-relevant HTML.
 * Uses native fetch (Deno/Web API) instead of axios.
 */
export async function scrapeRecipePage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; Redipe/1.0; +https://github.com/redipe)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const rawHtml = await response.text();
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

function extractJsonLd($: cheerio.CheerioAPI): string | null {
  let found: string | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    if (found) return;
    try {
      const raw = $(el).html() ?? "";
      const parsed = JSON.parse(raw);

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
      return (el.html() ?? "").slice(0, 20_000);
    }
  }

  return $("body").text().replace(/\s{3,}/g, "\n\n").slice(0, 20_000);
}
