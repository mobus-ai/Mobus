import type {
  DatasetResult,
  DatasetDetails,
  SourceAdapter,
} from "../types.js";
import { fetchJSON } from "../utils/http.js";

const BASE = "https://api.github.com";

interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepo[];
}

interface GitHubRepo {
  id: number;
  full_name: string;
  description: string | null;
  html_url: string;
  topics: string[];
  license: { spdx_id: string; name: string } | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  language: string | null;
  size: number;
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    h["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return h;
}

export const githubAdapter: SourceAdapter = {
  source: "github",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    try {
      const url =
        `${BASE}/search/repositories?q=${encodeURIComponent(query)}` +
        `&sort=stars&per_page=${limit}`;

      const data = await fetchJSON<GitHubSearchResponse>(url, {
        headers: authHeaders(),
      });

      return data.items.map((item) => ({
        source: "github" as const,
        id: item.full_name,
        name: item.full_name,
        description: (item.description ?? "").slice(0, 300),
        url: item.html_url,
        license: item.license?.spdx_id,
        tags: item.topics,
        lastUpdated: item.updated_at,
        popularity: {
          likes: item.stargazers_count,
        },
      }));
    } catch {
      return [];
    }
  },

  async getDetails(datasetId: string): Promise<DatasetDetails> {
    const url = `${BASE}/repos/${datasetId}`;
    const r = await fetchJSON<GitHubRepo>(url, { headers: authHeaders() });

    return {
      source: "github",
      id: r.full_name,
      name: r.full_name,
      description: (r.description ?? "").slice(0, 500),
      url: r.html_url,
      license: r.license?.spdx_id,
      tags: r.topics,
      lastUpdated: r.updated_at,
      downloadUrl: r.html_url,
      size: `${r.size} KB`,
      popularity: {
        likes: r.stargazers_count,
      },
    };
  },
};
