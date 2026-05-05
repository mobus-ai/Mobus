import type {
  DatasetResult,
  DatasetDetails,
  SourceAdapter,
  PopularityMetrics,
} from "../types.js";
import { fetchJSON } from "../utils/http.js";

const BASE = "https://api.crossref.org";
const MAILTO = "contact@mobus.ai";

interface CrossrefResponse {
  message: {
    items: CrossrefWork[];
    "total-results"?: number;
  };
}

interface CrossrefSingleResponse {
  message: CrossrefWork;
}

interface CrossrefWork {
  DOI: string;
  title?: string[];
  abstract?: string;
  author?: Array<{ given?: string; family?: string; name?: string }>;
  "container-title"?: string[];
  publisher?: string;
  type?: string;
  license?: Array<{ URL?: string; "content-version"?: string }>;
  subject?: string[];
  issued?: { "date-parts"?: number[][] };
  "is-referenced-by-count"?: number;
  "references-count"?: number;
  URL?: string;
}

function formatAuthors(work: CrossrefWork): string {
  if (!work.author?.length) return "";
  return work.author
    .slice(0, 5)
    .map((a) => a.name ?? [a.given, a.family].filter(Boolean).join(" "))
    .join(", ");
}

function issuedDate(work: CrossrefWork): string | undefined {
  const parts = work.issued?.["date-parts"]?.[0];
  if (!parts?.length) return undefined;
  return parts.map((p) => String(p).padStart(2, "0")).join("-");
}

function toResult(work: CrossrefWork): DatasetResult {
  const title = work.title?.[0] ?? work.DOI;
  const authors = formatAuthors(work);
  const journal = work["container-title"]?.[0] ?? "";
  const desc = [
    authors && `By ${authors}`,
    journal && `In: ${journal}`,
    work.abstract?.replace(/<[^>]*>/g, "").slice(0, 200),
  ]
    .filter(Boolean)
    .join(". ");

  return {
    source: "crossref" as const,
    id: work.DOI,
    name: title,
    description: desc.slice(0, 300),
    url: work.URL ?? `https://doi.org/${work.DOI}`,
    license: work.license?.[0]?.URL,
    tags: work.subject,
    lastUpdated: issuedDate(work),
    authors: work.author
      ?.map((a) => a.name ?? [a.given, a.family].filter(Boolean).join(" "))
      .filter((n) => n.length > 0),
    popularity: {
      citations: work["is-referenced-by-count"],
    },
  };
}

export const crossrefAdapter: SourceAdapter = {
  source: "crossref",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    try {
      const url = `${BASE}/works?query=${encodeURIComponent(query)}&rows=${limit}&mailto=${MAILTO}`;
      const data = await fetchJSON<CrossrefResponse>(url, { timeoutMs: 15_000 });
      return data.message.items.map(toResult);
    } catch {
      return [];
    }
  },

  async getDetails(doi: string): Promise<DatasetDetails> {
    const url = `${BASE}/works/${encodeURIComponent(doi)}?mailto=${MAILTO}`;
    const data = await fetchJSON<CrossrefSingleResponse>(url, { timeoutMs: 15_000 });
    const work = data.message;

    return {
      ...toResult(work),
      downloadUrl: work.URL ?? `https://doi.org/${work.DOI}`,
    };
  },

  async getPopularity(doi: string): Promise<PopularityMetrics> {
    const url = `${BASE}/works/${encodeURIComponent(doi)}?mailto=${MAILTO}`;
    const data = await fetchJSON<CrossrefSingleResponse>(url, { timeoutMs: 15_000 });
    return {
      citations: data.message["is-referenced-by-count"],
    };
  },
};
