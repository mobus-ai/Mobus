import type { DatasetResult, DatasetDetails, SourceAdapter } from "../types.js";
import { fetchJSON } from "../utils/http.js";

const BASE = "https://ghoapi.azureedge.net/api";

interface GHOIndicator {
  IndicatorCode: string;
  IndicatorName: string;
  Language: string;
}

interface GHOResponse {
  value: GHOIndicator[];
}

interface GHODimension {
  Code: string;
  Title: string;
}

interface GHODimensionResponse {
  value: GHODimension[];
}

export const whoAdapter: SourceAdapter = {
  source: "who",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    try {
      const url = `${BASE}/Indicator?$filter=contains(tolower(IndicatorName),'${encodeURIComponent(query.toLowerCase())}')&$top=${limit}`;
      const data = await fetchJSON<GHOResponse>(url, { timeoutMs: 15_000 });

      return (data.value ?? [])
        .filter((i) => i.Language === "EN" || !i.Language)
        .slice(0, limit)
        .map((i) => ({
          source: "who" as const,
          id: i.IndicatorCode,
          name: i.IndicatorName,
          description: `WHO Global Health Observatory indicator: ${i.IndicatorName}`,
          url: `https://www.who.int/data/gho/data/indicators/indicator-details/GHO/${encodeURIComponent(i.IndicatorCode)}`,
        }));
    } catch {
      return [];
    }
  },

  async getDetails(datasetId: string): Promise<DatasetDetails> {
    const [indicatorRes, dimensionRes] = await Promise.all([
      fetchJSON<GHOResponse>(
        `${BASE}/Indicator?$filter=IndicatorCode eq '${encodeURIComponent(datasetId)}'`,
        { timeoutMs: 15_000 },
      ),
      fetchJSON<GHODimensionResponse>(
        `${BASE}/${encodeURIComponent(datasetId)}/Dimension`,
        { timeoutMs: 15_000 },
      ).catch(() => null),
    ]);

    const indicator = indicatorRes.value?.find(
      (i) => i.Language === "EN" || !i.Language,
    );
    if (!indicator) throw new Error(`WHO indicator "${datasetId}" not found.`);

    const columns = dimensionRes?.value?.map((d) => ({
      name: d.Code,
      type: d.Title,
    }));

    return {
      source: "who",
      id: indicator.IndicatorCode,
      name: indicator.IndicatorName,
      description: `WHO Global Health Observatory indicator: ${indicator.IndicatorName}`,
      url: `https://www.who.int/data/gho/data/indicators/indicator-details/GHO/${encodeURIComponent(indicator.IndicatorCode)}`,
      columns,
      downloadUrl: `${BASE}/${encodeURIComponent(datasetId)}?$format=csv`,
    };
  },
};
