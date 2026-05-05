import type { SearchSource, SourceAdapter } from "../types.js";
import {
  s2SearchPapers,
  s2SemanticSearch,
  extractS2PaperMeta,
} from "../adapters/semantic-scholar.js";
import { getSearchVariants } from "../utils/dataset-aliases.js";

interface DatasetAction {
  tool: "preview_dataset" | "visualize_dataset" | "get_dataset_details" | "assess_quality" | "check_license";
  params: {
    source: SearchSource;
    dataset_id: string;
    [key: string]: unknown;
  };
  description: string;
}

interface ResearchDatasetResult {
  datasetId: string;
  datasetName: string;
  datasetUrl: string;
  paperCount: number;
  samplePapers: Array<{
    title: string;
    year?: number;
    venue?: string;
    citationCount?: number;
    fieldsOfStudy?: string[];
    publicationTypes?: string[];
    authors: string[];
    url?: string;
    arxivId?: string;
  }>;
  tasks: string[];
  availableOn: Array<{ source: SearchSource; id: string; url: string }>;
  actions: DatasetAction[];
}

export async function findResearchDatasets(
  adapters: Map<SearchSource, SourceAdapter>,
  query: string,
  limit: number = 10,
  maxPapersPerDataset: number = 5,
  semantic: boolean = false,
): Promise<{
  query: string;
  datasets: ResearchDatasetResult[];
  relatedTasks: string[];
  errors: Record<string, string>;
}> {
  const errors: Record<string, string> = {};
  const datasetMap = new Map<string, {
    id: string;
    name: string;
    url: string;
    tasks: Set<string>;
    paperCount: number;
  }>();

  // Search Semantic Scholar for papers mentioning datasets related to the query
  try {
    const searchFn = semantic ? s2SemanticSearch : s2SearchPapers;
    const { papers } = await searchFn(`${query} dataset`, limit * 3);
    for (const p of papers) {
      const meta = extractS2PaperMeta(p);
      if (meta.publicationTypes?.includes("Dataset") || /dataset|benchmark|corpus/i.test(meta.title)) {
        const id = meta.paperId;
        if (!datasetMap.has(id)) {
          datasetMap.set(id, {
            id,
            name: meta.title,
            url: meta.url ?? `https://api.semanticscholar.org/graph/v1/paper/${id}`,
            tasks: new Set<string>(),
            paperCount: meta.citationCount ?? 0,
          });
        }
      }
    }
  } catch (err) {
    errors["semantic-scholar"] = (err as Error).message;
  }

  const ranked = [...datasetMap.values()]
    .sort((a, b) => b.paperCount - a.paperCount)
    .slice(0, limit);

  const results: ResearchDatasetResult[] = [];
  const enrichPromises = ranked.map(async (d) => {
    let samplePapers: ResearchDatasetResult["samplePapers"] = [];

    try {
      const searchFn = semantic ? s2SemanticSearch : s2SearchPapers;
      const { papers } = await searchFn(
        `"${d.name}" dataset`,
        maxPapersPerDataset,
      );
      samplePapers = papers.map((p) => {
        const meta = extractS2PaperMeta(p);
        return {
          title: meta.title,
          year: meta.year,
          venue: meta.venue ?? undefined,
          citationCount: meta.citationCount ?? undefined,
          fieldsOfStudy: meta.fieldsOfStudy ?? undefined,
          publicationTypes: meta.publicationTypes ?? undefined,
          authors: meta.authors,
          url: meta.url ?? undefined,
          arxivId: meta.arxivId ?? undefined,
        };
      });
    } catch { /* S2 enrichment is best-effort */ }

    const availableOn = await crossReference(adapters, d.name);

    results.push({
      datasetId: d.id,
      datasetName: d.name,
      datasetUrl: d.url,
      paperCount: d.paperCount,
      samplePapers,
      tasks: [...d.tasks],
      availableOn,
      actions: buildActions(availableOn),
    });
  });
  await Promise.allSettled(enrichPromises);

  // Re-sort results (concurrency may have scrambled order)
  results.sort((a, b) => b.paperCount - a.paperCount);

  const allTasks = new Set<string>();
  for (const d of datasetMap.values()) {
    for (const t of d.tasks) allTasks.add(t);
  }

  return {
    query,
    datasets: results,
    relatedTasks: [...allTasks],
    errors,
  };
}

async function crossReference(
  adapters: Map<SearchSource, SourceAdapter>,
  datasetName: string,
): Promise<Array<{ source: SearchSource; id: string; url: string }>> {
  const found: Array<{ source: SearchSource; id: string; url: string }> = [];
  const seenSources = new Set<SearchSource>();

  const skipSources = new Set<SearchSource>(["semantic-scholar", "arxiv"]);
  const sources = [...adapters.keys()].filter((s) => !skipSources.has(s));

  const searchNames = getSearchVariants(datasetName);
  const primaryQuery = searchNames[0];

  const settled = await Promise.allSettled(
    sources.map(async (src) => {
      const adapter = adapters.get(src)!;
      const results = await adapter.search(primaryQuery, 5);

      const nameVariantsLower = searchNames.map((n) => n.toLowerCase());

      const scored = results
        .map((r) => {
          const rName = r.name.toLowerCase();
          let score = 0;
          for (const variant of nameVariantsLower) {
            if (rName === variant) { score = 100; break; }
            if (rName.includes(variant) || variant.includes(rName)) {
              score = Math.max(score, 50);
            }
          }
          if (score === 0) {
            const primary = primaryQuery.toLowerCase();
            if (rName.includes(primary.slice(0, 15)) || primary.includes(rName.slice(0, 15))) {
              score = 20;
            }
          }
          return { result: r, score };
        })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score);

      if (scored.length > 0) {
        return { source: src, id: scored[0].result.id, url: scored[0].result.url };
      }
      return null;
    }),
  );

  for (const outcome of settled) {
    if (outcome.status === "fulfilled" && outcome.value && !seenSources.has(outcome.value.source)) {
      found.push(outcome.value);
      seenSources.add(outcome.value.source);
    }
  }

  return found;
}

function buildActions(
  availableOn: Array<{ source: SearchSource; id: string; url: string }>,
): DatasetAction[] {
  const actions: DatasetAction[] = [];
  for (const entry of availableOn) {
    actions.push({
      tool: "preview_dataset",
      params: { source: entry.source, dataset_id: entry.id, rows: 10 },
      description: `Preview first 10 rows from ${entry.source}`,
    });
    actions.push({
      tool: "visualize_dataset",
      params: { source: entry.source, dataset_id: entry.id, rows: 200, open: true },
      description: `Open interactive dashboard from ${entry.source}`,
    });
    actions.push({
      tool: "get_dataset_details",
      params: { source: entry.source, dataset_id: entry.id },
      description: `Get full metadata from ${entry.source}`,
    });
  }
  return actions;
}
