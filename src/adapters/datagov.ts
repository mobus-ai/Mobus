import type {
  DatasetResult,
  DatasetDetails,
  SourceAdapter,
  PreviewResult,
} from "../types.js";
import { fetchJSON } from "../utils/http.js";
import { fetchCSVPreview } from "../utils/csv-parser.js";

const BASE = "https://catalog.data.gov/api/3/action";

interface CKANSearchResponse {
  result: {
    results: CKANPackage[];
  };
}

interface CKANPackage {
  id: string;
  name: string;
  title: string;
  notes?: string;
  license_title?: string;
  tags?: { name: string }[];
  metadata_modified?: string;
  resources?: CKANResource[];
  num_resources?: number;
}

interface CKANResource {
  id: string;
  name: string;
  format?: string;
  url?: string;
  size?: number;
}

interface CKANShowResponse {
  result: CKANPackage;
}

export const dataGovAdapter: SourceAdapter = {
  source: "datagov",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    const url = `${BASE}/package_search?q=${encodeURIComponent(query)}&rows=${limit}`;
    const data = await fetchJSON<CKANSearchResponse>(url);

    return data.result.results.map((pkg) => ({
      source: "datagov" as const,
      id: pkg.id,
      name: pkg.title || pkg.name,
      description: pkg.notes?.slice(0, 300) ?? "",
      url: `https://catalog.data.gov/dataset/${pkg.name}`,
      license: pkg.license_title,
      tags: pkg.tags?.map((t) => t.name),
      lastUpdated: pkg.metadata_modified,
    }));
  },

  async getDetails(datasetId: string): Promise<DatasetDetails> {
    const url = `${BASE}/package_show?id=${encodeURIComponent(datasetId)}`;
    const data = await fetchJSON<CKANShowResponse>(url);
    const pkg = data.result;

    const fileList = pkg.resources?.map(
      (r) => `${r.name || r.id} (${r.format ?? "unknown"})`,
    );

    const csvResource = pkg.resources?.find(
      (r) => r.format?.toLowerCase() === "csv" && r.url,
    );

    return {
      source: "datagov",
      id: pkg.id,
      name: pkg.title || pkg.name,
      description: pkg.notes?.slice(0, 500) ?? "",
      url: `https://catalog.data.gov/dataset/${pkg.name}`,
      license: pkg.license_title,
      tags: pkg.tags?.map((t) => t.name),
      lastUpdated: pkg.metadata_modified,
      fileList,
      downloadUrl: csvResource?.url,
    };
  },

  async preview(datasetId: string, rows: number): Promise<PreviewResult> {
    const details = await this.getDetails(datasetId);
    if (!details.downloadUrl) {
      throw new Error(`No CSV resource found for data.gov dataset "${datasetId}".`);
    }

    const parsed = await fetchCSVPreview(details.downloadUrl, rows);
    return {
      source: "datagov",
      id: datasetId,
      columns: parsed.columns,
      rows: parsed.rows,
      totalRows: details.rowCount,
    };
  },
};
