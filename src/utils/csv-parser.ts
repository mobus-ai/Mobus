import type { ColumnInfo, PreviewRow } from "../types.js";

export interface ParsedCSV {
  columns: ColumnInfo[];
  rows: PreviewRow[];
}

export function parseCSV(text: string, maxRows: number): ParsedCSV {
  const lines = splitCSVLines(text);
  if (lines.length === 0) return { columns: [], rows: [] };

  const headerFields = parseCSVLine(lines[0]);
  const columns: ColumnInfo[] = headerFields.map((name) => ({ name: name.trim() }));

  const rows: PreviewRow[] = [];
  const limit = Math.min(lines.length, maxRows + 1);

  for (let i = 1; i < limit; i++) {
    const fields = parseCSVLine(lines[i]);
    const row: PreviewRow = {};
    for (let j = 0; j < columns.length; j++) {
      const raw = fields[j] ?? "";
      row[columns[j].name] = coerceValue(raw);
    }
    rows.push(row);
  }

  if (rows.length > 0) {
    for (let j = 0; j < columns.length; j++) {
      columns[j].type = inferType(rows, columns[j].name);
    }
  }

  return { columns, rows };
}

function splitCSVLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (current.trim()) lines.push(current);
      current = "";
      if (ch === "\r" && text[i + 1] === "\n") i++;
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);
  return lines;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function coerceValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "na" || trimmed.toLowerCase() === "n/a") {
    return null;
  }
  const num = Number(trimmed);
  if (!Number.isNaN(num) && trimmed !== "") return num;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  return trimmed;
}

function inferType(rows: PreviewRow[], colName: string): string {
  let hasNumber = false;
  let hasString = false;
  let hasBool = false;

  for (const row of rows) {
    const val = row[colName];
    if (val === null || val === undefined) continue;
    if (typeof val === "number") hasNumber = true;
    else if (typeof val === "boolean") hasBool = true;
    else hasString = true;
  }

  if (hasString) return "string";
  if (hasNumber && !hasBool) return "number";
  if (hasBool && !hasNumber) return "boolean";
  if (hasNumber && hasBool) return "mixed";
  return "unknown";
}

export async function fetchCSVPreview(
  url: string,
  maxRows: number,
  headers: Record<string, string> = {},
): Promise<ParsedCSV> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, {
      headers: { ...headers },
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`Failed to fetch CSV: HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    const targetBytes = 1024 * 512; // 512KB should be enough for most previews

    while (text.length < targetBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });

      const lineCount = text.split("\n").length;
      if (lineCount > maxRows + 5) break;
    }

    reader.cancel().catch(() => {});
    return parseCSV(text, maxRows);
  } finally {
    clearTimeout(timer);
  }
}
