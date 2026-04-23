import { pwcSearchDatasets } from "../adapters/papers-with-code.js";
import { apiCache, CacheTTL } from "./cache.js";
import { DATASET_ALIASES } from "./dataset-aliases.js";

let knownDatasets: Map<string, string> | null = null;

async function loadKnownDatasets(): Promise<Map<string, string>> {
  if (knownDatasets) return knownDatasets;

  const cacheKey = "abstract-extractor:known-datasets";
  const cached = apiCache.get<Map<string, string>>(cacheKey);
  if (cached) {
    knownDatasets = cached;
    return cached;
  }

  const map = new Map<string, string>();

  for (const [canonical, aliases] of Object.entries(DATASET_ALIASES)) {
    map.set(canonical.toLowerCase(), canonical);
    for (const alias of aliases) {
      map.set(alias.toLowerCase(), canonical);
    }
  }

  try {
    const popular = await pwcSearchDatasets("", 50);
    for (const d of popular) {
      const name = d.full_name ?? d.name;
      if (name.length >= 3) {
        map.set(name.toLowerCase(), name);
      }
    }
  } catch { /* best-effort */ }

  knownDatasets = map;
  apiCache.set(cacheKey, map, CacheTTL.KNOWN_DATASETS);
  return map;
}

const DATASET_CONTEXT_PATTERNS = [
  /(?:the\s+)([A-Z][A-Za-z0-9\s\-]{2,30}?)\s+(?:dataset|corpus|benchmark|data\s+set)/gi,
  /(?:trained|evaluated|tested|fine[- ]tuned|pre[- ]trained)\s+on\s+(?:the\s+)?([A-Z][A-Za-z0-9\s\-]{2,30}?)(?=[\s,.\);\:])/gi,
  /(?:using|on|from)\s+(?:the\s+)?([A-Z][A-Za-z0-9\-]+(?:\s+[A-Z][A-Za-z0-9\-]+){0,3})\s+(?:dataset|corpus|benchmark|data)/gi,
  /([A-Z][A-Za-z0-9\-]+(?:\s+[A-Z][A-Za-z0-9\-]+){0,3})\s*\([^)]*(?:19|20)\d{2}[^)]*\)\s*(?:dataset|benchmark|corpus|data)/gi,
  /(?:dataset|benchmark|corpus)\s+(?:called|named|known\s+as)\s+(?:the\s+)?([A-Z][A-Za-z0-9\s\-]{2,30})/gi,
];

const LINEAGE_PATTERNS = [
  /(?:extend|augment|build(?:ing)?\s+on|variant\s+of|derived\s+from|subset\s+of|superset\s+of|based\s+on|improve(?:s|d)?\s+upon)\s+(?:the\s+)?([A-Z][A-Za-z0-9\s\-]{2,40}?)(?=[\s,.\);\:])/gi,
];

const NOISE_WORDS = new Set([
  "the", "this", "that", "these", "those", "our", "we", "they", "it",
  "large language", "state of the art", "deep learning", "machine learning",
  "neural network", "transformer", "attention", "pre trained", "fine tuned",
  "natural language", "computer vision", "image classification",
]);

function isNoise(candidate: string): boolean {
  const lower = candidate.toLowerCase().trim();
  if (lower.length < 3 || lower.length > 50) return true;
  if (NOISE_WORDS.has(lower)) return true;
  if (/^[a-z]/.test(candidate)) return true;
  if (/^\d+$/.test(candidate.trim())) return true;
  return false;
}

export function extractDatasetMentions(abstract: string): string[] {
  const candidates = new Set<string>();

  for (const pattern of DATASET_CONTEXT_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(abstract)) !== null) {
      const candidate = match[1].trim();
      if (!isNoise(candidate)) {
        candidates.add(candidate);
      }
    }
  }

  return [...candidates];
}

export function extractLineageReferences(abstract: string): string[] {
  const candidates = new Set<string>();

  for (const pattern of LINEAGE_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(abstract)) !== null) {
      const candidate = match[1].trim();
      if (!isNoise(candidate)) {
        candidates.add(candidate);
      }
    }
  }

  return [...candidates];
}

export async function extractAndValidateDatasets(
  abstract: string,
): Promise<string[]> {
  const raw = extractDatasetMentions(abstract);
  if (raw.length === 0) return [];

  const known = await loadKnownDatasets();
  const validated: string[] = [];

  for (const candidate of raw) {
    const lower = candidate.toLowerCase();
    if (known.has(lower)) {
      validated.push(known.get(lower)!);
      continue;
    }

    const normalizedCandidate = lower.replace(/[\s\-_]/g, "");
    for (const [key, canonical] of known) {
      const normalizedKey = key.replace(/[\s\-_]/g, "");
      if (normalizedKey === normalizedCandidate) {
        validated.push(canonical);
        break;
      }
    }
  }

  // For unmatched candidates, try PwC validation (up to 3 to limit API calls)
  const unmatched = raw.filter(
    (c) => !validated.some((v) => v.toLowerCase() === c.toLowerCase()),
  );
  for (const candidate of unmatched.slice(0, 3)) {
    try {
      const results = await pwcSearchDatasets(candidate, 3);
      const match = results.find((r) => {
        const rName = (r.full_name ?? r.name).toLowerCase();
        const cName = candidate.toLowerCase();
        return rName.includes(cName) || cName.includes(rName);
      });
      if (match) {
        validated.push(match.full_name ?? match.name);
      }
    } catch { /* skip */ }
  }

  return [...new Set(validated)];
}
