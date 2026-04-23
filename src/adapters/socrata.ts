import type { DatasetResult, DatasetDetails, SourceAdapter, ColumnInfo } from "../types.js";
import { fetchJSON } from "../utils/http.js";

const DISCOVERY_BASE = "https://api.us.socrata.com/api/catalog/v1";

interface SocrataResult {
  resource: {
    id: string;
    name: string;
    description?: string;
    type: string;
    updatedAt?: string;
    columns_name?: string[];
    columns_datatype?: string[];
    download_count?: number;
    page_views_total?: number;
  };
  classification?: {
    domain_tags?: string[];
    domain_category?: string;
  };
  metadata?: {
    domain?: string;
    license?: string;
  };
  permalink?: string;
  link?: string;
}

interface SocrataSearchResponse {
  results: SocrataResult[];
  resultSetSize: number;
}

function socrataHeaders(): Record<string, string> {
  const token = process.env.SOCRATA_APP_TOKEN;
  return token ? { "X-App-Token": token } : {};
}

export const socrataAdapter: SourceAdapter = {
  source: "socrata",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    try {
      const url = `${DISCOVERY_BASE}?q=${encodeURIComponent(query)}&limit=${limit}&only=datasets`;
      const data = await fetchJSON<SocrataSearchResponse>(url, {
        headers: socrataHeaders(),
        timeoutMs: 15_000,
      });

      return (data.results ?? []).map((r) => ({
        source: "socrata" as const,
        id: r.resource.id,
        name: r.resource.name,
        description: (r.resource.description ?? "").slice(0, 300),
        url: r.permalink ?? r.link ?? `https://data.${r.metadata?.domain ?? "socrata.com"}/d/${r.resource.id}`,
        license: r.metadata?.license,
        tags: [
          ...(r.classification?.domain_tags ?? []),
          r.classification?.domain_category,
        ].filter(Boolean) as string[],
        lastUpdated: r.resource.updatedAt,
        popularity: {
          downloads: r.resource.download_count,
          views: r.resource.page_views_total,
        },
      }));
    } catch {
      return [];
    }
  },

  async getDetails(datasetId: string): Promise<DatasetDetails> {
    const url = `${DISCOVERY_BASE}?ids=${encodeURIComponent(datasetId)}`;
    const data = await fetchJSON<SocrataSearchResponse>(url, {
      headers: socrataHeaders(),
      timeoutMs: 15_000,
    });

    const r = data.results?.[0];
    if (!r) throw new Error(`Socrata dataset "${datasetId}" not found.`);

    let columns: ColumnInfo[] | undefined;
    if (r.resource.columns_name) {
      columns = r.resource.columns_name.map((name, i) => ({
        name,
        type: r.resource.columns_datatype?.[i],
      }));
    }

    const domain = r.metadata?.domain ?? "data.socrata.com";

    return {
      source: "socrata",
      id: r.resource.id,
      name: r.resource.name,
      description: (r.resource.description ?? "").slice(0, 500),
      url: r.permalink ?? r.link ?? `https://${domain}/d/${r.resource.id}`,
      license: r.metadata?.license,
      tags: [
        ...(r.classification?.domain_tags ?? []),
        r.classification?.domain_category,
      ].filter(Boolean) as string[],
      lastUpdated: r.resource.updatedAt,
      columns,
      downloadUrl: `https://${domain}/api/views/${r.resource.id}/rows.csv?accessType=DOWNLOAD`,
    };
  },
};
