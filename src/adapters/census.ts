import type {
  DatasetResult,
  DatasetDetails,
  SourceAdapter,
} from "../types.js";
import { cachedFetchJSON } from "../utils/http.js";

const DISCOVERY_URL = "https://api.census.gov/data.json";
const CACHE_TTL = 1000 * 60 * 60;

interface CensusDataset {
  title: string;
  description: string;
  c_vintage?: number;
  c_dataset?: string[];
  distribution?: Array<{ accessURL?: string; format?: string }>;
  modified?: string;
  keyword?: string[];
  spatial?: string;
  temporal?: string;
  identifier?: string;
}

interface CensusDiscovery {
  dataset: CensusDataset[];
}

function matchesQuery(ds: CensusDataset, terms: string[]): boolean {
  const haystack = [
    ds.title,
    ds.description,
    ...(ds.keyword ?? []),
    ds.spatial ?? "",
    ds.temporal ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return terms.every((t) => haystack.includes(t));
}

function datasetId(ds: CensusDataset): string {
  if (ds.c_dataset?.length && ds.c_vintage) {
    return `${ds.c_vintage}/${ds.c_dataset.join("/")}`;
  }
  return ds.identifier ?? ds.title.slice(0, 80);
}

function datasetUrl(ds: CensusDataset): string {
  const api = ds.distribution?.find((d) => d.format === "API");
  if (api?.accessURL) return api.accessURL;
  if (ds.c_vintage && ds.c_dataset?.length) {
    return `https://api.census.gov/data/${ds.c_vintage}/${ds.c_dataset.join("/")}`;
  }
  return "https://data.census.gov";
}

export const censusAdapter: SourceAdapter = {
  source: "census",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    try {
      const data = await cachedFetchJSON<CensusDiscovery>(DISCOVERY_URL, {
        cacheTtlMs: CACHE_TTL,
        timeoutMs: 20_000,
      });

      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      const matched = data.dataset.filter((ds) => matchesQuery(ds, terms));

      return matched.slice(0, limit).map((ds) => ({
        source: "census" as const,
        id: datasetId(ds),
        name: ds.title,
        description: (ds.description ?? "").slice(0, 300),
        url: datasetUrl(ds),
        tags: ds.keyword,
        lastUpdated: ds.modified?.split("T")[0],
      }));
    } catch {
      return [];
    }
  },

  async getDetails(id: string): Promise<DatasetDetails> {
    const data = await cachedFetchJSON<CensusDiscovery>(DISCOVERY_URL, {
      cacheTtlMs: CACHE_TTL,
      timeoutMs: 20_000,
    });

    const ds = data.dataset.find((d) => datasetId(d) === id);
    if (!ds) throw new Error(`Census dataset "${id}" not found`);

    return {
      source: "census",
      id,
      name: ds.title,
      description: (ds.description ?? "").slice(0, 500),
      url: datasetUrl(ds),
      tags: ds.keyword,
      lastUpdated: ds.modified?.split("T")[0],
      fileList: ds.distribution?.map((d) => `${d.format ?? "unknown"}: ${d.accessURL ?? ""}`),
    };
  },
};
