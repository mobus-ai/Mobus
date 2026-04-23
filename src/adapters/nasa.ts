import type { DatasetResult, DatasetDetails, SourceAdapter } from "../types.js";
import { fetchJSON } from "../utils/http.js";

const CMR_BASE = "https://cmr.earthdata.nasa.gov/search";

interface CMRCollection {
  id: string;
  title: string;
  summary?: string;
  time_start?: string;
  time_end?: string;
  links?: Array<{ rel: string; href: string }>;
  data_center?: string;
  archive_center?: string;
  organizations?: string[];
  short_name?: string;
  version_id?: string;
  processing_level_id?: string;
}

interface CMRFeed {
  feed: {
    entry: CMRCollection[];
  };
}

export const nasaAdapter: SourceAdapter = {
  source: "nasa",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    try {
      const url = `${CMR_BASE}/collections.json?keyword=${encodeURIComponent(query)}&page_size=${limit}&has_granules=true`;
      const data = await fetchJSON<CMRFeed>(url, { timeoutMs: 15_000 });

      return (data.feed?.entry ?? []).map((c) => {
        const browseLink = c.links?.find((l) => l.rel === "http://esipfed.org/ns/fedsearch/1.1/data#");
        return {
          source: "nasa" as const,
          id: c.id,
          name: c.title,
          description: (c.summary ?? "").slice(0, 300),
          url: `https://cmr.earthdata.nasa.gov/search/concepts/${c.id}.html`,
          tags: [c.data_center, c.processing_level_id].filter(Boolean) as string[],
          lastUpdated: c.time_end ?? c.time_start,
        };
      });
    } catch {
      return [];
    }
  },

  async getDetails(datasetId: string): Promise<DatasetDetails> {
    const url = `${CMR_BASE}/collections.json?concept_id=${encodeURIComponent(datasetId)}`;
    const data = await fetchJSON<CMRFeed>(url, { timeoutMs: 15_000 });

    const c = data.feed?.entry?.[0];
    if (!c) throw new Error(`NASA collection "${datasetId}" not found.`);

    const dataLink = c.links?.find(
      (l) => l.rel === "http://esipfed.org/ns/fedsearch/1.1/data#",
    );

    return {
      source: "nasa",
      id: c.id,
      name: c.title,
      description: (c.summary ?? "").slice(0, 500),
      url: `https://cmr.earthdata.nasa.gov/search/concepts/${c.id}.html`,
      tags: [
        c.data_center,
        c.processing_level_id,
        c.short_name,
      ].filter(Boolean) as string[],
      lastUpdated: c.time_end ?? c.time_start,
      downloadUrl: dataLink?.href,
      fileList: c.links
        ?.filter((l) => l.href && l.rel !== "http://esipfed.org/ns/fedsearch/1.1/metadata#")
        .map((l) => l.href),
    };
  },
};
