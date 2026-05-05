import type { DatasetResult, SearchSource, SourceAdapter } from "../types.js";

export async function findSimilar(
  adapters: Map<SearchSource, SourceAdapter>,
  source: SearchSource,
  datasetId: string,
  limit: number = 5,
): Promise<{ reference: DatasetResult; similar: DatasetResult[] }> {
  const adapter = adapters.get(source);
  if (!adapter) {
    throw new Error(`Adapter "${source}" is not available.`);
  }

  const details = await adapter.getDetails(datasetId);

  const keywords = extractKeywords(details.name, details.description, details.tags);
  if (keywords.length === 0) {
    throw new Error("Could not extract meaningful keywords from the dataset to find similar ones.");
  }

  const searchQuery = keywords.slice(0, 5).join(" ");

  const allAdapters = [...adapters.keys()];
  const settled = await Promise.allSettled(
    allAdapters.map(async (src) => {
      const a = adapters.get(src)!;
      return a.search(searchQuery, limit);
    }),
  );

  const candidates: DatasetResult[] = [];
  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      candidates.push(...outcome.value);
    }
  }

  const selfKey = `${source}:${datasetId}`.toLowerCase();
  const seen = new Set<string>([selfKey]);
  const refTags = new Set((details.tags ?? []).map((t) => t.toLowerCase()));

  const scored = candidates
    .filter((c) => {
      const key = `${c.source}:${c.id}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((c) => {
      const cTags = new Set((c.tags ?? []).map((t) => t.toLowerCase()));
      const tagOverlap = [...refTags].filter((t) => cTags.has(t)).length;
      const nameOverlap = keywords.filter((k) =>
        c.name.toLowerCase().includes(k.toLowerCase()),
      ).length;
      const descOverlap = keywords.filter((k) =>
        c.description.toLowerCase().includes(k.toLowerCase()),
      ).length;

      return { dataset: c, score: tagOverlap * 3 + nameOverlap * 2 + descOverlap };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const reference: DatasetResult = {
    source: details.source,
    id: details.id,
    name: details.name,
    description: details.description,
    url: details.url,
    license: details.license,
    tags: details.tags,
    lastUpdated: details.lastUpdated,
  };

  return {
    reference,
    similar: scored.map((s) => s.dataset),
  };
}

function extractKeywords(name: string, description: string, tags?: string[]): string[] {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "it", "as", "be", "this", "that",
    "are", "was", "were", "been", "has", "have", "had", "do", "does",
    "did", "will", "would", "could", "should", "may", "might", "can",
    "not", "no", "so", "if", "then", "than", "too", "very", "just",
    "about", "up", "out", "all", "each", "every", "both", "few", "more",
    "most", "other", "some", "such", "only", "same", "into", "also",
    "dataset", "data", "set", "file", "files", "csv", "json", "parquet",
  ]);

  const words = new Set<string>();

  if (tags) {
    for (const tag of tags) {
      const cleaned = tag.replace(/[^a-zA-Z0-9\s-]/g, "").trim().toLowerCase();
      if (cleaned.length > 2 && !stopWords.has(cleaned)) {
        words.add(cleaned);
      }
    }
  }

  const nameWords = name
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 2 && !stopWords.has(w));
  for (const w of nameWords) words.add(w);

  const descWords = description
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 3 && !stopWords.has(w))
    .slice(0, 10);
  for (const w of descWords) words.add(w);

  return [...words];
}
