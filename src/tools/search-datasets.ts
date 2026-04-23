import type { DatasetResult, Source, SourceAdapter } from "../types.js";

export interface SearchFilters {
  license?: string;
  minRows?: number;
  format?: string;
  updatedAfter?: string;
  modality?: string;
}

export async function searchDatasets(
  adapters: Map<Source, SourceAdapter>,
  query: string,
  sources: Source[] | undefined,
  limit: number,
  filters?: SearchFilters,
): Promise<{ results: DatasetResult[]; errors: Record<string, string> }> {
  const selected = sources ?? [...adapters.keys()];
  const errors: Record<string, string> = {};

  const settled = await Promise.allSettled(
    selected.map(async (src) => {
      const adapter = adapters.get(src);
      if (!adapter) {
        throw new Error(`Adapter "${src}" is not available (missing API key?)`);
      }
      return adapter.search(query, limit);
    }),
  );

  let results: DatasetResult[] = [];

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    const src = selected[i];
    if (outcome.status === "fulfilled") {
      results.push(...outcome.value);
    } else {
      errors[src] = outcome.reason?.message ?? String(outcome.reason);
    }
  }

  if (filters) {
    results = applyFilters(results, filters);
  }

  return { results, errors };
}

function applyFilters(results: DatasetResult[], filters: SearchFilters): DatasetResult[] {
  return results.filter((r) => {
    if (filters.license) {
      if (!r.license) return false;
      if (!r.license.toLowerCase().includes(filters.license.toLowerCase())) return false;
    }

    if (filters.updatedAfter) {
      if (!r.lastUpdated) return false;
      const resultDate = new Date(r.lastUpdated);
      const filterDate = new Date(filters.updatedAfter);
      if (isNaN(resultDate.getTime()) || resultDate < filterDate) return false;
    }

    if (filters.format) {
      const fmt = filters.format.toLowerCase();
      const hasFmt = r.tags?.some((t) => t.toLowerCase().includes(fmt));
      if (!hasFmt) return false;
    }

    if (filters.modality) {
      const mod = filters.modality.toLowerCase();
      const hasMod = r.tags?.some((t) => t.toLowerCase().includes(mod));
      if (!hasMod) return false;
    }

    return true;
  });
}
