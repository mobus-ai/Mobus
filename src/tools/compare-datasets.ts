import type { DatasetDetails, SearchSource, SourceAdapter } from "../types.js";

export interface DatasetRef {
  source: SearchSource;
  dataset_id: string;
}

export interface ComparisonResult {
  datasets: Array<{
    source: SearchSource;
    id: string;
    name: string;
    columns: string[];
    rowCount?: number;
    size?: string;
    license?: string;
    lastUpdated?: string;
    format?: string;
  }>;
  columnOverlap: {
    shared: string[];
    jaccardSimilarity: number;
  };
  summary: string;
}

export async function compareDatasets(
  adapters: Map<SearchSource, SourceAdapter>,
  refs: DatasetRef[],
): Promise<ComparisonResult> {
  const settled = await Promise.allSettled(
    refs.map(async (ref) => {
      const adapter = adapters.get(ref.source);
      if (!adapter) {
        throw new Error(`Adapter "${ref.source}" is not available.`);
      }
      return adapter.getDetails(ref.dataset_id);
    }),
  );

  const details: DatasetDetails[] = [];
  const errors: string[] = [];

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    if (outcome.status === "fulfilled") {
      details.push(outcome.value);
    } else {
      errors.push(`${refs[i].source}/${refs[i].dataset_id}: ${outcome.reason?.message}`);
    }
  }

  if (errors.length > 0 && details.length < 2) {
    throw new Error(`Could not fetch enough datasets to compare. Errors: ${errors.join("; ")}`);
  }

  const datasets = details.map((d) => ({
    source: d.source,
    id: d.id,
    name: d.name,
    columns: d.columns?.map((c) => c.name) ?? [],
    rowCount: d.rowCount,
    size: d.size,
    license: d.license,
    lastUpdated: d.lastUpdated,
    format: inferFormat(d),
  }));

  const allColumnSets = datasets.map((d) => new Set(d.columns.map((c) => c.toLowerCase())));
  const shared = [...allColumnSets[0]].filter((col) =>
    allColumnSets.every((s) => s.has(col)),
  );
  const union = new Set(allColumnSets.flatMap((s) => [...s]));
  const jaccardSimilarity =
    union.size > 0 ? Math.round((shared.length / union.size) * 10000) / 10000 : 0;

  const summaryParts: string[] = [];
  summaryParts.push(`Comparing ${datasets.length} datasets.`);
  summaryParts.push(`${shared.length} shared column(s) out of ${union.size} total unique columns (Jaccard: ${jaccardSimilarity}).`);

  if (errors.length > 0) {
    summaryParts.push(`Warnings: ${errors.join("; ")}`);
  }

  return {
    datasets,
    columnOverlap: { shared, jaccardSimilarity },
    summary: summaryParts.join(" "),
  };
}

function inferFormat(d: DatasetDetails): string {
  if (d.downloadUrl?.endsWith(".csv")) return "csv";
  if (d.downloadUrl?.endsWith(".parquet")) return "parquet";
  if (d.downloadUrl?.endsWith(".json")) return "json";
  if (d.fileList?.some((f) => f.toLowerCase().includes("csv"))) return "csv";
  if (d.fileList?.some((f) => f.toLowerCase().includes("parquet"))) return "parquet";
  return "unknown";
}
