import type { EnrichmentAdapter, EnrichmentResult, EnrichmentSource } from "../types.js";
import { unpaywallAdapter } from "../enrichment/unpaywall.js";
import { opencitationsAdapter } from "../enrichment/opencitations.js";
import { nihIciteAdapter } from "../enrichment/nih-icite.js";

export function buildEnrichmentMap(): Map<EnrichmentSource, EnrichmentAdapter> {
  const map = new Map<EnrichmentSource, EnrichmentAdapter>();

  map.set("unpaywall", unpaywallAdapter);
  map.set("opencitations", opencitationsAdapter);
  map.set("nih-icite", nihIciteAdapter);

  if (!process.env.UNPAYWALL_EMAIL) {
    map.delete("unpaywall");
  }

  return map;
}

export async function enrichDoi(
  enrichers: Map<EnrichmentSource, EnrichmentAdapter>,
  doi: string,
  sources?: EnrichmentSource[],
): Promise<EnrichmentResult[]> {
  const selected = sources
    ? sources.filter((s) => enrichers.has(s))
    : [...enrichers.keys()];

  const settled = await Promise.allSettled(
    selected.map(async (src) => {
      const adapter = enrichers.get(src)!;
      return adapter.enrich(doi);
    }),
  );

  const results: EnrichmentResult[] = [];
  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      results.push(outcome.value);
    }
  }

  return results;
}
