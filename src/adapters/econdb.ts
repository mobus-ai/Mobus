import type {
  DatasetResult,
  DatasetDetails,
  SourceAdapter,
} from "../types.js";
import { fetchJSON } from "../utils/http.js";

const BASE = "https://www.econdb.com/api";

interface EcondbSeriesResponse {
  results: EcondbSeries[];
  count?: number;
}

interface EcondbSeries {
  ticker: string;
  description: string;
  geography?: string;
  frequency?: string;
  dataset?: string;
  units?: string;
  seasonal_adjustment?: string;
  additional_metadata?: Record<string, string>;
}

interface EcondbDatasetResponse {
  results: EcondbDataset[];
  count?: number;
}

interface EcondbDataset {
  id: string;
  name: string;
  description?: string;
}

function seriesUrl(ticker: string): string {
  return `https://www.econdb.com/series/${ticker}/`;
}

export const econdbAdapter: SourceAdapter = {
  source: "econdb",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    try {
      const url = `${BASE}/series/?search=${encodeURIComponent(query)}&format=json&page_size=${limit}`;
      const data = await fetchJSON<EcondbSeriesResponse>(url, { timeoutMs: 15_000 });

      return (data.results ?? []).slice(0, limit).map((s) => {
        const desc = [
          s.description,
          s.geography && `Geography: ${s.geography}`,
          s.frequency && `Frequency: ${s.frequency}`,
          s.units && `Units: ${s.units}`,
        ]
          .filter(Boolean)
          .join(". ");

        return {
          source: "econdb" as const,
          id: s.ticker,
          name: s.description || s.ticker,
          description: desc.slice(0, 300),
          url: seriesUrl(s.ticker),
          tags: [s.dataset, s.geography, s.frequency].filter(Boolean) as string[],
        };
      });
    } catch {
      return [];
    }
  },

  async getDetails(ticker: string): Promise<DatasetDetails> {
    const url = `${BASE}/series/${encodeURIComponent(ticker)}/?format=json`;
    const s = await fetchJSON<EcondbSeries>(url, { timeoutMs: 15_000 });

    const desc = [
      s.description,
      s.geography && `Geography: ${s.geography}`,
      s.frequency && `Frequency: ${s.frequency}`,
      s.units && `Units: ${s.units}`,
      s.seasonal_adjustment && `Seasonal adjustment: ${s.seasonal_adjustment}`,
    ]
      .filter(Boolean)
      .join(". ");

    return {
      source: "econdb",
      id: s.ticker,
      name: s.description || s.ticker,
      description: desc.slice(0, 500),
      url: seriesUrl(s.ticker),
      tags: [s.dataset, s.geography, s.frequency].filter(Boolean) as string[],
      downloadUrl: `${BASE}/series/${encodeURIComponent(s.ticker)}/?format=json`,
    };
  },
};
