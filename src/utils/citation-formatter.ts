import type { DatasetDetails } from "../types.js";

export type CitationFormat = "bibtex" | "apa" | "chicago";

export function formatCitation(
  details: DatasetDetails,
  format: CitationFormat,
): string {
  switch (format) {
    case "bibtex":
      return formatBibTeX(details);
    case "apa":
      return formatAPA(details);
    case "chicago":
      return formatChicago(details);
  }
}

function extractYear(dateStr?: string): string {
  if (!dateStr) return new Date().getFullYear().toString();
  const match = dateStr.match(/(\d{4})/);
  return match ? match[1] : new Date().getFullYear().toString();
}

function sanitizeKey(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
}

function extractAuthor(details: DatasetDetails): string {
  if (details.authors?.length) return details.authors.join(", ");
  const id = details.id;
  if (id.includes("/")) return id.split("/")[0];
  return details.source;
}

function formatBibTeX(details: DatasetDetails): string {
  const key = sanitizeKey(details.id);
  const year = extractYear(details.lastUpdated);
  const author = extractAuthor(details);

  const lines = [
    `@misc{${key},`,
    `  title     = {${details.name}},`,
    `  author    = {${author}},`,
    `  year      = {${year}},`,
    `  url       = {${details.url}},`,
    `  publisher = {${sourceLabel(details.source)}},`,
  ];

  if (details.license) {
    lines.push(`  note      = {License: ${details.license}},`);
  }

  lines.push("}");
  return lines.join("\n");
}

function formatAPA(details: DatasetDetails): string {
  const author = extractAuthor(details);
  const year = extractYear(details.lastUpdated);
  const title = details.name;
  const source = sourceLabel(details.source);
  const url = details.url;

  return `${author}. (${year}). ${title} [Dataset]. ${source}. ${url}`;
}

function formatChicago(details: DatasetDetails): string {
  const author = extractAuthor(details);
  const year = extractYear(details.lastUpdated);
  const title = details.name;
  const source = sourceLabel(details.source);
  const url = details.url;
  const accessed = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return `${author}. "${title}." Dataset. ${source}, ${year}. Accessed ${accessed}. ${url}.`;
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    kaggle: "Kaggle",
    huggingface: "Hugging Face",
    datagov: "data.gov",
    zenodo: "Zenodo",
    openml: "OpenML",
    uci: "UCI Machine Learning Repository",
    google: "Google Dataset Search",
    aws: "AWS Open Data Registry",
    worldbank: "World Bank Open Data",
    who: "WHO Global Health Observatory",
    nasa: "NASA Earthdata",
    eurostat: "Eurostat",
    socrata: "Socrata Open Data",
  };
  return labels[source] ?? source;
}
