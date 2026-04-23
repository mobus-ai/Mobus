import type {
  DatasetResult,
  DatasetDetails,
  SourceAdapter,
  PreviewResult,
  PopularityMetrics,
} from "../types.js";
import { fetchJSON } from "../utils/http.js";

const BASE = "https://huggingface.co/api/datasets";
const DATASETS_SERVER = "https://datasets-server.huggingface.co";

function authHeaders(): Record<string, string> {
  const token = process.env.HF_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface HFDataset {
  id: string;
  description?: string;
  tags?: string[];
  downloads?: number;
  likes?: number;
  lastModified?: string;
  cardData?: { license?: string | string[] };
}

interface HFInfoResponse {
  dataset_info?: Record<
    string,
    {
      features?: Record<string, { dtype?: string; _type?: string }>;
      num_rows?: number;
      dataset_size?: number;
    }
  >;
}

interface HFRowsResponse {
  features?: Array<{ feature_idx: number; name: string; type: { dtype?: string; _type?: string } }>;
  rows?: Array<{ row_idx: number; row: Record<string, unknown> }>;
  num_rows_total?: number;
}

export const huggingFaceAdapter: SourceAdapter = {
  source: "huggingface",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    const url = `${BASE}?search=${encodeURIComponent(query)}&limit=${limit}&full=true`;
    const data = await fetchJSON<HFDataset[]>(url, { headers: authHeaders() });

    return data.map((d) => {
      const license = Array.isArray(d.cardData?.license)
        ? d.cardData.license.join(", ")
        : d.cardData?.license;

      return {
        source: "huggingface" as const,
        id: d.id,
        name: d.id,
        description: d.description?.slice(0, 300) ?? "",
        url: `https://huggingface.co/datasets/${d.id}`,
        license,
        tags: d.tags,
        lastUpdated: d.lastModified,
        popularity: {
          downloads: d.downloads,
          likes: d.likes,
        },
      };
    });
  },

  async getDetails(datasetId: string): Promise<DatasetDetails> {
    const [meta, info] = await Promise.all([
      fetchJSON<HFDataset>(`${BASE}/${datasetId}`, { headers: authHeaders() }),
      fetchJSON<HFInfoResponse>(
        `${DATASETS_SERVER}/info?dataset=${encodeURIComponent(datasetId)}`,
        { headers: authHeaders() },
      ).catch(() => null),
    ]);

    const firstSplit = info?.dataset_info
      ? Object.values(info.dataset_info)[0]
      : undefined;

    const columns = firstSplit?.features
      ? Object.entries(firstSplit.features).map(([name, f]) => ({
          name,
          type: f.dtype ?? f._type,
        }))
      : undefined;

    const license = Array.isArray(meta.cardData?.license)
      ? meta.cardData.license.join(", ")
      : meta.cardData?.license;

    return {
      source: "huggingface",
      id: meta.id,
      name: meta.id,
      description: meta.description?.slice(0, 500) ?? "",
      url: `https://huggingface.co/datasets/${meta.id}`,
      license,
      tags: meta.tags,
      lastUpdated: meta.lastModified,
      columns,
      rowCount: firstSplit?.num_rows,
      size: firstSplit?.dataset_size
        ? `${(firstSplit.dataset_size / 1e6).toFixed(1)} MB`
        : undefined,
      downloadUrl: `https://huggingface.co/datasets/${meta.id}/tree/main`,
      popularity: {
        downloads: meta.downloads,
        likes: meta.likes,
      },
    };
  },

  async preview(datasetId: string, rows: number): Promise<PreviewResult> {
    const url =
      `${DATASETS_SERVER}/rows?dataset=${encodeURIComponent(datasetId)}` +
      `&config=default&split=train&offset=0&length=${rows}`;

    const data = await fetchJSON<HFRowsResponse>(url, { headers: authHeaders() });

    const columns = (data.features ?? []).map((f) => ({
      name: f.name,
      type: f.type?.dtype ?? f.type?._type,
    }));

    const parsedRows = (data.rows ?? []).map((r) => r.row);

    return {
      source: "huggingface",
      id: datasetId,
      columns,
      rows: parsedRows,
      totalRows: data.num_rows_total,
    };
  },

  async getPopularity(datasetId: string): Promise<PopularityMetrics> {
    const meta = await fetchJSON<HFDataset>(`${BASE}/${datasetId}`, {
      headers: authHeaders(),
    });
    return {
      downloads: meta.downloads,
      likes: meta.likes,
    };
  },
};
