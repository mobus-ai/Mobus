const ARXIV_NEW_REGEX = /\b(\d{4}\.\d{4,5}(?:v\d+)?)\b/;
const ARXIV_LEGACY_REGEX = /\b([a-z-]+(?:\.[A-Z]{2})?\/\d{7})\b/;

const DOI_REGEX = /\b(10\.\d{4,9}\/[^\s"'<>,;]+)/i;
const DOI_URL_PREFIX = /^https?:\/\/(?:dx\.)?doi\.org\//i;

export function extractDoi(input: string): string | undefined {
  const urlStripped = input.replace(DOI_URL_PREFIX, "");
  const match = urlStripped.match(DOI_REGEX);
  return match?.[1]?.replace(/[.\s]+$/, "");
}

export function extractArxivId(input: string): string | undefined {
  const newMatch = input.match(ARXIV_NEW_REGEX);
  if (newMatch) return newMatch[1];
  const legacyMatch = input.match(ARXIV_LEGACY_REGEX);
  return legacyMatch?.[1];
}

export function normalizeDoi(doi: string): string {
  return doi.toLowerCase().trim();
}
