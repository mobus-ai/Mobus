import type {
  DatasetResult,
  DatasetDetails,
  SourceAdapter,
} from "../types.js";
import { fetchJSON } from "../utils/http.js";

const SEARCH_BASE = "https://efts.sec.gov/LATEST/search-index";
const USER_AGENT = "mobus-mcp/1.0 (dataset-search; contact@mobus.ai)";

interface EdgarSearchResponse {
  hits: {
    hits: EdgarHit[];
    total: { value: number };
  };
}

interface EdgarHit {
  _id: string;
  _source: {
    display_names?: string[];
    entity_name?: string;
    file_description?: string;
    file_type?: string;
    period_of_report?: string;
    file_date?: string;
    display_date_filed?: string;
    file_num?: string[];
    biz_locations?: string;
  };
}

function buildUrl(query: string, limit: number): string {
  const params = new URLSearchParams({
    q: `"${query}"`,
    from: "0",
    size: String(Math.min(limit, 40)),
  });
  return `${SEARCH_BASE}?${params}`;
}

function filingUrl(hit: EdgarHit): string {
  const accession = hit._id.replace(/-/g, "");
  return `https://www.sec.gov/Archives/edgar/data/${accession.slice(0, 10)}/${hit._id}.txt`;
}

export const secEdgarAdapter: SourceAdapter = {
  source: "sec-edgar",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    try {
      const data = await fetchJSON<EdgarSearchResponse>(buildUrl(query, limit), {
        headers: { "User-Agent": USER_AGENT },
        timeoutMs: 15_000,
      });

      return data.hits.hits.slice(0, limit).map((hit) => {
        const s = hit._source;
        const name = s.entity_name ?? s.display_names?.[0] ?? hit._id;
        const desc = [
          s.file_type && `Form: ${s.file_type}`,
          s.file_description,
          s.period_of_report && `Period: ${s.period_of_report}`,
          s.biz_locations && `Location: ${s.biz_locations}`,
        ]
          .filter(Boolean)
          .join(" | ");

        return {
          source: "sec-edgar" as const,
          id: hit._id,
          name,
          description: desc.slice(0, 300),
          url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(query)}&type=&dateb=&owner=include&count=${limit}&search_text=&action=getcompany`,
          tags: s.file_type ? [s.file_type] : undefined,
          lastUpdated: s.display_date_filed ?? s.file_date,
        };
      });
    } catch {
      return [];
    }
  },

  async getDetails(datasetId: string): Promise<DatasetDetails> {
    const data = await fetchJSON<EdgarSearchResponse>(
      `${SEARCH_BASE}?q="${datasetId}"&from=0&size=1`,
      { headers: { "User-Agent": USER_AGENT }, timeoutMs: 15_000 },
    );

    const hit = data.hits.hits[0];
    if (!hit) throw new Error(`SEC EDGAR filing "${datasetId}" not found`);

    const s = hit._source;
    return {
      source: "sec-edgar",
      id: hit._id,
      name: s.entity_name ?? s.display_names?.[0] ?? hit._id,
      description: [
        s.file_type && `Form: ${s.file_type}`,
        s.file_description,
        s.period_of_report && `Period: ${s.period_of_report}`,
        s.biz_locations && `Location: ${s.biz_locations}`,
      ]
        .filter(Boolean)
        .join(" | "),
      url: filingUrl(hit),
      tags: s.file_type ? [s.file_type] : undefined,
      lastUpdated: s.display_date_filed ?? s.file_date,
      downloadUrl: filingUrl(hit),
    };
  },
};
