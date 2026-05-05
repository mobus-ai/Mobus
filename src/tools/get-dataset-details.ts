import type { DatasetDetails, SearchSource, SourceAdapter } from "../types.js";

export async function getDatasetDetails(
  adapters: Map<SearchSource, SourceAdapter>,
  source: SearchSource,
  datasetId: string,
): Promise<DatasetDetails> {
  const adapter = adapters.get(source);
  if (!adapter) {
    throw new Error(
      `Adapter "${source}" is not available. It may require API keys that are not configured.`,
    );
  }
  return adapter.getDetails(datasetId);
}
