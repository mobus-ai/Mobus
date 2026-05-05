import type {
  DatasetResult,
  DatasetDetails,
  SourceAdapter,
} from "../types.js";
import { fetchJSON, cachedFetchJSON } from "../utils/http.js";
import { apiCache, CacheTTL } from "../utils/cache.js";

const BASE = "https://api.semanticscholar.org/graph/v1";

const PAPER_FIELDS = [
  "title",
  "abstract",
  "year",
  "citationCount",
  "influentialCitationCount",
  "publicationTypes",
  "publicationDate",
  "venue",
  "fieldsOfStudy",
  "openAccessPdf",
  "externalIds",
  "authors",
  "url",
  "tldr",
].join(",");

interface S2SearchResponse {
  total: number;
  offset: number;
  next?: number;
  data: S2Paper[];
}

export interface S2Paper {
  paperId: string;
  corpusId?: number;
  externalIds?: Record<string, string>;
  url?: string;
  title: string;
  abstract?: string;
  venue?: string;
  publicationVenue?: {
    id: string;
    name: string;
    type?: string;
    alternate_names?: string[];
  };
  year?: number;
  citationCount?: number;
  influentialCitationCount?: number;
  publicationTypes?: string[];
  publicationDate?: string;
  fieldsOfStudy?: string[];
  s2FieldsOfStudy?: Array<{ category: string; source: string }>;
  openAccessPdf?: { url: string; status?: string };
  authors?: Array<{
    authorId: string;
    name: string;
    affiliations?: string[];
  }>;
  tldr?: { model: string; text: string };
  embedding?: { model: string; vector: number[] };
}

export async function s2SearchPapers(
  query: string,
  limit: number = 10,
  opts?: {
    publicationTypes?: string;
    fieldsOfStudy?: string;
    year?: string;
  },
): Promise<{ total: number; papers: S2Paper[] }> {
  const params = new URLSearchParams({
    query,
    limit: String(Math.min(limit, 100)),
    fields: PAPER_FIELDS,
  });
  if (opts?.publicationTypes) params.set("publicationTypes", opts.publicationTypes);
  if (opts?.fieldsOfStudy) params.set("fieldsOfStudy", opts.fieldsOfStudy);
  if (opts?.year) params.set("year", opts.year);

  const data = await cachedFetchJSON<S2SearchResponse>(
    `${BASE}/paper/search?${params}`,
    { timeoutMs: 15_000, cacheTtlMs: CacheTTL.S2_SEARCH },
  );
  return { total: data.total, papers: data.data ?? [] };
}

export async function s2GetPaper(paperId: string): Promise<S2Paper> {
  return cachedFetchJSON<S2Paper>(
    `${BASE}/paper/${encodeURIComponent(paperId)}?fields=${PAPER_FIELDS}`,
    { timeoutMs: 15_000, cacheTtlMs: CacheTTL.S2_PAPER_BY_ID },
  );
}

export async function s2GetPapersByIds(ids: string[]): Promise<S2Paper[]> {
  if (ids.length === 0) return [];

  const results: S2Paper[] = [];
  const uncachedIds: string[] = [];

  for (const id of ids) {
    const cacheKey = `s2:paper:${id}`;
    const cached = apiCache.get<S2Paper>(cacheKey);
    if (cached) {
      results.push(cached);
    } else {
      uncachedIds.push(id);
    }
  }

  if (uncachedIds.length === 0) return results;

  const batchSize = 50;
  for (let i = 0; i < uncachedIds.length; i += batchSize) {
    const batch = uncachedIds.slice(i, i + batchSize);
    const url = `${BASE}/paper/batch`;
    const params = new URLSearchParams({ fields: PAPER_FIELDS });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`${url}?${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: batch }),
        signal: controller.signal,
      });
      if (res.ok) {
        const data = (await res.json()) as (S2Paper | null)[];
        for (let j = 0; j < data.length; j++) {
          const paper = data[j];
          if (paper) {
            apiCache.set(`s2:paper:${batch[j]}`, paper, CacheTTL.S2_PAPER_BY_ID);
            results.push(paper);
          }
        }
      }
    } finally {
      clearTimeout(timer);
    }
  }

  return results;
}

export async function s2SearchDatasetPapers(
  query: string,
  limit: number = 10,
): Promise<{ total: number; papers: S2Paper[] }> {
  return s2SearchPapers(query, limit, { publicationTypes: "Dataset" });
}

const PAPER_FIELDS_WITH_EMBEDDING = PAPER_FIELDS + ",embedding.specter_v2";

export async function s2SemanticSearch(
  query: string,
  limit: number = 10,
  opts?: {
    publicationTypes?: string;
    fieldsOfStudy?: string;
    year?: string;
  },
): Promise<{ total: number; papers: S2Paper[] }> {
  const { embedQuery, rerankByEmbedding } = await import("../utils/embeddings.js");

  const candidateLimit = Math.min(limit * 5, 100);
  const params = new URLSearchParams({
    query,
    limit: String(candidateLimit),
    fields: PAPER_FIELDS_WITH_EMBEDDING,
  });
  if (opts?.publicationTypes) params.set("publicationTypes", opts.publicationTypes);
  if (opts?.fieldsOfStudy) params.set("fieldsOfStudy", opts.fieldsOfStudy);
  if (opts?.year) params.set("year", opts.year);

  let candidates: S2Paper[];
  let total: number;
  try {
    const data = await cachedFetchJSON<S2SearchResponse>(
      `${BASE}/paper/search?${params}`,
      { timeoutMs: 15_000, cacheTtlMs: CacheTTL.S2_SEARCH },
    );
    candidates = data.data ?? [];
    total = data.total;
  } catch {
    return s2SearchPapers(query, limit, opts);
  }

  if (candidates.length === 0) return { total: 0, papers: [] };

  let queryVec: number[];
  try {
    queryVec = await embedQuery(query);
  } catch {
    return { total, papers: candidates.slice(0, limit) };
  }

  const withEmbeddings = candidates
    .filter((p) => p.embedding?.vector && p.embedding.vector.length > 0)
    .map((p) => ({ paper: p, embedding: p.embedding!.vector }));

  if (withEmbeddings.length === 0) {
    return { total, papers: candidates.slice(0, limit) };
  }

  const reranked = rerankByEmbedding(queryVec, withEmbeddings);
  return { total, papers: reranked.slice(0, limit) };
}

interface S2CitationResponse {
  offset: number;
  next?: number;
  data: Array<{ citingPaper: S2Paper }>;
}

interface S2ReferenceResponse {
  offset: number;
  next?: number;
  data: Array<{ citedPaper: S2Paper }>;
}

const CITATION_FIELDS = [
  "title", "abstract", "year", "citationCount", "influentialCitationCount",
  "publicationTypes", "publicationDate", "venue", "fieldsOfStudy",
  "openAccessPdf", "externalIds", "authors", "url", "tldr",
].join(",");

export async function s2GetPaperCitations(
  paperId: string,
  limit: number = 50,
): Promise<S2Paper[]> {
  const url = `${BASE}/paper/${encodeURIComponent(paperId)}/citations?fields=${CITATION_FIELDS}&limit=${Math.min(limit, 1000)}`;
  const data = await cachedFetchJSON<S2CitationResponse>(url, {
    timeoutMs: 20_000,
    cacheTtlMs: CacheTTL.S2_SEARCH,
  });
  return data.data.map((d) => d.citingPaper).filter((p) => p && p.paperId);
}

export async function s2GetPaperReferences(
  paperId: string,
  limit: number = 50,
): Promise<S2Paper[]> {
  const url = `${BASE}/paper/${encodeURIComponent(paperId)}/references?fields=${CITATION_FIELDS}&limit=${Math.min(limit, 1000)}`;
  const data = await cachedFetchJSON<S2ReferenceResponse>(url, {
    timeoutMs: 20_000,
    cacheTtlMs: CacheTTL.S2_SEARCH,
  });
  return data.data.map((d) => d.citedPaper).filter((p) => p && p.paperId);
}

export function extractS2PaperMeta(paper: S2Paper) {
  return {
    paperId: paper.paperId,
    title: paper.title,
    year: paper.year,
    venue: paper.venue,
    citationCount: paper.citationCount,
    influentialCitationCount: paper.influentialCitationCount,
    publicationTypes: paper.publicationTypes,
    fieldsOfStudy: paper.fieldsOfStudy,
    authors: paper.authors?.map((a) => a.name) ?? [],
    pdfUrl: paper.openAccessPdf?.url,
    url: paper.url,
    arxivId: paper.externalIds?.ArXiv,
    tldr: paper.tldr?.text,
  };
}

export const semanticScholarAdapter: SourceAdapter = {
  source: "semantic-scholar",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    const { papers } = await s2SearchDatasetPapers(query, limit);
    return papers.map(toResult);
  },

  async getDetails(datasetId: string): Promise<DatasetDetails> {
    const paper = await s2GetPaper(datasetId);
    return {
      ...toResult(paper),
    };
  },
};

function toResult(p: S2Paper): DatasetResult {
  return {
    source: "semantic-scholar" as const,
    id: p.paperId,
    name: p.title,
    description: (p.abstract ?? "").slice(0, 300),
    url: p.url ?? `https://www.semanticscholar.org/paper/${p.paperId}`,
    tags: [
      ...(p.fieldsOfStudy ?? []),
      ...(p.publicationTypes ?? []),
      ...(p.venue ? [p.venue] : []),
    ],
    lastUpdated: p.publicationDate ?? (p.year ? `${p.year}-01-01` : undefined),
    authors: p.authors?.map((a) => a.name),
    popularity: {
      citations: p.citationCount,
    },
  };
}
