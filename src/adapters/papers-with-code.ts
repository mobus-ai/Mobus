import type {
  DatasetResult,
  DatasetDetails,
  SourceAdapter,
} from "../types.js";
import { fetchJSON, cachedFetchJSON } from "../utils/http.js";
import { CacheTTL } from "../utils/cache.js";

const BASE = "https://paperswithcode.com/api/v1";

interface PwcPaginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface PwcDataset {
  id: string;
  name: string;
  full_name?: string;
  url?: string;
  description?: string;
  homepage?: string;
  num_papers?: number;
  introduced_date?: string;
}

interface PwcPaper {
  id: string;
  arxiv_id?: string;
  title: string;
  abstract?: string;
  url_abs?: string;
  url_pdf?: string;
  authors?: string[];
  published?: string;
  conference?: string;
}

interface PwcTask {
  id: string;
  name: string;
  description?: string;
}

interface PwcEvalTable {
  id: number;
  task: string;
  dataset: string;
  description?: string;
}

interface PwcEvalResult {
  id: number;
  best_metric?: string;
  best_result?: string;
  paper?: string;
  methodology?: string;
}

export interface PwcDatasetPapers {
  dataset: PwcDataset;
  papers: PwcPaper[];
  totalPapers: number;
}

export interface PwcDatasetEvals {
  dataset: PwcDataset;
  evaluationTables: PwcEvalTable[];
}

// The Papers with Code API (paperswithcode.com/api/v1) was shut down after
// Hugging Face acquired PwC. All endpoints now redirect to HuggingFace's
// trending page and return HTML. All functions below return empty results
// gracefully until a replacement API is identified.

async function pwcFetch<T>(url: string, ttl: number): Promise<T | null> {
  try {
    return await cachedFetchJSON<T>(url, { cacheTtlMs: ttl });
  } catch {
    return null;
  }
}

export async function pwcSearchDatasets(
  query: string,
  limit: number,
): Promise<PwcDataset[]> {
  const url = `${BASE}/datasets/?q=${encodeURIComponent(query)}&items_per_page=${limit}&page=1`;
  const data = await pwcFetch<PwcPaginated<PwcDataset>>(url, CacheTTL.PWC_SEARCH);
  return data?.results ?? [];
}

export async function pwcGetDataset(datasetId: string): Promise<PwcDataset | null> {
  return pwcFetch<PwcDataset>(
    `${BASE}/datasets/${encodeURIComponent(datasetId)}/`,
    CacheTTL.PWC_DATASET,
  );
}

export async function pwcGetDatasetPapers(
  datasetId: string,
  limit: number = 20,
): Promise<PwcPaper[]> {
  const url = `${BASE}/datasets/${encodeURIComponent(datasetId)}/papers/?items_per_page=${limit}&page=1`;
  const data = await pwcFetch<PwcPaginated<PwcPaper>>(url, CacheTTL.PWC_SEARCH);
  return data?.results ?? [];
}

export async function pwcGetDatasetPaperCount(datasetId: string): Promise<number> {
  const url = `${BASE}/datasets/${encodeURIComponent(datasetId)}/papers/?items_per_page=1&page=1`;
  const data = await pwcFetch<PwcPaginated<PwcPaper>>(url, CacheTTL.PWC_PAPER_COUNT);
  return data?.count ?? 0;
}

export async function pwcGetPaperDatasets(paperId: string): Promise<PwcDataset[]> {
  const url = `${BASE}/papers/${encodeURIComponent(paperId)}/datasets/`;
  const data = await pwcFetch<PwcPaginated<PwcDataset>>(url, CacheTTL.PWC_SEARCH);
  return data?.results ?? [];
}

export async function pwcGetPaperTasks(paperId: string): Promise<PwcTask[]> {
  const url = `${BASE}/papers/${encodeURIComponent(paperId)}/tasks/`;
  const data = await pwcFetch<PwcPaginated<PwcTask>>(url, CacheTTL.PWC_SEARCH);
  return data?.results ?? [];
}

export async function pwcSearchPapers(
  query: string,
  limit: number = 10,
): Promise<PwcPaper[]> {
  const url = `${BASE}/papers/?q=${encodeURIComponent(query)}&items_per_page=${limit}&page=1`;
  const data = await pwcFetch<PwcPaginated<PwcPaper>>(url, CacheTTL.PWC_SEARCH);
  return data?.results ?? [];
}

export async function pwcGetTaskDatasets(taskId: string): Promise<PwcEvalTable[]> {
  const url = `${BASE}/tasks/${encodeURIComponent(taskId)}/evaluations/?items_per_page=50&page=1`;
  const data = await pwcFetch<PwcPaginated<PwcEvalTable>>(url, CacheTTL.PWC_SEARCH);
  return data?.results ?? [];
}

export async function pwcSearchTasks(
  query: string,
  limit: number = 10,
): Promise<PwcTask[]> {
  const url = `${BASE}/tasks/?q=${encodeURIComponent(query)}&items_per_page=${limit}&page=1`;
  const data = await pwcFetch<PwcPaginated<PwcTask>>(url, CacheTTL.PWC_SEARCH);
  return data?.results ?? [];
}

export async function pwcGetDatasetEvaluations(
  datasetId: string,
  limit: number = 20,
): Promise<PwcEvalTable[]> {
  const url = `${BASE}/datasets/${encodeURIComponent(datasetId)}/evaluations/?items_per_page=${limit}&page=1`;
  const data = await pwcFetch<PwcPaginated<PwcEvalTable>>(url, CacheTTL.PWC_SEARCH);
  return data?.results ?? [];
}

interface PwcEvalResultRow {
  id: number;
  metrics: Record<string, string>;
  methodology: string;
  uses_additional_data: boolean;
  paper?: string;
}

export async function pwcGetEvaluationResults(
  evalTableId: number,
  limit: number = 10,
): Promise<PwcEvalResultRow[]> {
  const url = `${BASE}/evaluations/${evalTableId}/results/?items_per_page=${limit}&page=1`;
  const data = await cachedFetchJSON<PwcPaginated<PwcEvalResultRow>>(url, { cacheTtlMs: CacheTTL.PWC_SEARCH });
  return data.results;
}

export const papersWithCodeAdapter: SourceAdapter = {
  source: "papers-with-code",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    const datasets = await pwcSearchDatasets(query, limit);
    return datasets.map(toResult);
  },

  async getDetails(datasetId: string): Promise<DatasetDetails> {
    const d = await pwcGetDataset(datasetId);
    if (!d) throw new Error(`Papers with Code API is unavailable (API was shut down after HuggingFace acquisition). Dataset "${datasetId}" cannot be retrieved.`);

    const paperCount = await pwcGetDatasetPaperCount(datasetId);

    return {
      ...toResult(d),
      popularity: {
        citations: paperCount || d.num_papers,
      },
    };
  },
};

function toResult(d: PwcDataset): DatasetResult {
  return {
    source: "papers-with-code" as const,
    id: d.id,
    name: d.full_name ?? d.name,
    description: (d.description ?? "").slice(0, 300),
    url: d.homepage ?? d.url ?? `https://paperswithcode.com/dataset/${d.id}`,
    tags: [],
    lastUpdated: d.introduced_date,
    popularity: {
      citations: d.num_papers,
    },
  };
}
