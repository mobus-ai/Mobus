import type { QualityReport, SearchSource, SourceAdapter } from "../types.js";
import { fetchCSVPreview } from "../utils/csv-parser.js";
import { analyzeQuality } from "../utils/quality-checker.js";

export async function assessQuality(
  adapters: Map<SearchSource, SourceAdapter>,
  source: SearchSource,
  datasetId: string,
  sampleRows: number,
): Promise<QualityReport> {
  const adapter = adapters.get(source);
  if (!adapter) {
    throw new Error(`Adapter "${source}" is not available.`);
  }

  if (adapter.preview) {
    const preview = await adapter.preview(datasetId, sampleRows);
    return analyzeQuality(source, datasetId, preview.columns, preview.rows, preview.totalRows);
  }

  const details = await adapter.getDetails(datasetId);
  if (!details.downloadUrl) {
    throw new Error(
      `No preview method or download URL available for "${datasetId}" on ${source}.`,
    );
  }

  const parsed = await fetchCSVPreview(details.downloadUrl, sampleRows);
  return analyzeQuality(source, datasetId, parsed.columns, parsed.rows, details.rowCount);
}
