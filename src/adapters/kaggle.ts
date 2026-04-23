import type {
  DatasetResult,
  DatasetDetails,
  SourceAdapter,
  PopularityMetrics,
} from "../types.js";
import { fetchJSON } from "../utils/http.js";

const BASE = "https://www.kaggle.com/api/v1";

function authHeaders(): Record<string, string> {
  const user = process.env.KAGGLE_USERNAME;
  const key = process.env.KAGGLE_KEY;
  if (!user || !key) return {};
  const encoded = Buffer.from(`${user}:${key}`).toString("base64");
  return { Authorization: `Basic ${encoded}` };
}

interface KaggleDataset {
  ref: string;
  title: string;
  subtitle?: string;
  description?: string;
  url?: string;
  ownerName?: string;
  licenseName?: string;
  tags?: { name: string }[];
  lastUpdated?: string;
  totalBytes?: number;
  usabilityRating?: number;
  downloadCount?: number;
  voteCount?: number;
  viewCount?: number;
}

interface KaggleColumn {
  name: string;
  type?: string;
  description?: string;
}

export const kaggleAdapter: SourceAdapter = {
  source: "kaggle",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    const url = `${BASE}/datasets/list?search=${encodeURIComponent(query)}&page=1&pageSize=${limit}`;
    const data = await fetchJSON<KaggleDataset[]>(url, {
      headers: authHeaders(),
    });

    return data.map((d) => ({
      source: "kaggle" as const,
      id: d.ref,
      name: d.title,
      description: (d.subtitle ?? d.description ?? "").slice(0, 300),
      url: `https://www.kaggle.com/datasets/${d.ref}`,
      license: d.licenseName,
      tags: d.tags?.map((t) => t.name),
      lastUpdated: d.lastUpdated,
      popularity: {
        downloads: d.downloadCount,
        views: d.viewCount,
        likes: d.voteCount,
      },
    }));
  },

  async getDetails(datasetId: string): Promise<DatasetDetails> {
    const parts = datasetId.split("/");
    if (parts.length < 2) {
      throw new Error(
        `Invalid Kaggle dataset ID "${datasetId}". Expected format: owner/dataset-slug`,
      );
    }
    const [owner, slug] = parts;

    const meta = await fetchJSON<KaggleDataset>(
      `${BASE}/datasets/view/${owner}/${slug}`,
      { headers: authHeaders() },
    );

    let columns: { name: string; type?: string }[] | undefined;
    try {
      const cols = await fetchJSON<KaggleColumn[]>(
        `${BASE}/datasets/${owner}/${slug}/columns`,
        { headers: authHeaders() },
      );
      columns = cols.map((c) => ({ name: c.name, type: c.type }));
    } catch {
      // columns endpoint may not be available for all datasets
    }

    return {
      source: "kaggle",
      id: meta.ref,
      name: meta.title,
      description: (meta.description ?? meta.subtitle ?? "").slice(0, 500),
      url: `https://www.kaggle.com/datasets/${meta.ref}`,
      license: meta.licenseName,
      tags: meta.tags?.map((t) => t.name),
      lastUpdated: meta.lastUpdated,
      columns,
      size: meta.totalBytes ? formatBytes(meta.totalBytes) : undefined,
      downloadUrl: `https://www.kaggle.com/datasets/${meta.ref}/download`,
      popularity: {
        downloads: meta.downloadCount,
        views: meta.viewCount,
        likes: meta.voteCount,
      },
    };
  },

  async getPopularity(datasetId: string): Promise<PopularityMetrics> {
    const parts = datasetId.split("/");
    if (parts.length < 2) throw new Error(`Invalid Kaggle dataset ID "${datasetId}".`);
    const [owner, slug] = parts;

    const meta = await fetchJSON<KaggleDataset>(
      `${BASE}/datasets/view/${owner}/${slug}`,
      { headers: authHeaders() },
    );
    return {
      downloads: meta.downloadCount,
      views: meta.viewCount,
      likes: meta.voteCount,
    };
  },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1e6) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1e9) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1e9).toFixed(1)} GB`;
}
