import type { SearchSource, SourceAdapter } from "../types.js";
import { analyzeLicense, type UseCase } from "../utils/license-analyzer.js";

export interface LicenseCheckResult {
  source: SearchSource;
  id: string;
  license: string | undefined;
  useCase: UseCase;
  permitted: boolean;
  details: string;
  requirements: string[];
}

export async function checkLicense(
  adapters: Map<SearchSource, SourceAdapter>,
  source: SearchSource,
  datasetId: string,
  useCase: UseCase,
): Promise<LicenseCheckResult> {
  const adapter = adapters.get(source);
  if (!adapter) {
    throw new Error(`Adapter "${source}" is not available.`);
  }

  const details = await adapter.getDetails(datasetId);
  const analysis = analyzeLicense(details.license, useCase);

  return {
    source,
    id: datasetId,
    license: details.license,
    useCase,
    ...analysis,
  };
}
