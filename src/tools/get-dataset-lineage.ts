import {
  pwcGetDataset,
  pwcSearchDatasets,
  pwcGetDatasetPaperCount,
  pwcGetDatasetPapers,
} from "../adapters/papers-with-code.js";
import {
  s2GetPaper,
  s2GetPaperCitations,
  extractS2PaperMeta,
  type S2Paper,
} from "../adapters/semantic-scholar.js";
import { extractLineageReferences } from "../utils/abstract-extractor.js";

interface LineageNode {
  datasetId: string;
  datasetName: string;
  datasetUrl: string;
  introducedYear?: number;
  introducedBy?: { title: string; authors: string[]; venue?: string };
  paperCount: number;
  relationship: "original" | "extension" | "subset" | "remix" | "v2" | "variant";
  children: LineageNode[];
}

export interface DatasetLineage {
  root: LineageNode;
  totalVariants: number;
}

export async function getDatasetLineage(
  datasetId: string,
  maxDepth: number = 2,
): Promise<DatasetLineage> {
  const dataset = await pwcGetDataset(datasetId);
  if (!dataset) throw new Error(`Papers with Code API is unavailable. Cannot retrieve lineage for "${datasetId}".`);
  const datasetName = dataset.full_name ?? dataset.name;
  const paperCount = await pwcGetDatasetPaperCount(datasetId);

  const intro = await findIntro(datasetId);

  const root: LineageNode = {
    datasetId,
    datasetName,
    datasetUrl: dataset.homepage ?? `https://paperswithcode.com/dataset/${datasetId}`,
    introducedYear: dataset.introduced_date
      ? new Date(dataset.introduced_date).getFullYear()
      : intro?.year,
    introducedBy: intro
      ? { title: intro.title, authors: intro.authors?.map((a) => a.name) ?? [], venue: intro.venue }
      : undefined,
    paperCount,
    relationship: "original",
    children: [],
  };

  if (maxDepth > 0) {
    const variants = await findVariants(datasetId, datasetName, intro?.paperId);

    const childPromises = variants.map(async (v) => {
      const childPaperCount = await pwcGetDatasetPaperCount(v.id).catch(() => 0);
      const childIntro = await findIntro(v.id);

      return {
        datasetId: v.id,
        datasetName: v.name,
        datasetUrl: `https://paperswithcode.com/dataset/${v.id}`,
        introducedYear: v.introduced_date
          ? new Date(v.introduced_date).getFullYear()
          : childIntro?.year,
        introducedBy: childIntro
          ? { title: childIntro.title, authors: childIntro.authors?.map((a) => a.name) ?? [], venue: childIntro.venue }
          : undefined,
        paperCount: childPaperCount,
        relationship: inferVariantRelationship(v.name, datasetName),
        children: [] as LineageNode[],
      } satisfies LineageNode;
    });

    const settled = await Promise.allSettled(childPromises);
    for (const outcome of settled) {
      if (outcome.status === "fulfilled") {
        root.children.push(outcome.value);
      }
    }

    root.children.sort((a, b) => (a.introducedYear ?? 9999) - (b.introducedYear ?? 9999));
  }

  return {
    root,
    totalVariants: root.children.length,
  };
}

async function findIntro(datasetId: string): Promise<S2Paper | undefined> {
  try {
    const papers = await pwcGetDatasetPapers(datasetId, 5);
    for (const p of papers) {
      if (p.arxiv_id) {
        try {
          const s2p = await s2GetPaper(`ARXIV:${p.arxiv_id}`);
          if (s2p.publicationTypes?.includes("Dataset")) return s2p;
          return s2p;
        } catch { continue; }
      }
    }
  } catch { /* best-effort */ }
  return undefined;
}

interface PwcDatasetBasic {
  id: string;
  name: string;
  full_name?: string;
  introduced_date?: string;
}

async function findVariants(
  datasetId: string,
  datasetName: string,
  originPaperId?: string,
): Promise<PwcDatasetBasic[]> {
  const seen = new Set<string>([datasetId]);
  const variants: PwcDatasetBasic[] = [];

  // Strategy A: name-based search on PwC
  try {
    const baseName = datasetName.split(/[\s\-]/)[0];
    if (baseName.length >= 3) {
      const results = await pwcSearchDatasets(baseName, 30);
      for (const d of results) {
        if (seen.has(d.id)) continue;
        const dName = (d.full_name ?? d.name).toLowerCase().replace(/[\s\-_]/g, "");
        const rootName = datasetName.toLowerCase().replace(/[\s\-_]/g, "");
        if (dName.includes(rootName) || rootName.includes(dName.slice(0, rootName.length))) {
          seen.add(d.id);
          variants.push({
            id: d.id,
            name: d.full_name ?? d.name,
            introduced_date: d.introduced_date,
          });
        }
      }
    }
  } catch { /* best-effort */ }

  // Strategy B: citation graph — find Dataset-type papers citing the origin
  if (originPaperId) {
    try {
      const citations = await s2GetPaperCitations(originPaperId, 100);
      const datasetCitations = citations.filter(
        (p) => p.publicationTypes?.includes("Dataset"),
      );

      for (const citPaper of datasetCitations.slice(0, 10)) {
        const meta = extractS2PaperMeta(citPaper);
        const nameNorm = datasetName.toLowerCase();
        const titleNorm = meta.title.toLowerCase();

        if (titleNorm.includes(nameNorm.split(/[\s\-]/)[0])) {
          const pwcId = meta.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
          if (!seen.has(pwcId) && !seen.has(meta.title)) {
            seen.add(pwcId);
            variants.push({
              id: pwcId,
              name: meta.title,
              introduced_date: citPaper.publicationDate,
            });
          }
        }
      }
    } catch { /* best-effort */ }
  }

  // Strategy C: abstract-based lineage detection
  if (originPaperId) {
    try {
      const citations = await s2GetPaperCitations(originPaperId, 50);
      for (const cit of citations.slice(0, 20)) {
        if (!cit.abstract) continue;
        const refs = extractLineageReferences(cit.abstract);
        const nameNorm = datasetName.toLowerCase();
        if (refs.some((r) => r.toLowerCase().includes(nameNorm.split(/[\s\-]/)[0]))) {
          if (cit.publicationTypes?.includes("Dataset")) {
            const meta = extractS2PaperMeta(cit);
            const pwcId = meta.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
            if (!seen.has(pwcId)) {
              seen.add(pwcId);
              variants.push({
                id: pwcId,
                name: meta.title,
                introduced_date: cit.publicationDate,
              });
            }
          }
        }
      }
    } catch { /* best-effort */ }
  }

  return variants;
}

function inferVariantRelationship(
  variantName: string,
  rootName: string,
): LineageNode["relationship"] {
  const lower = variantName.toLowerCase();

  if (/v\d|version\s*\d/i.test(lower)) return "v2";
  if (/\bsubset\b/i.test(lower)) return "subset";
  if (/\bextend/i.test(lower) || /\baugment/i.test(lower) || /\bplus\b/i.test(lower)) return "extension";
  if (/\bremix\b/i.test(lower) || /\bcorrupt/i.test(lower)) return "remix";

  const rootBase = rootName.toLowerCase().split(/[\s\-]/)[0];
  if (lower.includes(rootBase) && lower !== rootName.toLowerCase()) return "variant";

  return "variant";
}
