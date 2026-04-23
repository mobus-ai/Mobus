import type {
  DatasetResult,
  DatasetDetails,
  SourceAdapter,
} from "../types.js";
import { CacheTTL, apiCache } from "../utils/cache.js";

const BASE = "http://export.arxiv.org/api/query";
const MIN_REQUEST_INTERVAL_MS = 3_000;

let lastRequestTime = 0;

async function throttledFetch(url: string): Promise<string> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/atom+xml" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`arXiv HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

interface ArxivEntry {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  published: string;
  updated: string;
  categories: string[];
  primaryCategory: string;
  absUrl: string;
  pdfUrl?: string;
}

function parseAtomEntries(xml: string): ArxivEntry[] {
  const entries: ArxivEntry[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];
    const id = extractTag(block, "id")?.replace(/^https?:\/\/arxiv\.org\/abs\//, "") ?? "";
    const title = extractTag(block, "title")?.replace(/\s+/g, " ").trim() ?? "";
    const summary = extractTag(block, "summary")?.replace(/\s+/g, " ").trim() ?? "";
    const published = extractTag(block, "published") ?? "";
    const updated = extractTag(block, "updated") ?? "";

    const authors: string[] = [];
    const authorRegex = /<author>\s*<name>([^<]+)<\/name>/g;
    let authorMatch: RegExpExecArray | null;
    while ((authorMatch = authorRegex.exec(block)) !== null) {
      authors.push(authorMatch[1].trim());
    }

    const categories: string[] = [];
    const catRegex = /<category[^>]*term="([^"]+)"/g;
    let catMatch: RegExpExecArray | null;
    while ((catMatch = catRegex.exec(block)) !== null) {
      categories.push(catMatch[1]);
    }

    const primaryCatMatch = block.match(/<arxiv:primary_category[^>]*term="([^"]+)"/);
    const primaryCategory = primaryCatMatch?.[1] ?? categories[0] ?? "";

    const pdfMatch = block.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/);
    const absMatch = block.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/);
    const pdfUrl = pdfMatch?.[1];
    const absUrl = absMatch?.[1] ?? `https://arxiv.org/abs/${id}`;

    if (id && title) {
      entries.push({ id, title, summary, authors, published, updated, categories, primaryCategory, absUrl, pdfUrl });
    }
  }

  return entries;
}

function extractTag(xml: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(regex);
  return m?.[1]?.trim();
}

async function searchArxiv(query: string, limit: number): Promise<ArxivEntry[]> {
  const cacheKey = `arxiv:search:${query}:${limit}`;
  const cached = apiCache.get<ArxivEntry[]>(cacheKey);
  if (cached) return cached;

  const url = `${BASE}?search_query=all:${encodeURIComponent(query)}&max_results=${limit}&sortBy=relevance&sortOrder=descending`;
  const xml = await throttledFetch(url);
  const entries = parseAtomEntries(xml);

  apiCache.set(cacheKey, entries, CacheTTL.ARXIV_SEARCH);
  return entries;
}

async function getArxivPaper(arxivId: string): Promise<ArxivEntry | undefined> {
  const cacheKey = `arxiv:paper:${arxivId}`;
  const cached = apiCache.get<ArxivEntry>(cacheKey);
  if (cached) return cached;

  const url = `${BASE}?id_list=${encodeURIComponent(arxivId)}`;
  const xml = await throttledFetch(url);
  const entries = parseAtomEntries(xml);
  const entry = entries[0];

  if (entry) apiCache.set(cacheKey, entry, CacheTTL.S2_PAPER_BY_ID);
  return entry;
}

function toResult(e: ArxivEntry): DatasetResult {
  return {
    source: "arxiv" as const,
    id: e.id,
    name: e.title,
    description: e.summary.slice(0, 300),
    url: e.absUrl,
    tags: e.categories,
    lastUpdated: e.published?.split("T")[0],
    popularity: {},
  };
}

export const arxivAdapter: SourceAdapter = {
  source: "arxiv",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    const entries = await searchArxiv(query, limit);
    return entries.map(toResult);
  },

  async getDetails(arxivId: string): Promise<DatasetDetails> {
    const entry = await getArxivPaper(arxivId);
    if (!entry) throw new Error(`arXiv paper ${arxivId} not found`);
    return {
      ...toResult(entry),
      downloadUrl: entry.pdfUrl,
    };
  },
};
