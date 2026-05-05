import type {
  DatasetResult,
  DatasetDetails,
  SourceAdapter,
  PopularityMetrics,
} from "../types.js";
import { fetchJSON } from "../utils/http.js";

const BASE = "https://zenodo.org/api/records";

interface ZenodoHits {
  hits: {
    hits: ZenodoRecord[];
  };
}

interface ZenodoRecord {
  id: number;
  doi?: string;
  metadata: {
    title: string;
    description?: string;
    license?: { id: string };
    keywords?: string[];
    publication_date?: string;
    creators?: Array<{ name: string }>;
  };
  files?: ZenodoFile[];
  links?: { self?: string; html?: string };
  stats?: {
    downloads?: number;
    unique_downloads?: number;
    views?: number;
    unique_views?: number;
  };
}

interface ZenodoFile {
  key: string;
  size: number;
  links?: { self?: string };
}

export const zenodoAdapter: SourceAdapter = {
  source: "zenodo",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    const url = `${BASE}?q=${encodeURIComponent(query)}&size=${limit}&type=dataset`;
    const data = await fetchJSON<ZenodoHits>(url);

    return data.hits.hits.map((r) => ({
      source: "zenodo" as const,
      id: String(r.id),
      name: r.metadata.title,
      description: stripHTML(r.metadata.description ?? "").slice(0, 300),
      url: r.links?.html ?? `https://zenodo.org/records/${r.id}`,
      license: r.metadata.license?.id,
      tags: r.metadata.keywords,
      lastUpdated: r.metadata.publication_date,
      authors: r.metadata.creators?.map((c) => c.name),
      popularity: {
        downloads: r.stats?.downloads,
        views: r.stats?.views,
      },
    }));
  },

  async getDetails(datasetId: string): Promise<DatasetDetails> {
    const url = `${BASE}/${datasetId}`;
    const r = await fetchJSON<ZenodoRecord>(url);

    const fileList = r.files?.map((f) => `${f.key} (${formatBytes(f.size)})`);
    const totalSize = r.files?.reduce((sum, f) => sum + f.size, 0);

    return {
      source: "zenodo",
      id: String(r.id),
      name: r.metadata.title,
      description: stripHTML(r.metadata.description ?? "").slice(0, 500),
      url: r.links?.html ?? `https://zenodo.org/records/${r.id}`,
      license: r.metadata.license?.id,
      tags: r.metadata.keywords,
      lastUpdated: r.metadata.publication_date,
      fileList,
      size: totalSize ? formatBytes(totalSize) : undefined,
      downloadUrl: r.files?.[0]?.links?.self,
      popularity: {
        downloads: r.stats?.downloads,
        views: r.stats?.views,
      },
    };
  },

  async getPopularity(datasetId: string): Promise<PopularityMetrics> {
    const r = await fetchJSON<ZenodoRecord>(`${BASE}/${datasetId}`);
    return {
      downloads: r.stats?.downloads,
      views: r.stats?.views,
    };
  },
};

function stripHTML(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1e6) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1e9) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1e9).toFixed(1)} GB`;
}
