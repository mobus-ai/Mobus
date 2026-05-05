import type {
  DatasetResult,
  DatasetDetails,
  SourceAdapter,
} from "../types.js";
import { fetchJSON } from "../utils/http.js";
import { HttpError } from "../utils/http.js";

const MODELS_BASE = "https://huggingface.co/api/models";
const SPACES_BASE = "https://huggingface.co/api/spaces";

function authHeaders(): Record<string, string> {
  const token = process.env.HF_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface HFModel {
  id: string;
  pipeline_tag?: string;
  tags?: string[];
  downloads?: number;
  likes?: number;
  lastModified?: string;
  description?: string;
  cardData?: { license?: string | string[] };
}

interface HFSpace {
  id: string;
  tags?: string[];
  likes?: number;
  lastModified?: string;
  description?: string;
  cardData?: { license?: string | string[] };
}

function normaliseLicense(raw: string | string[] | undefined): string | undefined {
  if (!raw) return undefined;
  return Array.isArray(raw) ? raw.join(", ") : raw;
}

function modelToResult(m: HFModel): DatasetResult {
  return {
    source: "huggingface-models",
    id: m.id,
    name: m.id,
    description: m.description?.slice(0, 300) ?? "",
    url: `https://huggingface.co/${m.id}`,
    license: normaliseLicense(m.cardData?.license),
    tags: [...(m.tags ?? []), "model"],
    lastUpdated: m.lastModified,
    popularity: {
      downloads: m.downloads,
      likes: m.likes,
    },
  };
}

function spaceToResult(s: HFSpace): DatasetResult {
  return {
    source: "huggingface-models",
    id: s.id,
    name: s.id,
    description: s.description?.slice(0, 300) ?? "",
    url: `https://huggingface.co/spaces/${s.id}`,
    license: normaliseLicense(s.cardData?.license),
    tags: [...(s.tags ?? []), "space"],
    lastUpdated: s.lastModified,
    popularity: {
      likes: s.likes,
    },
  };
}

export const huggingFaceModelsAdapter: SourceAdapter = {
  source: "huggingface-models",

  async search(query: string, limit: number): Promise<DatasetResult[]> {
    const modelsLimit = Math.ceil(limit / 2);
    const spacesLimit = Math.floor(limit / 2);
    const headers = authHeaders();

    const [models, spaces] = await Promise.all([
      fetchJSON<HFModel[]>(
        `${MODELS_BASE}?search=${encodeURIComponent(query)}&limit=${modelsLimit}&full=true`,
        { headers },
      ).catch((): HFModel[] => []),
      fetchJSON<HFSpace[]>(
        `${SPACES_BASE}?search=${encodeURIComponent(query)}&limit=${spacesLimit}&full=true`,
        { headers },
      ).catch((): HFSpace[] => []),
    ]);

    return [
      ...models.map(modelToResult),
      ...spaces.map(spaceToResult),
    ];
  },

  async getDetails(datasetId: string): Promise<DatasetDetails> {
    const headers = authHeaders();

    let meta: HFModel | HFSpace;
    let isSpace = false;

    try {
      meta = await fetchJSON<HFModel>(`${MODELS_BASE}/${datasetId}`, { headers });
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) {
        meta = await fetchJSON<HFSpace>(`${SPACES_BASE}/${datasetId}`, { headers });
        isSpace = true;
      } else {
        throw err;
      }
    }

    const url = isSpace
      ? `https://huggingface.co/spaces/${meta.id}`
      : `https://huggingface.co/${meta.id}`;

    return {
      source: "huggingface-models",
      id: meta.id,
      name: meta.id,
      description: meta.description?.slice(0, 500) ?? "",
      url,
      license: normaliseLicense(meta.cardData?.license),
      tags: [...(meta.tags ?? []), isSpace ? "space" : "model"],
      lastUpdated: meta.lastModified,
      popularity: {
        downloads: isSpace ? undefined : (meta as HFModel).downloads,
        likes: meta.likes,
      },
    };
  },
};
