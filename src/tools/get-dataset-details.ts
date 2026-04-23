import type { DatasetDetails, Source, SourceAdapter } from "../types.js";

export async function getDatasetDetails(
  adapters: Map<Source, SourceAdapter>,
  source: Source,
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
