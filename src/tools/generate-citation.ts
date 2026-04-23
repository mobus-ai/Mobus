import type { Source, SourceAdapter } from "../types.js";
import { formatCitation, type CitationFormat } from "../utils/citation-formatter.js";

export async function generateCitation(
  adapters: Map<Source, SourceAdapter>,
  source: Source,
  datasetId: string,
  format: CitationFormat,
): Promise<{ citation: string; format: string }> {
  const adapter = adapters.get(source);
  if (!adapter) {
    throw new Error(`Adapter "${source}" is not available.`);
  }

  const details = await adapter.getDetails(datasetId);
  const citation = formatCitation(details, format);

  return { citation, format };
}
