export const SOURCES = [
  "kaggle",
  "huggingface",
  "datagov",
  "zenodo",
  "openml",
  "uci",
  "google",
  "aws",
  "worldbank",
  "who",
  "nasa",
  "eurostat",
  "socrata",
  "papers-with-code",
  "semantic-scholar",
  "arxiv",
  "census",
  "sec-edgar",
  "crossref",
  "econdb",
] as const;

export type Source = (typeof SOURCES)[number];

export interface PopularityMetrics {
  downloads?: number;
  likes?: number;
  views?: number;
  citations?: number;
}

export interface DatasetResult {
  source: Source;
  id: string;
  name: string;
  description: string;
  url: string;
  license?: string;
  tags?: string[];
  lastUpdated?: string;
  popularity?: PopularityMetrics;
}

export interface ColumnInfo {
  name: string;
  type?: string;
}

export interface DatasetDetails extends DatasetResult {
  columns?: ColumnInfo[];
  rowCount?: number;
  fileList?: string[];
  size?: string;
  downloadUrl?: string;
}

export interface PreviewRow {
  [column: string]: unknown;
}

export interface PreviewResult {
  source: Source;
  id: string;
  columns: ColumnInfo[];
  rows: PreviewRow[];
  totalRows?: number;
}

export interface QualityReport {
  source: Source;
  id: string;
  sampleSize: number;
  totalRows?: number;
  columns: Array<{
    name: string;
    type?: string;
    missingCount: number;
    missingPct: number;
    uniqueCount: number;
    min?: number;
    max?: number;
    mean?: number;
  }>;
  duplicateRows: number;
  duplicateRowPct: number;
  freshness?: { newestRecord?: string; oldestRecord?: string };
}

export interface WatchEntry {
  id: string;
  query: string;
  sources?: Source[];
  createdAt: string;
  lastCheckedAt?: string;
  lastResultIds?: string[];
}

export interface LicenseInfo {
  spdxId: string;
  name: string;
  commercialUse: boolean;
  attribution: boolean;
  shareAlike: boolean;
  redistribution: boolean;
  patentGrant: boolean;
  summary: string;
}

export interface SourceAdapter {
  source: Source;
  search(query: string, limit: number): Promise<DatasetResult[]>;
  getDetails(datasetId: string): Promise<DatasetDetails>;
  preview?(datasetId: string, rows: number): Promise<PreviewResult>;
  getPopularity?(datasetId: string): Promise<PopularityMetrics>;
}
