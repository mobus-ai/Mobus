import type { DatasetResult, DatasetDetails, SourceAdapter } from "../types.js";
import { fetchJSON } from "../utils/http.js";

const BASE = "https://api.worldbank.org/v2";

interface WBIndicator {
  id: string;
  name: string;
  sourceNote?: string;
  sourceOrganization?: string;
  topics?: Array<{ id: string; value: string }>;
}

type WBResponse = [{ page: number; pages: number; total: number }, WBIndicator[]];

export const worldBankAdapter: SourceAdapter = {
  source: "worldbank",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    try {
      const url = `${BASE}/indicator?format=json&per_page=${limit}&qterm=${encodeURIComponent(query)}`;
      const data = await fetchJSON<WBResponse>(url);

      if (!Array.isArray(data) || data.length < 2 || !Array.isArray(data[1])) {
        return [];
      }

      return data[1].map((ind) => ({
        source: "worldbank" as const,
        id: ind.id,
        name: ind.name,
        description: (ind.sourceNote ?? "").slice(0, 300),
        url: `https://data.worldbank.org/indicator/${ind.id}`,
        tags: ind.topics?.map((t) => t.value).filter(Boolean),
      }));
    } catch {
      return [];
    }
  },

  async getDetails(datasetId: string): Promise<DatasetDetails> {
    const url = `${BASE}/indicator/${encodeURIComponent(datasetId)}?format=json`;
    const data = await fetchJSON<WBResponse>(url);

    if (!Array.isArray(data) || data.length < 2 || !data[1]?.[0]) {
      throw new Error(`World Bank indicator "${datasetId}" not found.`);
    }

    const ind = data[1][0];
    return {
      source: "worldbank",
      id: ind.id,
      name: ind.name,
      description: (ind.sourceNote ?? "").slice(0, 500),
      url: `https://data.worldbank.org/indicator/${ind.id}`,
      tags: ind.topics?.map((t) => t.value).filter(Boolean),
      downloadUrl: `https://api.worldbank.org/v2/indicator/${ind.id}?downloadformat=csv`,
    };
  },
};
