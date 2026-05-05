import type {
  DatasetResult,
  DatasetDetails,
  SourceAdapter,
} from "../types.js";
import { fetchJSON } from "../utils/http.js";

const BASE = "https://www.ebi.ac.uk/europepmc/webservices/rest";

interface EuropePMCResult {
  id: string;
  doi?: string;
  title?: string;
  abstractText?: string;
  authorString?: string;
  journalTitle?: string;
  firstPublicationDate?: string;
  citedByCount?: number;
  source?: string;
}

interface EuropePMCSearchResponse {
  resultList: {
    result: EuropePMCResult[];
  };
}

function toResult(r: EuropePMCResult): DatasetResult {
  const src = r.source ?? "MED";
  return {
    source: "europepmc" as const,
    id: r.id,
    name: r.title ?? r.id,
    description: (r.abstractText ?? "").slice(0, 300),
    url: r.doi
      ? `https://doi.org/${r.doi}`
      : `https://europepmc.org/article/${src}/${r.id}`,
    tags: r.journalTitle ? [r.journalTitle] : undefined,
    lastUpdated: r.firstPublicationDate,
    authors: r.authorString
      ? r.authorString.split(", ")
      : undefined,
    popularity: {
      citations: r.citedByCount,
    },
  };
}

export const europmcAdapter: SourceAdapter = {
  source: "europepmc",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    try {
      const url = `${BASE}/search?query=${encodeURIComponent(query)}&resultType=core&pageSize=${limit}&format=json`;
      const data = await fetchJSON<EuropePMCSearchResponse>(url);
      return data.resultList.result.map(toResult);
    } catch {
      return [];
    }
  },

  async getDetails(pmid: string): Promise<DatasetDetails> {
    const url = `${BASE}/search?query=ext_id:${encodeURIComponent(pmid)}+src:med&resultType=core&format=json`;
    const data = await fetchJSON<EuropePMCSearchResponse>(url);
    const r = data.resultList.result[0];
    if (!r) throw new Error(`Europe PMC article ${pmid} not found`);
    return { ...toResult(r) };
  },
};
