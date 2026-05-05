import type {
  DatasetResult,
  DatasetDetails,
  SourceAdapter,
} from "../types.js";
import { fetchJSON } from "../utils/http.js";

const BASE = "https://api2.openreview.net";

interface OpenReviewContentField<T> {
  value: T;
}

interface OpenReviewNote {
  id: string;
  content: {
    title?: OpenReviewContentField<string> | string;
    abstract?: OpenReviewContentField<string> | string;
    authors?: OpenReviewContentField<string[]> | string[];
    venue?: OpenReviewContentField<string> | string;
    keywords?: OpenReviewContentField<string[]> | string[];
    TLDR?: OpenReviewContentField<string> | string;
  };
  cdate?: number;
  tcdate?: number;
  license?: string;
}

interface OpenReviewSearchResponse {
  notes: OpenReviewNote[];
}

function unwrap<T>(field: OpenReviewContentField<T> | T | undefined): T | undefined {
  if (field === undefined || field === null) return undefined;
  if (typeof field === "object" && "value" in (field as Record<string, unknown>)) {
    return (field as OpenReviewContentField<T>).value;
  }
  return field as T;
}

function noteToResult(note: OpenReviewNote): DatasetResult {
  const title = unwrap(note.content.title) ?? note.id;
  const abstract = unwrap(note.content.abstract) ?? "";
  const authors = unwrap(note.content.authors);
  const keywords = unwrap(note.content.keywords);
  const venue = unwrap(note.content.venue);
  const cdate = note.cdate ?? note.tcdate;

  return {
    source: "openreview" as const,
    id: note.id,
    name: title,
    description: abstract.slice(0, 300),
    url: `https://openreview.net/forum?id=${note.id}`,
    tags: [
      ...(keywords ?? []),
      ...(venue ? [venue] : []),
    ],
    lastUpdated: cdate ? new Date(cdate).toISOString().split("T")[0] : undefined,
    authors,
  };
}

export const openReviewAdapter: SourceAdapter = {
  source: "openreview",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    try {
      const url = `${BASE}/notes/search?query=${encodeURIComponent(query)}&limit=${limit}`;
      const data = await fetchJSON<OpenReviewSearchResponse>(url);
      return (data.notes ?? []).map(noteToResult);
    } catch {
      return [];
    }
  },

  async getDetails(noteId: string): Promise<DatasetDetails> {
    const url = `${BASE}/notes?id=${encodeURIComponent(noteId)}`;
    const data = await fetchJSON<OpenReviewSearchResponse>(url);
    const note = data.notes?.[0];
    if (!note) throw new Error(`OpenReview note ${noteId} not found`);

    const result = noteToResult(note);
    const tldr = unwrap(note.content.TLDR);

    return {
      ...result,
      description: (unwrap(note.content.abstract) ?? tldr ?? "").slice(0, 500),
      license: note.license,
    };
  },
};
