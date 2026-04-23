import type { ColumnInfo, PreviewRow, QualityReport, Source } from "../types.js";

export function analyzeQuality(
  source: Source,
  id: string,
  columns: ColumnInfo[],
  rows: PreviewRow[],
  totalRows?: number,
): QualityReport {
  const colReports = columns.map((col) => {
    const values = rows.map((r) => r[col.name]);
    const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
    const missingCount = values.length - nonNull.length;
    const uniqueSet = new Set(nonNull.map((v) => JSON.stringify(v)));

    const report: QualityReport["columns"][number] = {
      name: col.name,
      type: col.type,
      missingCount,
      missingPct: values.length > 0 ? Math.round((missingCount / values.length) * 10000) / 100 : 0,
      uniqueCount: uniqueSet.size,
    };

    const nums = nonNull.filter((v) => typeof v === "number") as number[];
    if (nums.length > 0) {
      report.min = Math.min(...nums);
      report.max = Math.max(...nums);
      report.mean = Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
    }

    return report;
  });

  const rowStrings = rows.map((r) => JSON.stringify(r));
  const uniqueRows = new Set(rowStrings);
  const duplicateRows = rows.length - uniqueRows.size;

  const freshness = detectFreshness(columns, rows);

  return {
    source,
    id,
    sampleSize: rows.length,
    totalRows,
    columns: colReports,
    duplicateRows,
    duplicateRowPct: rows.length > 0 ? Math.round((duplicateRows / rows.length) * 10000) / 100 : 0,
    freshness,
  };
}

function detectFreshness(
  columns: ColumnInfo[],
  rows: PreviewRow[],
): QualityReport["freshness"] | undefined {
  const dateColNames = ["date", "timestamp", "datetime", "created_at", "updated_at", "time", "event_timestamp"];
  const dateCol = columns.find((c) =>
    dateColNames.some((d) => c.name.toLowerCase().includes(d)),
  );

  if (!dateCol) return undefined;

  const dates: Date[] = [];
  for (const row of rows) {
    const val = row[dateCol.name];
    if (typeof val === "string" || typeof val === "number") {
      const d = new Date(val);
      if (!isNaN(d.getTime())) dates.push(d);
    }
  }

  if (dates.length === 0) return undefined;

  dates.sort((a, b) => a.getTime() - b.getTime());
  return {
    oldestRecord: dates[0].toISOString(),
    newestRecord: dates[dates.length - 1].toISOString(),
  };
}
