import { apiCache, CacheTTL } from "./cache.js";
import type { S2Paper } from "../adapters/semantic-scholar.js";

const SPECTER_URL = "https://model-apis.semanticscholar.org/specter/v1/invoke";

interface SpecterResponse {
  preds: Array<{ paper_id: string; embedding: number[] }>;
}

export async function embedQuery(queryText: string): Promise<number[]> {
  const cacheKey = `specter:query:${simpleHash(queryText)}`;
  const cached = apiCache.get<number[]>(cacheKey);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(SPECTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ paper_id: "query", title: queryText, abstract: queryText }]),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`SPECTER API returned ${res.status}`);
    }

    const data = (await res.json()) as SpecterResponse;
    const embedding = data.preds?.[0]?.embedding;
    if (!embedding || embedding.length === 0) {
      throw new Error("SPECTER returned empty embedding");
    }

    apiCache.set(cacheKey, embedding, CacheTTL.S2_PAPER_BY_ID);
    return embedding;
  } finally {
    clearTimeout(timer);
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function rerankByEmbedding(
  queryVec: number[],
  papers: Array<{ paper: S2Paper; embedding: number[] }>,
): S2Paper[] {
  return papers
    .map((p) => ({
      paper: p.paper,
      score: cosineSimilarity(queryVec, p.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .map((p) => p.paper);
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return (hash >>> 0).toString(36);
}
