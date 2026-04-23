import {
  pwcGetDataset,
  pwcGetDatasetPapers,
  pwcGetDatasetPaperCount,
  pwcGetDatasetEvaluations,
  pwcGetEvaluationResults,
} from "../adapters/papers-with-code.js";
import {
  s2SearchPapers,
  s2SemanticSearch,
  s2GetPapersByIds,
  extractS2PaperMeta,
  type S2Paper,
} from "../adapters/semantic-scholar.js";

interface PaperSummary {
  title: string;
  year?: number;
  venue?: string;
  venueType?: string;
  citationCount?: number;
  influentialCitationCount?: number;
  publicationTypes?: string[];
  fieldsOfStudy?: string[];
  authors: string[];
  url?: string;
  arxivId?: string;
  pdfUrl?: string;
}

interface VenueBreakdown {
  venue: string;
  count: number;
}

interface YearBreakdown {
  year: number;
  count: number;
}

interface FieldBreakdown {
  field: string;
  count: number;
}

interface TypeBreakdown {
  type: string;
  count: number;
}

interface BenchmarkResult {
  task: string;
  topResults: Array<{
    rank: number;
    methodology: string;
    metrics: Record<string, string>;
    paper?: string;
  }>;
}

export interface DatasetProvenance {
  datasetId: string;
  datasetName: string;
  datasetUrl: string;
  totalPapers: number;
  introducedBy?: PaperSummary;
  topPapers: PaperSummary[];
  recentPapers: PaperSummary[];
  venueBreakdown: VenueBreakdown[];
  yearBreakdown: YearBreakdown[];
  fieldBreakdown: FieldBreakdown[];
  typeBreakdown: TypeBreakdown[];
  benchmarks: BenchmarkResult[];
  stats: {
    totalCitations: number;
    avgCitationsPerPaper: number;
    medianYear?: number;
    earliestYear?: number;
    latestYear?: number;
  };
}

export async function getDatasetProvenance(
  datasetId: string,
  maxPapers: number = 20,
): Promise<DatasetProvenance> {
  // Fetch dataset info from PwC
  const dataset = await pwcGetDataset(datasetId);
  if (!dataset) throw new Error(`Papers with Code API is unavailable. Cannot retrieve provenance for "${datasetId}".`);
  const totalPapers = await pwcGetDatasetPaperCount(datasetId);
  const pwcPapers = await pwcGetDatasetPapers(datasetId, Math.min(maxPapers, 50));

  // Enrich with S2 metadata: try matching by arxiv ID or title
  const s2Papers = await enrichWithS2(pwcPapers, dataset.full_name ?? dataset.name);

  const allPapers = s2Papers.map((p) => {
    const meta = extractS2PaperMeta(p);
    return {
      title: meta.title,
      year: meta.year,
      venue: meta.venue ?? undefined,
      citationCount: meta.citationCount ?? undefined,
      influentialCitationCount: p.influentialCitationCount ?? undefined,
      publicationTypes: meta.publicationTypes ?? undefined,
      fieldsOfStudy: meta.fieldsOfStudy ?? undefined,
      authors: meta.authors,
      url: meta.url ?? undefined,
      arxivId: meta.arxivId ?? undefined,
      pdfUrl: meta.pdfUrl ?? undefined,
    } satisfies PaperSummary;
  });

  // Identify the introducing paper (earliest, or the one with "Dataset" type)
  const introducedBy = findIntroducingPaper(allPapers, dataset.introduced_date);

  // Top by citations
  const topPapers = [...allPapers]
    .sort((a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0))
    .slice(0, 10);

  // Most recent
  const recentPapers = [...allPapers]
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    .slice(0, 10);

  // Breakdowns
  const venueBreakdown = buildBreakdown(
    allPapers.map((p) => p.venue).filter(Boolean) as string[],
  );
  const yearBreakdown = buildBreakdown(
    allPapers.map((p) => p.year).filter(Boolean).map(String) as string[],
  ).map((b) => ({ year: parseInt(b.venue), count: b.count }));
  yearBreakdown.sort((a, b) => a.year - b.year);

  const fieldBreakdown = buildBreakdown(
    allPapers.flatMap((p) => p.fieldsOfStudy ?? []),
  ).map((b) => ({ field: b.venue, count: b.count }));

  const typeBreakdown = buildBreakdown(
    allPapers.flatMap((p) => p.publicationTypes ?? []),
  ).map((b) => ({ type: b.venue, count: b.count }));

  // Benchmarks
  const benchmarks: BenchmarkResult[] = [];
  try {
    const evalTables = await pwcGetDatasetEvaluations(datasetId, 10);
    const benchPromises = evalTables.slice(0, 5).map(async (table) => {
      try {
        const results = await pwcGetEvaluationResults(table.id, 5);
        if (results.length > 0) {
          benchmarks.push({
            task: table.task,
            topResults: results.map((r, idx) => ({
              rank: idx + 1,
              methodology: r.methodology,
              metrics: r.metrics,
              paper: r.paper ?? undefined,
            })),
          });
        }
      } catch { /* skip individual benchmark failures */ }
    });
    await Promise.allSettled(benchPromises);
  } catch { /* benchmarks are best-effort */ }

  // Stats
  const citations = allPapers.map((p) => p.citationCount ?? 0);
  const totalCitations = citations.reduce((sum, c) => sum + c, 0);
  const years = allPapers.map((p) => p.year).filter(Boolean) as number[];

  return {
    datasetId,
    datasetName: dataset.full_name ?? dataset.name,
    datasetUrl: dataset.homepage ?? `https://paperswithcode.com/dataset/${datasetId}`,
    totalPapers,
    introducedBy,
    topPapers,
    recentPapers,
    venueBreakdown,
    yearBreakdown,
    fieldBreakdown,
    typeBreakdown,
    benchmarks,
    stats: {
      totalCitations,
      avgCitationsPerPaper: allPapers.length > 0
        ? Math.round(totalCitations / allPapers.length)
        : 0,
      medianYear: years.length > 0
        ? years.sort((a, b) => a - b)[Math.floor(years.length / 2)]
        : undefined,
      earliestYear: years.length > 0 ? Math.min(...years) : undefined,
      latestYear: years.length > 0 ? Math.max(...years) : undefined,
    },
  };
}

async function enrichWithS2(
  pwcPapers: Array<{ arxiv_id?: string; title: string }>,
  datasetName: string,
): Promise<S2Paper[]> {
  // Try batch lookup by arxiv IDs first
  const arxivIds = pwcPapers
    .filter((p) => p.arxiv_id)
    .map((p) => `ARXIV:${p.arxiv_id}`);

  let s2Papers: S2Paper[] = [];

  if (arxivIds.length > 0) {
    try {
      s2Papers = await s2GetPapersByIds(arxivIds);
    } catch { /* fall back to search */ }
  }

  // If we got fewer than expected, supplement with semantic search (falls back to keyword)
  if (s2Papers.length < Math.min(pwcPapers.length, 10)) {
    try {
      const { papers } = await s2SemanticSearch(
        `"${datasetName}" dataset`,
        20,
      );
      const existingIds = new Set(s2Papers.map((p) => p.paperId));
      for (const p of papers) {
        if (!existingIds.has(p.paperId)) {
          s2Papers.push(p);
          existingIds.add(p.paperId);
        }
      }
    } catch { /* best-effort */ }
  }

  return s2Papers;
}

function findIntroducingPaper(
  papers: PaperSummary[],
  introducedDate?: string,
): PaperSummary | undefined {
  // Prefer a "Dataset" type paper
  const datasetPaper = papers.find((p) =>
    p.publicationTypes?.includes("Dataset"),
  );
  if (datasetPaper) return datasetPaper;

  // Fall back to the earliest paper (or one matching the introduced date year)
  const introYear = introducedDate
    ? new Date(introducedDate).getFullYear()
    : undefined;

  if (introYear) {
    const fromYear = papers.filter((p) => p.year === introYear);
    if (fromYear.length > 0) {
      return fromYear.sort(
        (a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0),
      )[0];
    }
  }

  const withYear = papers.filter((p) => p.year != null);
  if (withYear.length === 0) return undefined;
  return withYear.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999))[0];
}

function buildBreakdown(items: string[]): Array<{ venue: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item.trim();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([venue, count]) => ({ venue, count }))
    .sort((a, b) => b.count - a.count);
}
