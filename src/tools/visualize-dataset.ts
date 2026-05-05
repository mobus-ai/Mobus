import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { exec } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { SearchSource, SourceAdapter } from "../types.js";
import { fetchCSVPreview } from "../utils/csv-parser.js";
import { buildDashboardHTML, type ChartData } from "../utils/chart-generator.js";

const CHARTS_DIR = join(homedir(), ".mobus", "charts");

const chartCache = new Map<string, { html: string; createdAt: number }>();
const CHART_TTL_MS = 30 * 60 * 1000;

export function getChartHTML(chartId: string): string | undefined {
  const entry = chartCache.get(chartId);
  if (!entry) return undefined;
  if (Date.now() - entry.createdAt > CHART_TTL_MS) {
    chartCache.delete(chartId);
    return undefined;
  }
  return entry.html;
}

function pruneExpiredCharts(): void {
  const now = Date.now();
  for (const [id, entry] of chartCache) {
    if (now - entry.createdAt > CHART_TTL_MS) chartCache.delete(id);
  }
}

export async function visualizeDataset(
  adapters: Map<SearchSource, SourceAdapter>,
  source: SearchSource,
  datasetId: string,
  rows: number,
  shouldOpen: boolean,
  baseUrl?: string,
): Promise<{ filePath?: string; url?: string; rowCount: number; columnCount: number }> {
  const adapter = adapters.get(source);
  if (!adapter) {
    throw new Error(
      `Adapter "${source}" is not available. It may require API keys that are not configured.`,
    );
  }

  const details = await adapter.getDetails(datasetId);

  let preview;
  if (adapter.preview) {
    preview = await adapter.preview(datasetId, rows);
  } else if (details.downloadUrl) {
    const parsed = await fetchCSVPreview(details.downloadUrl, rows);
    preview = {
      source,
      id: datasetId,
      columns: parsed.columns,
      rows: parsed.rows,
      totalRows: details.rowCount,
    };
  } else {
    throw new Error(
      `No preview method or download URL available for "${datasetId}" on ${source}.`,
    );
  }

  const chartData: ChartData = {
    title: details.name,
    subtitle: `${source} · ${datasetId} · ${preview.rows.length} rows loaded`,
    url: details.url,
    columns: preview.columns,
    rows: preview.rows,
    totalRows: preview.totalRows,
  };

  const html = buildDashboardHTML(chartData);
  const isRemote = !!baseUrl;

  if (isRemote) {
    pruneExpiredCharts();
    const chartId = randomUUID().slice(0, 12);
    chartCache.set(chartId, { html, createdAt: Date.now() });
    return {
      url: `${baseUrl}/charts/${chartId}`,
      rowCount: preview.rows.length,
      columnCount: preview.columns.length,
    };
  }

  await mkdir(CHARTS_DIR, { recursive: true });
  const ts = Date.now();
  const safeName = datasetId.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
  const fileName = `${source}-${safeName}-${ts}.html`;
  const filePath = join(CHARTS_DIR, fileName);
  await writeFile(filePath, html, "utf-8");

  if (shouldOpen) {
    const platform = process.platform;
    const cmd =
      platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
    exec(`${cmd} "${filePath}"`);
  }

  return {
    filePath,
    rowCount: preview.rows.length,
    columnCount: preview.columns.length,
  };
}
