import type { DatasetResult, DatasetDetails, SourceAdapter } from "../types.js";
import { fetchJSON } from "../utils/http.js";

const CSE_BASE = "https://www.googleapis.com/customsearch/v1";

interface GoogleCSEResponse {
  items?: GoogleCSEItem[];
}

interface GoogleCSEItem {
  title: string;
  link: string;
  snippet?: string;
  pagemap?: {
    metatags?: Record<string, string>[];
  };
}

export const googleAdapter: SourceAdapter = {
  source: "google",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    const apiKey = process.env.GOOGLE_API_KEY;
    const cseId = process.env.GOOGLE_CSE_ID;
    if (!apiKey || !cseId) {
      throw new Error("Google adapter requires GOOGLE_API_KEY and GOOGLE_CSE_ID");
    }

    const num = Math.min(limit, 10); // CSE max is 10 per request
    const url =
      `${CSE_BASE}?key=${apiKey}&cx=${cseId}` +
      `&q=${encodeURIComponent(query + " dataset")}` +
      `&num=${num}`;

    const data = await fetchJSON<GoogleCSEResponse>(url);
    const items = data.items ?? [];

    return items.map((item, idx) => ({
      source: "google" as const,
      id: `google-${idx}-${encodeURIComponent(item.link)}`,
      name: item.title,
      description: item.snippet?.slice(0, 300) ?? "",
      url: item.link,
    }));
  },

  async getDetails(datasetId: string): Promise<DatasetDetails> {
    const urlMatch = datasetId.match(/google-\d+-(.*)/);
    const decodedUrl = urlMatch ? decodeURIComponent(urlMatch[1]) : datasetId;

    return {
      source: "google",
      id: datasetId,
      name: datasetId,
      description:
        "Google Dataset Search only provides links. Visit the URL for full details.",
      url: decodedUrl,
    };
  },
};
