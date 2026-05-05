import type {
  DatasetResult,
  DatasetDetails,
  SourceAdapter,
  PopularityMetrics,
} from "../types.js";
import { fetchJSON } from "../utils/http.js";

const BASE = "https://api.openalex.org";

interface OpenAlexAuthor {
  author: { display_name: string };
}

interface OpenAlexConcept {
  display_name: string;
}

interface OpenAlexWork {
  id: string;
  title: string;
  doi?: string;
  open_access?: { oa_url?: string };
  cited_by_count?: number;
  authorships?: OpenAlexAuthor[];
  publication_date?: string;
  concepts?: OpenAlexConcept[];
  type?: string;
}

interface OpenAlexSearchResponse {
  results: OpenAlexWork[];
}

function mailtoParam(): string {
  const email = process.env.OPENALEX_EMAIL;
  return email ? `&mailto=${encodeURIComponent(email)}` : "";
}

function toResult(w: OpenAlexWork): DatasetResult {
  return {
    source: "openalex" as const,
    id: w.id,
    name: w.title ?? "",
    description: [w.type, w.publication_date].filter(Boolean).join(" · "),
    url: w.doi ?? w.id,
    authors: w.authorships?.map((a) => a.author.display_name),
    tags: w.concepts?.map((c) => c.display_name),
    lastUpdated: w.publication_date,
    popularity: {
      citations: w.cited_by_count,
    },
  };
}

export const openAlexAdapter: SourceAdapter = {
  source: "openalex",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    try {
      const url = `${BASE}/works?search=${encodeURIComponent(query)}&per_page=${limit}${mailtoParam()}`;
      const data = await fetchJSON<OpenAlexSearchResponse>(url);
      return (data.results ?? []).map(toResult);
    } catch {
      return [];
    }
  },

  async getDetails(datasetId: string): Promise<DatasetDetails> {
    const url = `${BASE}/works/${encodeURIComponent(datasetId)}${mailtoParam().replace("&", "?")}`;
    const w = await fetchJSON<OpenAlexWork>(url);
    return {
      ...toResult(w),
      downloadUrl: w.open_access?.oa_url ?? undefined,
    };
  },

  async getPopularity(datasetId: string): Promise<PopularityMetrics> {
    const url = `${BASE}/works/${encodeURIComponent(datasetId)}${mailtoParam().replace("&", "?")}`;
    const w = await fetchJSON<OpenAlexWork>(url);
    return {
      citations: w.cited_by_count,
    };
  },
};
