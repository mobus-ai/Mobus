import type { DatasetResult, DatasetDetails, SourceAdapter } from "../types.js";
import { fetchJSON } from "../utils/http.js";

const BASE = "https://ec.europa.eu/eurostat/api/dissemination";
// The old /search/datasets endpoint no longer exists.
// Use the Table of Contents (TSV format) and filter locally.
const TOC_URL = `${BASE}/catalogue/toc/txt`;

interface TocEntry {
  title: string;
  code: string;
  type: string;
  lastUpdate?: string;
}

let cachedToc: TocEntry[] | null = null;
let tocCacheTime = 0;
const TOC_CACHE_TTL = 1000 * 60 * 60 * 6;

async function loadToc(): Promise<TocEntry[]> {
  if (cachedToc && Date.now() - tocCacheTime < TOC_CACHE_TTL) return cachedToc;

  const res = await fetch(TOC_URL, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Eurostat TOC HTTP ${res.status}`);
  const text = await res.text();

  const entries: TocEntry[] = [];
  for (const line of text.split("\n").slice(1)) {
    const cols = line.split("\t").map((c) => c.replace(/^"|"$/g, "").trim());
    if (cols.length < 3) continue;
    const [title, code, type, lastUpdate] = cols;
    if (!code || !title || type === "folder") continue;
    entries.push({ title, code, type, lastUpdate });
  }

  cachedToc = entries;
  tocCacheTime = Date.now();
  return entries;
}

interface EurostatDimension {
  id: string;
  label: string;
  category?: { label?: Record<string, string> };
}

interface EurostatDatasetResponse {
  label?: string;
  id?: string[];
  size?: number[];
  dimension?: Record<string, EurostatDimension>;
}

export const eurostatAdapter: SourceAdapter = {
  source: "eurostat",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    try {
      const toc = await loadToc();
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

      const matches = toc
        .filter((e) => {
          const hay = `${e.title} ${e.code}`.toLowerCase();
          return terms.every((t) => hay.includes(t));
        })
        .slice(0, limit);

      return matches.map((e) => ({
        source: "eurostat" as const,
        id: e.code,
        name: e.title || e.code,
        description: `Eurostat ${e.type}: ${e.title}`,
        url: `https://ec.europa.eu/eurostat/databrowser/view/${e.code}/default/table`,
        lastUpdated: e.lastUpdate?.trim() || undefined,
      }));
    } catch {
      return [];
    }
  },

  async getDetails(datasetId: string): Promise<DatasetDetails> {
    let label = datasetId;
    let dimensions: string[] | undefined;

    try {
      const url = `${BASE}/sdmx/2.1/data/${datasetId}?format=JSON&lang=en`;
      const data = await fetchJSON<EurostatDatasetResponse>(url, { timeoutMs: 15_000 });

      if (data.label) label = data.label;
      if (data.dimension) {
        dimensions = Object.entries(data.dimension).map(
          ([, dim]) => dim.id ?? dim.label,
        );
      }
    } catch {
      // Fallback to basic info
    }

    return {
      source: "eurostat",
      id: datasetId,
      name: label,
      description: `Eurostat dataset: ${label}`,
      url: `https://ec.europa.eu/eurostat/databrowser/view/${datasetId}/default/table`,
      columns: dimensions?.map((d) => ({ name: d })),
      downloadUrl: `${BASE}/sdmx/2.1/data/${datasetId}?format=TSV`,
    };
  },
};
