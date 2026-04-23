import type { DatasetResult, DatasetDetails, SourceAdapter } from "../types.js";
import { fetchJSON } from "../utils/http.js";

// AWS Open Data Registry switched to NDJSON index (one JSON object per line)
// Old /api/v1/datasets endpoint returns 404
const NDJSON_INDEX = "https://registry.opendata.aws/index.ndjson";

interface AWSDataset {
  Slug?: string;
  Name: string;
  Description?: string;
  License?: string;
  Tags?: string[];
  ManagedBy?: string;
  UpdateFrequency?: string;
  Deprecated?: boolean;
  Resources?: Array<{
    Description?: string;
    ARN?: string;
    Region?: string;
    Type?: string;
  }>;
}

let cachedDatasets: AWSDataset[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60;

async function loadIndex(): Promise<AWSDataset[]> {
  if (cachedDatasets && Date.now() - cacheTime < CACHE_TTL) return cachedDatasets;

  const res = await fetch(NDJSON_INDEX, {
    headers: { Accept: "application/x-ndjson" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`AWS index HTTP ${res.status}`);
  const text = await res.text();

  const datasets: AWSDataset[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed) as AWSDataset;
      if (!obj.Deprecated) datasets.push(obj);
    } catch { /* skip malformed lines */ }
  }

  cachedDatasets = datasets;
  cacheTime = Date.now();
  return datasets;
}

function slugFrom(d: AWSDataset): string {
  return d.Slug ?? d.Name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export const awsAdapter: SourceAdapter = {
  source: "aws",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    try {
      const datasets = await loadIndex();
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

      const matches = datasets
        .filter((d) => {
          const text = `${d.Name} ${d.Description ?? ""} ${(d.Tags ?? []).join(" ")}`.toLowerCase();
          return terms.every((t) => text.includes(t));
        })
        .slice(0, limit);

      return matches.map((d) => ({
        source: "aws" as const,
        id: slugFrom(d),
        name: d.Name,
        description: (d.Description ?? "").slice(0, 300),
        url: `https://registry.opendata.aws/${slugFrom(d)}/`,
        license: d.License,
        tags: d.Tags,
      }));
    } catch {
      return [];
    }
  },

  async getDetails(datasetId: string): Promise<DatasetDetails> {
    const datasets = await loadIndex();
    const dataset = datasets.find((d) => slugFrom(d) === datasetId);
    if (!dataset) throw new Error(`AWS dataset "${datasetId}" not found.`);

    return {
      source: "aws",
      id: slugFrom(dataset),
      name: dataset.Name,
      description: (dataset.Description ?? "").slice(0, 500),
      url: `https://registry.opendata.aws/${slugFrom(dataset)}/`,
      license: dataset.License,
      tags: dataset.Tags,
      fileList: dataset.Resources?.map(
        (r) => `${r.Type ?? "resource"}: ${r.Description ?? r.ARN ?? "N/A"} (${r.Region ?? "global"})`,
      ),
    };
  },
};
