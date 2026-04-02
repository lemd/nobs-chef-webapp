import fs from "fs";
import path from "path";
import crypto from "crypto";

const CACHE_DIR = path.resolve(__dirname, "../../output");

/** Ensure the output directory exists */
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/** Derive a short deterministic filename from a URL (12-char SHA256 hex) */
export function urlToFilename(url: string): string {
  const hash = crypto.createHash("sha256").update(url).digest("hex").slice(0, 12);
  return `${hash}.json`;
}

/** Return the full path for a given URL's cache file */
export function cachePathForUrl(url: string): string {
  return path.join(CACHE_DIR, urlToFilename(url));
}

/** Check if a cached file exists for a URL */
export function hasCached(url: string): boolean {
  return fs.existsSync(cachePathForUrl(url));
}

/** Read and parse the cached recipe for a URL */
export function readCache(url: string): unknown {
  const filePath = cachePathForUrl(url);
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

/** Persist a recipe object to the URL's cache file (injects sourceUrl) */
export function writeCache(url: string, data: unknown): string {
  ensureCacheDir();
  const filePath = cachePathForUrl(url);
  const withUrl = { ...(data as object), sourceUrl: url };
  fs.writeFileSync(filePath, JSON.stringify(withUrl, null, 2), "utf-8");
  return filePath;
}

/** List all cached recipe files, newest first */
export function listCached(): Array<{ filename: string; filePath: string; savedAt: Date }> {
  ensureCacheDir();
  return fs
    .readdirSync(CACHE_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((filename) => {
      const filePath = path.join(CACHE_DIR, filename);
      const { mtime } = fs.statSync(filePath);
      return { filename, filePath, savedAt: mtime };
    })
    .sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime());
}
