import type { PreviewResult, Source, SourceAdapter } from "../types.js";
import { fetchCSVPreview } from "../utils/csv-parser.js";

export async function previewDataset(
  adapters: Map<Source, SourceAdapter>,
  source: Source,
  datasetId: string,
  rows: number,
): Promise<PreviewResult> {
  const adapter = adapters.get(source);
  if (!adapter) {
    throw new Error(
      `Adapter "${source}" is not available. It may require API keys that are not configured.`,
    );
  }

  if (adapter.preview) {
    return adapter.preview(datasetId, rows);
  }

  const details = await adapter.getDetails(datasetId);
  if (!details.downloadUrl) {
    throw new Error(
      `No preview method or download URL available for "${datasetId}" on ${source}.`,
    );
  }

  const parsed = await fetchCSVPreview(details.downloadUrl, rows);
  return {
    source,
    id: datasetId,
    columns: parsed.columns,
    rows: parsed.rows,
    totalRows: details.rowCount,
  };
}
