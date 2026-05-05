import type {
  DatasetResult,
  DatasetDetails,
  SourceAdapter,
  PreviewResult,
  ColumnInfo,
} from "../types.js";
import { fetchJSON } from "../utils/http.js";

const BASE = "https://dataverse.harvard.edu/api";

const headers: Record<string, string> = {};
if (process.env.DATAVERSE_API_TOKEN) {
  headers["X-Dataverse-key"] = process.env.DATAVERSE_API_TOKEN;
}

// ─── Search API types ────────────────────────────────────────────────────────

interface DVSearchResponse {
  status: string;
  data: {
    q: string;
    total_count: number;
    items: DVSearchItem[];
  };
}

interface DVSearchItem {
  name: string;
  type: "dataverse" | "dataset" | "file";
  url: string;
  global_id?: string;
  description?: string;
  published_at?: string;
  publisher?: string;
  citation?: string;
  subjects?: string[];
  fileCount?: number;
  authors?: string[];
  updatedAt?: string;
  createdAt?: string;
}

// ─── Native API types ────────────────────────────────────────────────────────

interface DVDatasetResponse {
  status: string;
  data: {
    id: number;
    identifier: string;
    persistentUrl: string;
    publicationDate?: string;
    latestVersion: DVVersion;
  };
}

interface DVVersion {
  files: DVFile[];
  metadataBlocks: {
    citation: {
      fields: DVField[];
    };
  };
  versionState: string;
  createTime: string;
  lastUpdateTime: string;
  license?: { name?: string; uri?: string };
}

interface DVField {
  typeName: string;
  value: unknown;
  multiple: boolean;
  typeClass: string;
}

interface DVFile {
  dataFile: {
    id: number;
    filename: string;
    contentType: string;
    filesize: number;
    description?: string;
  };
}

// ─── Tabular data types ──────────────────────────────────────────────────────

interface DVTabularResponse {
  status: string;
  data: {
    dataVariables: DVVariable[];
  };
}

interface DVVariable {
  id: number;
  name: string;
  label?: string;
  variableFormatType?: { name?: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractField(fields: DVField[], name: string): unknown {
  return fields.find((f) => f.typeName === name)?.value;
}

function extractDescription(fields: DVField[]): string {
  const raw = extractField(fields, "dsDescription");
  if (!Array.isArray(raw) || raw.length === 0) return "";
  const first = raw[0];
  return (first?.dsDescriptionValue?.value as string) ?? "";
}

function extractKeywords(fields: DVField[]): string[] {
  const raw = extractField(fields, "keyword");
  if (!Array.isArray(raw)) return [];
  return raw
    .map((k: Record<string, { value?: string }>) => k?.keywordValue?.value)
    .filter((v): v is string => !!v);
}

function extractLicense(version: DVVersion): string | undefined {
  return version.license?.name;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1e6) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1e9) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1e9).toFixed(1)} GB`;
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

export const harvardDataverseAdapter: SourceAdapter = {
  source: "harvard-dataverse",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    const url =
      `${BASE}/search?q=${encodeURIComponent(query)}` +
      `&type=dataset&per_page=${limit}&sort=score&order=desc`;

    const resp = await fetchJSON<DVSearchResponse>(url, { headers });

    return resp.data.items
      .filter((item) => item.type === "dataset")
      .map((item) => ({
        source: "harvard-dataverse" as const,
        id: item.global_id ?? item.url,
        name: item.name,
        description: (item.description ?? "").slice(0, 300),
        url: item.url,
        tags: item.subjects,
        lastUpdated: item.updatedAt ?? item.published_at,
      }));
  },

  async getDetails(datasetId: string): Promise<DatasetDetails> {
    const url = `${BASE}/datasets/:persistentId/?persistentId=${encodeURIComponent(datasetId)}`;
    const resp = await fetchJSON<DVDatasetResponse>(url, { headers });

    const version = resp.data.latestVersion;
    const fields = version.metadataBlocks.citation.fields;

    const title = (extractField(fields, "title") as string) ?? "Untitled";
    const description = extractDescription(fields);
    const keywords = extractKeywords(fields);
    const license = extractLicense(version);

    const files = version.files ?? [];
    const fileList = files.map(
      (f) => `${f.dataFile.filename} (${formatBytes(f.dataFile.filesize)})`,
    );
    const totalSize = files.reduce((sum, f) => sum + f.dataFile.filesize, 0);

    const firstTabular = files.find(
      (f) =>
        f.dataFile.contentType === "text/tab-separated-values" ||
        f.dataFile.contentType === "text/csv",
    );

    let columns: ColumnInfo[] | undefined;
    if (firstTabular) {
      try {
        const varUrl = `${BASE}/access/datafile/${firstTabular.dataFile.id}/metadata`;
        const varResp = await fetchJSON<DVTabularResponse>(varUrl, { headers });
        columns = varResp.data.dataVariables.map((v) => ({
          name: v.name,
          type: v.variableFormatType?.name,
        }));
      } catch {
        // column metadata not available for this file
      }
    }

    return {
      source: "harvard-dataverse",
      id: datasetId,
      name: title,
      description: description.slice(0, 500),
      url: resp.data.persistentUrl,
      license,
      tags: keywords,
      lastUpdated: version.lastUpdateTime,
      fileList,
      size: totalSize ? formatBytes(totalSize) : undefined,
      columns,
      downloadUrl: firstTabular
        ? `${BASE}/access/datafile/${firstTabular.dataFile.id}`
        : files[0]
          ? `${BASE}/access/datafile/${files[0].dataFile.id}`
          : undefined,
    };
  },

  async preview(datasetId: string, rows: number): Promise<PreviewResult> {
    const detailUrl = `${BASE}/datasets/:persistentId/?persistentId=${encodeURIComponent(datasetId)}`;
    const resp = await fetchJSON<DVDatasetResponse>(detailUrl, { headers });
    const files = resp.data.latestVersion.files ?? [];

    const tabular = files.find(
      (f) =>
        f.dataFile.contentType === "text/tab-separated-values" ||
        f.dataFile.contentType === "text/csv",
    );

    if (!tabular) {
      return {
        source: "harvard-dataverse",
        id: datasetId,
        columns: [],
        rows: [],
        totalRows: 0,
      };
    }

    const csvUrl = `${BASE}/access/datafile/${tabular.dataFile.id}?format=original`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    try {
      const res = await fetch(csvUrl, {
        headers: { ...headers, Accept: "text/csv,text/tab-separated-values,*/*" },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const text = await res.text();
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length === 0) {
        return { source: "harvard-dataverse", id: datasetId, columns: [], rows: [] };
      }

      const sep = lines[0].includes("\t") ? "\t" : ",";
      const headerRow = lines[0].split(sep).map((h) => h.trim().replace(/^"|"$/g, ""));
      const cols: ColumnInfo[] = headerRow.map((name) => ({ name }));

      const dataRows = lines.slice(1, rows + 1).map((line) => {
        const values = line.split(sep).map((v) => v.trim().replace(/^"|"$/g, ""));
        const row: Record<string, unknown> = {};
        headerRow.forEach((col, i) => {
          row[col] = values[i] ?? "";
        });
        return row;
      });

      return {
        source: "harvard-dataverse",
        id: datasetId,
        columns: cols,
        rows: dataRows,
        totalRows: lines.length - 1,
      };
    } finally {
      clearTimeout(timer);
    }
  },
};
