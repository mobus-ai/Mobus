import type { ColumnInfo, SearchSource, SourceAdapter } from "../types.js";

export interface SchemaColumn {
  name: string;
  type?: string;
}

export interface CompatibilityResult {
  source: SearchSource;
  id: string;
  matched: Array<{ name: string; userType?: string; datasetType?: string; typeMatch: boolean }>;
  missingInDataset: string[];
  extraInDataset: string[];
  matchScore: number;
  summary: string;
}

export async function checkCompatibility(
  adapters: Map<SearchSource, SourceAdapter>,
  source: SearchSource,
  datasetId: string,
  schema: SchemaColumn[],
): Promise<CompatibilityResult> {
  const adapter = adapters.get(source);
  if (!adapter) {
    throw new Error(`Adapter "${source}" is not available.`);
  }

  const details = await adapter.getDetails(datasetId);
  const datasetCols = details.columns ?? [];

  const datasetColMap = new Map<string, ColumnInfo>();
  for (const col of datasetCols) {
    datasetColMap.set(col.name.toLowerCase(), col);
  }

  const userColNames = new Set(schema.map((s) => s.name.toLowerCase()));
  const datasetColNames = new Set(datasetCols.map((c) => c.name.toLowerCase()));

  const matched: CompatibilityResult["matched"] = [];
  const missingInDataset: string[] = [];

  for (const userCol of schema) {
    const key = userCol.name.toLowerCase();
    const dsCol = datasetColMap.get(key);

    if (dsCol) {
      const typeMatch =
        !userCol.type || !dsCol.type || normalizeType(userCol.type) === normalizeType(dsCol.type);
      matched.push({
        name: userCol.name,
        userType: userCol.type,
        datasetType: dsCol.type,
        typeMatch,
      });
    } else {
      missingInDataset.push(userCol.name);
    }
  }

  const extraInDataset = datasetCols
    .filter((c) => !userColNames.has(c.name.toLowerCase()))
    .map((c) => c.name);

  const matchScore =
    schema.length > 0
      ? Math.round((matched.length / schema.length) * 10000) / 100
      : 0;

  const typeMatches = matched.filter((m) => m.typeMatch).length;
  const typeMismatches = matched.filter((m) => !m.typeMatch).length;

  const parts = [
    `${matched.length}/${schema.length} columns matched (${matchScore}%).`,
  ];
  if (typeMismatches > 0) {
    parts.push(`${typeMismatches} type mismatch(es).`);
  }
  if (missingInDataset.length > 0) {
    parts.push(`${missingInDataset.length} column(s) missing from dataset.`);
  }
  if (extraInDataset.length > 0) {
    parts.push(`Dataset has ${extraInDataset.length} extra column(s) not in your schema.`);
  }

  return {
    source,
    id: datasetId,
    matched,
    missingInDataset,
    extraInDataset,
    matchScore,
    summary: parts.join(" "),
  };
}

function normalizeType(type: string): string {
  const t = type.toLowerCase().trim();
  if (["int", "int32", "int64", "integer", "long", "bigint"].includes(t)) return "integer";
  if (["float", "float32", "float64", "double", "decimal", "number", "numeric", "real"].includes(t)) return "float";
  if (["str", "string", "text", "varchar", "char", "object"].includes(t)) return "string";
  if (["bool", "boolean"].includes(t)) return "boolean";
  if (["date", "datetime", "timestamp"].includes(t)) return "datetime";
  return t;
}
