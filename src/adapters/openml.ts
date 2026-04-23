import type {
  DatasetResult,
  DatasetDetails,
  SourceAdapter,
  PopularityMetrics,
} from "../types.js";
import { fetchJSON } from "../utils/http.js";

const BASE = "https://www.openml.org/api/v1/json";

interface OpenMLListResponse {
  data: {
    dataset: OpenMLDatasetSummary[];
  };
}

interface OpenMLDatasetSummary {
  did: number;
  name: string;
  status: string;
  format?: string;
  NumberOfInstances?: number;
  NumberOfFeatures?: number;
  qualities?: Record<string, string>;
}

interface OpenMLDataResponse {
  data_set_description: {
    id: string;
    name: string;
    description?: string;
    licence?: string;
    tag?: string | string[];
    upload_date?: string;
    format?: string;
    url?: string;
  };
}

interface OpenMLFeaturesResponse {
  data_features: {
    feature: OpenMLFeature[];
  };
}

interface OpenMLFeature {
  index: string;
  name: string;
  data_type: string;
  is_target: string;
}

interface OpenMLQualitiesResponse {
  data_qualities: {
    quality: Array<{ name: string; value: string }>;
  };
}

export const openMLAdapter: SourceAdapter = {
  source: "openml",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    const url = `${BASE}/data/list/data_name/${encodeURIComponent(query)}/limit/${limit}/status/active`;

    try {
      const data = await fetchJSON<OpenMLListResponse>(url);
      const datasets = data.data?.dataset ?? [];

      return datasets.map((d) => ({
        source: "openml" as const,
        id: String(d.did),
        name: d.name,
        description: `${d.NumberOfInstances ?? "?"} instances, ${d.NumberOfFeatures ?? "?"} features (${d.format ?? "unknown"})`,
        url: `https://www.openml.org/d/${d.did}`,
      }));
    } catch {
      return [];
    }
  },

  async getDetails(datasetId: string): Promise<DatasetDetails> {
    const [meta, featuresRes] = await Promise.all([
      fetchJSON<OpenMLDataResponse>(`${BASE}/data/${datasetId}`),
      fetchJSON<OpenMLFeaturesResponse>(`${BASE}/data/features/${datasetId}`).catch(
        () => null,
      ),
    ]);

    const desc = meta.data_set_description;
    const features = featuresRes?.data_features?.feature;

    const tags = desc.tag
      ? Array.isArray(desc.tag)
        ? desc.tag
        : [desc.tag]
      : undefined;

    const columns = features?.map((f) => ({
      name: f.name,
      type: f.data_type,
    }));

    return {
      source: "openml",
      id: desc.id,
      name: desc.name,
      description: desc.description?.slice(0, 500) ?? "",
      url: `https://www.openml.org/d/${desc.id}`,
      license: desc.licence,
      tags,
      lastUpdated: desc.upload_date,
      columns,
      rowCount: features ? undefined : undefined,
      downloadUrl: desc.url,
    };
  },

  async getPopularity(datasetId: string): Promise<PopularityMetrics> {
    try {
      const data = await fetchJSON<OpenMLQualitiesResponse>(
        `${BASE}/data/qualities/${datasetId}`,
      );
      const qualities = data.data_qualities?.quality ?? [];
      const runs = qualities.find((q) => q.name === "NumberOfRuns");
      return {
        downloads: runs ? parseInt(runs.value, 10) : undefined,
      };
    } catch {
      return {};
    }
  },
};
