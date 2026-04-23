import {
  s2GetPaper,
  s2GetPaperCitations,
  extractS2PaperMeta,
  type S2Paper,
} from "../adapters/semantic-scholar.js";
import {
  pwcGetDataset,
  pwcGetDatasetPapers,
} from "../adapters/papers-with-code.js";

interface PaperNode {
  paperId: string;
  title: string;
  year?: number;
  venue?: string;
  citationCount: number;
  relationship: "introduced" | "extended" | "benchmarked" | "applied";
  summary?: string;
  authors: string[];
  arxivId?: string;
  url?: string;
}

export interface CitationChain {
  datasetName: string;
  originPaper?: PaperNode;
  chain: PaperNode[];
  totalCitingPapers: number;
}

export async function traceCitationGraph(
  datasetId: string,
  maxChainLength: number = 15,
): Promise<CitationChain> {
  const dataset = await pwcGetDataset(datasetId);
  if (!dataset) throw new Error(`Papers with Code API is unavailable. Cannot trace citation graph for "${datasetId}".`);
  const datasetName = dataset.full_name ?? dataset.name;

  const pwcPapers = await pwcGetDatasetPapers(datasetId, 10);

  let originPaper: S2Paper | undefined;

  // Find the introducing paper via PwC papers
  for (const p of pwcPapers) {
    if (p.arxiv_id) {
      try {
        const s2p = await s2GetPaper(`ARXIV:${p.arxiv_id}`);
        if (!originPaper || (s2p.year ?? 9999) < (originPaper.year ?? 9999)) {
          originPaper = s2p;
        }
        if (s2p.publicationTypes?.includes("Dataset")) {
          originPaper = s2p;
          break;
        }
      } catch { /* try next */ }
    }
  }

  if (!originPaper) {
    try {
      const s2p = await s2GetPaper(datasetId);
      originPaper = s2p;
    } catch { /* not found by ID */ }
  }

  if (!originPaper) {
    return { datasetName, chain: [], totalCitingPapers: 0 };
  }

  let citations: S2Paper[] = [];
  try {
    citations = await s2GetPaperCitations(originPaper.paperId, 200);
  } catch { /* no citations accessible */ }

  const datasetNameLower = datasetName.toLowerCase();
  const relevant = citations.filter((p) => {
    if (!p.title) return false;
    const text = `${p.title} ${p.abstract ?? ""}`.toLowerCase();
    return text.includes(datasetNameLower) || text.includes(datasetId.toLowerCase());
  });

  relevant.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));

  const chain: PaperNode[] = relevant.slice(0, maxChainLength).map((p) => {
    const meta = extractS2PaperMeta(p);
    return {
      paperId: meta.paperId,
      title: meta.title,
      year: meta.year,
      venue: meta.venue ?? undefined,
      citationCount: meta.citationCount ?? 0,
      relationship: inferRelationship(p, datasetNameLower),
      summary: meta.tldr ?? undefined,
      authors: meta.authors,
      arxivId: meta.arxivId ?? undefined,
      url: meta.url ?? undefined,
    };
  });

  const originMeta = extractS2PaperMeta(originPaper);
  const originNode: PaperNode = {
    paperId: originMeta.paperId,
    title: originMeta.title,
    year: originMeta.year,
    venue: originMeta.venue ?? undefined,
    citationCount: originMeta.citationCount ?? 0,
    relationship: "introduced",
    summary: originMeta.tldr ?? undefined,
    authors: originMeta.authors,
    arxivId: originMeta.arxivId ?? undefined,
    url: originMeta.url ?? undefined,
  };

  return {
    datasetName,
    originPaper: originNode,
    chain,
    totalCitingPapers: citations.length,
  };
}

function inferRelationship(
  paper: S2Paper,
  datasetNameLower: string,
): PaperNode["relationship"] {
  if (paper.publicationTypes?.includes("Dataset")) return "extended";

  const text = `${paper.title} ${paper.abstract ?? ""}`.toLowerCase();

  const extendPatterns = [
    "extend", "augment", "variant of", "building on", "improve upon",
    "new version", "v2", "modified version",
  ];
  if (extendPatterns.some((p) => text.includes(p) && text.includes(datasetNameLower))) {
    return "extended";
  }

  const benchmarkPatterns = [
    "benchmark", "evaluate", "leaderboard", "state-of-the-art",
    "sota", "comparison", "baseline",
  ];
  if (benchmarkPatterns.some((p) => text.includes(p))) {
    return "benchmarked";
  }

  return "applied";
}
