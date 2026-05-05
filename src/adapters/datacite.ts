import type {
  DatasetResult,
  DatasetDetails,
  SourceAdapter,
} from "../types.js";
import { fetchJSON } from "../utils/http.js";

const BASE = "https://api.datacite.org";

interface DataCiteAttributes {
  titles?: Array<{ title: string }>;
  descriptions?: Array<{ description: string }>;
  creators?: Array<{ name: string }>;
  dates?: Array<{ date: string }>;
  types?: { resourceTypeGeneral?: string };
  rightsList?: Array<{ rightsIdentifier?: string }>;
  subjects?: Array<{ subject: string }>;
  citationCount?: number;
  url?: string;
}

interface DataCiteResource {
  id: string;
  attributes: DataCiteAttributes;
}

interface DataCiteSearchResponse {
  data: DataCiteResource[];
}

interface DataCiteSingleResponse {
  data: DataCiteResource;
}

function toResult(item: DataCiteResource): DatasetResult {
  const attrs = item.attributes;

  return {
    source: "datacite" as const,
    id: item.id,
    name: attrs.titles?.[0]?.title ?? item.id,
    description: (attrs.descriptions?.[0]?.description ?? "").slice(0, 300),
    url: `https://doi.org/${item.id}`,
    license: attrs.rightsList?.[0]?.rightsIdentifier,
    tags: attrs.subjects?.map((s) => s.subject),
    lastUpdated: attrs.dates?.[0]?.date,
    authors: attrs.creators?.map((c) => c.name),
    popularity: {
      citations: attrs.citationCount,
    },
  };
}

export const dataCiteAdapter: SourceAdapter = {
  source: "datacite",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    try {
      const url = `${BASE}/dois?query=${encodeURIComponent(query)}&page[size]=${limit}`;
      const data = await fetchJSON<DataCiteSearchResponse>(url);
      return data.data.map(toResult);
    } catch {
      return [];
    }
  },

  async getDetails(doi: string): Promise<DatasetDetails> {
    const url = `${BASE}/dois/${encodeURIComponent(doi)}`;
    const data = await fetchJSON<DataCiteSingleResponse>(url);
    const attrs = data.data.attributes;

    return {
      ...toResult(data.data),
      downloadUrl: attrs.url ?? undefined,
    };
  },
};
