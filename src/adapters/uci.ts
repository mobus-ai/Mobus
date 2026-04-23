import type { DatasetResult, DatasetDetails, SourceAdapter } from "../types.js";
import { fetchJSON } from "../utils/http.js";

const BASE = "https://archive.ics.uci.edu/api";

// List endpoint: /api/datasets/list?search=QUERY&filter=python
// Single dataset: /api/dataset?id=ID or ?name=NAME
interface UCIListResponse {
  status: number;
  data: UCIListItem[];
}

interface UCIListItem {
  id: number;
  name: string;
  url?: string;
  description?: string;
}

interface UCIDetailResponse {
  status: number;
  data: UCIDatasetDetail;
}

interface UCIDatasetDetail {
  uci_id: number;
  name: string;
  abstract?: string;
  area?: string;
  task?: string;
  num_instances?: number;
  num_attributes?: number;
  date_donated?: string;
  variables?: UCIVariable[];
  external_url?: string;
  data_url?: string;
}

interface UCIVariable {
  name: string;
  role?: string;
  type?: string;
  description?: string;
}

export const uciAdapter: SourceAdapter = {
  source: "uci",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    const url = `${BASE}/datasets/list?search=${encodeURIComponent(query)}&filter=python`;
    try {
      const data = await fetchJSON<UCIListResponse>(url, { timeoutMs: 15_000 });
      if (data.status !== 200) return [];

      return (data.data ?? []).slice(0, limit).map((d) => ({
        source: "uci" as const,
        id: String(d.id),
        name: d.name,
        description: (d.description ?? "").slice(0, 300),
        url: `https://archive.ics.uci.edu/dataset/${d.id}`,
      }));
    } catch {
      return [];
    }
  },

  async getDetails(datasetId: string): Promise<DatasetDetails> {
    const url = `${BASE}/dataset?id=${encodeURIComponent(datasetId)}`;
    const data = await fetchJSON<UCIDetailResponse>(url, { timeoutMs: 15_000 });
    if (data.status !== 200 || !data.data) {
      throw new Error(`UCI dataset "${datasetId}" not found`);
    }
    const d = data.data;

    const columns = d.variables?.map((v) => ({
      name: v.name,
      type: v.type,
    }));

    return {
      source: "uci",
      id: String(d.uci_id),
      name: d.name,
      description: (d.abstract ?? "").slice(0, 500),
      url: `https://archive.ics.uci.edu/dataset/${d.uci_id}`,
      tags: [d.area, d.task].filter(Boolean) as string[],
      lastUpdated: d.date_donated,
      columns,
      rowCount: d.num_instances ?? undefined,
      downloadUrl: d.data_url ?? d.external_url,
    };
  },
};
