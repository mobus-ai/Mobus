export const SEARCH_SOURCES = [
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
  "semantic-scholar",
  "arxiv",
  "census",
  "sec-edgar",
  "crossref",
  "harvard-dataverse",
  "openalex",
  "europepmc",
  "openreview",
  "datacite",
  "github",
  "huggingface-models",
  "openneuro",
] as const;

export const ENRICHMENT_SOURCES = [
  "unpaywall",
  "opencitations",
  "nih-icite",
] as const;

export type SearchSource = (typeof SEARCH_SOURCES)[number];
export type EnrichmentSource = (typeof ENRICHMENT_SOURCES)[number];
export type Source = SearchSource | EnrichmentSource;

/** @deprecated Use SEARCH_SOURCES instead */
export const SOURCES = SEARCH_SOURCES;

export interface PopularityMetrics {
  downloads?: number;
  likes?: number;
  views?: number;
  citations?: number;
}

export interface DatasetResult {
  source: SearchSource;
  id: string;
  name: string;
  description: string;
  url: string;
  license?: string;
  tags?: string[];
  lastUpdated?: string;
  popularity?: PopularityMetrics;
  authors?: string[];
  available_on?: SearchSource[];
  alternate_ids?: Array<{ source: SearchSource; id: string }>;
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
  source: SearchSource;
  id: string;
  columns: ColumnInfo[];
  rows: PreviewRow[];
  totalRows?: number;
}

export interface QualityReport {
  source: SearchSource;
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
  sources?: SearchSource[];
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
  source: SearchSource;
  search(query: string, limit: number): Promise<DatasetResult[]>;
  getDetails(datasetId: string): Promise<DatasetDetails>;
  preview?(datasetId: string, rows: number): Promise<PreviewResult>;
  getPopularity?(datasetId: string): Promise<PopularityMetrics>;
}

export interface EnrichmentResult {
  source: EnrichmentSource;
  doi: string;
  openAccessUrl?: string;
  pdfUrl?: string;
  license?: string;
  citationCount?: number;
  referenceCount?: number;
  citedByDois?: string[];
  referencesDois?: string[];
  [key: string]: unknown;
}

export interface EnrichmentAdapter {
  source: EnrichmentSource;
  enrich(doi: string): Promise<EnrichmentResult>;
}
