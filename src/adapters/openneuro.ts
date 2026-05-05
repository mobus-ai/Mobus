import type {
  DatasetResult,
  DatasetDetails,
  SourceAdapter,
  PopularityMetrics,
} from "../types.js";

const ENDPOINT = "https://openneuro.org/crn/graphql";
const TIMEOUT_MS = 15_000;

interface ONDescription {
  Name?: string;
  Authors?: string[];
  License?: string;
  DatasetDOI?: string;
}

interface ONSummary {
  modalities?: string[];
  subjects?: string[];
  size?: number;
  totalFiles?: number;
  tasks?: string[];
}

interface ONSnapshot {
  tag?: string;
  description?: ONDescription;
  summary?: ONSummary;
  readme?: string;
}

interface ONAnalytics {
  downloads?: number;
  views?: number;
}

interface ONDataset {
  id: string;
  name: string;
  publishDate?: string;
  latestSnapshot?: ONSnapshot;
  analytics?: ONAnalytics;
}

interface ONSearchEdge {
  node?: ONDataset | null;
}

interface ONGraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; path?: (string | number)[] }>;
}

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`OpenNeuro HTTP ${res.status}`);
    const json = (await res.json()) as ONGraphQLResponse<T>;
    if (!json.data) {
      const msg = json.errors?.[0]?.message ?? "Unknown OpenNeuro error";
      throw new Error(msg);
    }
    return json.data;
  } finally {
    clearTimeout(timer);
  }
}

const SEARCH_QUERY = `
  query Search($keywords: [String!], $first: Int) {
    advancedSearch(query: { keywords: $keywords }, first: $first) {
      edges {
        node {
          id
          name
          publishDate
          latestSnapshot {
            tag
            description { Name Authors License DatasetDOI }
            summary { modalities subjects size tasks }
          }
          analytics { downloads views }
        }
      }
    }
  }
`;

const DETAILS_QUERY = `
  query Details($id: ID!) {
    dataset(id: $id) {
      id
      name
      publishDate
      latestSnapshot {
        tag
        description { Name Authors License DatasetDOI }
        summary { modalities subjects size totalFiles tasks }
        readme
      }
      analytics { downloads views }
    }
  }
`;

function datasetUrl(id: string, tag?: string): string {
  return tag
    ? `https://openneuro.org/datasets/${id}/versions/${tag}`
    : `https://openneuro.org/datasets/${id}`;
}

function buildDescription(d: ONDataset): string {
  const s = d.latestSnapshot?.summary;
  const parts: string[] = [];
  if (s?.modalities?.length) parts.push(`Modalities: ${s.modalities.join(", ")}`);
  if (s?.subjects?.length) parts.push(`${s.subjects.length} subjects`);
  if (s?.tasks?.length) parts.push(`Tasks: ${s.tasks.slice(0, 3).join(", ")}`);
  return parts.join(" · ");
}

function toResult(d: ONDataset): DatasetResult {
  const tag = d.latestSnapshot?.tag;
  const desc = d.latestSnapshot?.description;
  const summary = d.latestSnapshot?.summary;
  return {
    source: "openneuro" as const,
    id: d.id,
    name: desc?.Name ?? d.name,
    description: buildDescription(d).slice(0, 300),
    url: datasetUrl(d.id, tag),
    license: desc?.License,
    tags: summary?.modalities,
    lastUpdated: d.publishDate,
    authors: desc?.Authors,
    popularity: {
      downloads: d.analytics?.downloads,
      views: d.analytics?.views,
    },
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1e6) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1e9) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1e9).toFixed(1)} GB`;
}

export const openNeuroAdapter: SourceAdapter = {
  source: "openneuro",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    try {
      const keywords = query
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 0);
      if (keywords.length === 0) return [];

      const data = await gql<{ advancedSearch: { edges: ONSearchEdge[] } }>(
        SEARCH_QUERY,
        { keywords, first: limit },
      );

      return (data.advancedSearch.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is ONDataset => n != null)
        .map(toResult);
    } catch {
      return [];
    }
  },

  async getDetails(datasetId: string): Promise<DatasetDetails> {
    const data = await gql<{ dataset: ONDataset | null }>(DETAILS_QUERY, {
      id: datasetId,
    });
    if (!data.dataset) {
      throw new Error(`OpenNeuro dataset "${datasetId}" not found`);
    }

    const d = data.dataset;
    const base = toResult(d);
    const summary = d.latestSnapshot?.summary;
    const readme = d.latestSnapshot?.readme;

    return {
      ...base,
      description: (readme?.slice(0, 500) ?? base.description).trim(),
      size: summary?.size ? formatBytes(summary.size) : undefined,
      downloadUrl: datasetUrl(d.id, d.latestSnapshot?.tag),
    };
  },

  async getPopularity(datasetId: string): Promise<PopularityMetrics> {
    const data = await gql<{ dataset: { analytics?: ONAnalytics } | null }>(
      `query($id: ID!) { dataset(id: $id) { analytics { downloads views } } }`,
      { id: datasetId },
    );
    return {
      downloads: data.dataset?.analytics?.downloads,
      views: data.dataset?.analytics?.views,
    };
  },
};
