import { createHash } from "node:crypto";
import type { DatasetResult, SearchSource } from "../types.js";
import { extractDoi, extractArxivId, normalizeDoi } from "./doi.js";

export interface ResolvedIdentity {
  type: "doi" | "arxiv" | "title-hash";
  value: string;
}

const SOURCE_PRIORITY: Record<string, number> = {
  openalex: 0,
  "semantic-scholar": 1,
  crossref: 2,
  arxiv: 3,
};

function sourcePriority(source: SearchSource): number {
  return SOURCE_PRIORITY[source] ?? 100;
}

export function resolveIdentity(result: DatasetResult): ResolvedIdentity {
  for (const field of [result.id, result.url]) {
    const doi = extractDoi(field);
    if (doi) return { type: "doi", value: normalizeDoi(doi) };
  }

  for (const field of [result.id, result.url]) {
    const arxivId = extractArxivId(field);
    if (arxivId) return { type: "arxiv", value: arxivId };
  }

  const normalizedTitle = result.name.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
  const authorPart = result.authors?.length
    ? result.authors.map((a) => a.toLowerCase()).sort().join("|")
    : "";
  const hashInput = `${normalizedTitle}::${authorPart}`;
  const hash = createHash("sha256").update(hashInput).digest("hex").slice(0, 16);

  return { type: "title-hash", value: hash };
}

export function deduplicateResults(results: DatasetResult[]): DatasetResult[] {
  const groups = new Map<string, DatasetResult[]>();

  for (const result of results) {
    const identity = resolveIdentity(result);
    const key = `${identity.type}:${identity.value}`;
    const group = groups.get(key);
    if (group) {
      group.push(result);
    } else {
      groups.set(key, [result]);
    }
  }

  const deduped: DatasetResult[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      deduped.push(group[0]);
      continue;
    }

    group.sort((a, b) => sourcePriority(a.source) - sourcePriority(b.source));
    const canonical = { ...group[0] };

    canonical.available_on = group.map((r) => r.source);
    canonical.alternate_ids = group
      .filter((r) => r.source !== canonical.source || r.id !== canonical.id)
      .map((r) => ({ source: r.source, id: r.id }));

    deduped.push(canonical);
  }

  return deduped;
}
