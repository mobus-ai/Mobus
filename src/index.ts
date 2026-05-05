import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SEARCH_SOURCES, ENRICHMENT_SOURCES, type SearchSource, type EnrichmentSource, type SourceAdapter } from "./types.js";
import { buildEnrichmentMap, enrichDoi } from "./utils/enrichment.js";
import { searchDatasets, type SearchFilters } from "./tools/search-datasets.js";
import { getDatasetDetails } from "./tools/get-dataset-details.js";
import { previewDataset } from "./tools/preview-dataset.js";
import { compareDatasets, type DatasetRef } from "./tools/compare-datasets.js";
import { checkCompatibility, type SchemaColumn } from "./tools/check-compatibility.js";
import { findSimilar } from "./tools/find-similar.js";
import { generateCitation } from "./tools/generate-citation.js";
import { assessQuality } from "./tools/assess-quality.js";
import { checkLicense } from "./tools/check-license.js";
import { watchQuery, type WatchAction } from "./tools/watch-query.js";
import { visualizeDataset } from "./tools/visualize-dataset.js";
import { listWatches } from "./utils/watch-store.js";

import { kaggleAdapter } from "./adapters/kaggle.js";
import { huggingFaceAdapter } from "./adapters/huggingface.js";
import { dataGovAdapter } from "./adapters/datagov.js";
import { zenodoAdapter } from "./adapters/zenodo.js";
import { openMLAdapter } from "./adapters/openml.js";
import { uciAdapter } from "./adapters/uci.js";
import { googleAdapter } from "./adapters/google.js";
import { awsAdapter } from "./adapters/aws.js";
import { worldBankAdapter } from "./adapters/worldbank.js";
import { whoAdapter } from "./adapters/who.js";
import { nasaAdapter } from "./adapters/nasa.js";
import { eurostatAdapter } from "./adapters/eurostat.js";
import { socrataAdapter } from "./adapters/socrata.js";
import { semanticScholarAdapter } from "./adapters/semantic-scholar.js";
import { arxivAdapter } from "./adapters/arxiv.js";
import { censusAdapter } from "./adapters/census.js";
import { secEdgarAdapter } from "./adapters/sec-edgar.js";
import { crossrefAdapter } from "./adapters/crossref.js";
import { harvardDataverseAdapter } from "./adapters/harvard-dataverse.js";
import { openAlexAdapter } from "./adapters/openalex.js";
import { europmcAdapter } from "./adapters/europepmc.js";
import { openReviewAdapter } from "./adapters/openreview.js";
import { dataCiteAdapter } from "./adapters/datacite.js";
import { githubAdapter } from "./adapters/github.js";
import { huggingFaceModelsAdapter } from "./adapters/huggingface-models.js";
import { openNeuroAdapter } from "./adapters/openneuro.js";
import { findResearchDatasets } from "./tools/find-research-datasets.js";

export function buildAdapterMap(): Map<SearchSource, SourceAdapter> {
  const adapters = new Map<SearchSource, SourceAdapter>();

  const all: SourceAdapter[] = [
    kaggleAdapter,
    huggingFaceAdapter,
    dataGovAdapter,
    zenodoAdapter,
    openMLAdapter,
    uciAdapter,
    googleAdapter,
    awsAdapter,
    worldBankAdapter,
    whoAdapter,
    nasaAdapter,
    eurostatAdapter,
    socrataAdapter,
    semanticScholarAdapter,
    arxivAdapter,
    censusAdapter,
    secEdgarAdapter,
    crossrefAdapter,
    harvardDataverseAdapter,
    openAlexAdapter,
    europmcAdapter,
    openReviewAdapter,
    dataCiteAdapter,
    githubAdapter,
    huggingFaceModelsAdapter,
    openNeuroAdapter,
  ];

  for (const adapter of all) {
    adapters.set(adapter.source, adapter);
  }

  if (!process.env.KAGGLE_USERNAME || !process.env.KAGGLE_KEY) {
    adapters.delete("kaggle");
    console.error("[mobus] Kaggle adapter disabled — set KAGGLE_USERNAME and KAGGLE_KEY");
  }

  if (!process.env.GOOGLE_API_KEY || !process.env.GOOGLE_CSE_ID) {
    adapters.delete("google");
    console.error("[mobus] Google adapter disabled — set GOOGLE_API_KEY and GOOGLE_CSE_ID");
  }

  return adapters;
}

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: true };
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };

export interface ServerOptions {
  baseUrl?: string;
}

const DEFAULT_PUBLIC_URL = "https://mobus-production.up.railway.app";

export function createServer(opts: ServerOptions = {}): {
  server: McpServer;
  adapters: Map<SearchSource, SourceAdapter>;
} {
  const adapters = buildAdapterMap();
  const enrichers = buildEnrichmentMap();
  const publicUrl = opts.baseUrl ?? process.env.BASE_URL ?? DEFAULT_PUBLIC_URL;

  const server = new McpServer({
    name: "mobus",
    title: "Mobus",
    version: "2.1.0",
    description: "Dataset and research paper search for AI assistants across 26 platforms, with DOI enrichment via Unpaywall, OpenCitations, and NIH iCite.",
    websiteUrl: publicUrl,
    icons: [
      {
        src: `${publicUrl}/logo.png`,
        mimeType: "image/png",
        sizes: ["256x256"],
      },
    ],
  });

  const sourceEnum = z.enum(SEARCH_SOURCES as unknown as [string, ...string[]]);

  // ─── Tool: search_datasets ──────────────────────────────────────────────────

  server.tool(
    "search_datasets",
    "Search for datasets and papers across 26 platforms (Kaggle, Hugging Face, data.gov, Zenodo, OpenML, UCI, Google, AWS, World Bank, WHO, NASA, Eurostat, Socrata, Semantic Scholar, arXiv, Census.gov, SEC EDGAR, Crossref, Harvard Dataverse, OpenAlex, Europe PMC, OpenReview, DataCite, GitHub, HuggingFace Models, OpenNeuro) with deduplication and optional filters",
    {
      query: z.string().describe("Search query, e.g. 'climate change temperature'"),
      sources: z
        .array(sourceEnum)
        .optional()
        .describe("Platforms to search. Omit to search all available sources."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .default(5)
        .describe("Maximum results per source (default 5)"),
      license: z
        .string()
        .optional()
        .describe("Filter by license (e.g. 'cc-by-4.0', 'apache', 'mit')"),
      format: z
        .string()
        .optional()
        .describe("Filter by data format (e.g. 'csv', 'parquet', 'json')"),
      updated_after: z
        .string()
        .optional()
        .describe("Only include datasets updated after this ISO date (e.g. '2024-01-01')"),
      modality: z
        .string()
        .optional()
        .describe("Filter by modality (e.g. 'tabular', 'text', 'image')"),
    },
    READ_ONLY,
    async ({ query, sources, limit, license, format, updated_after, modality }) => {
      const filters: SearchFilters = {};
      if (license) filters.license = license;
      if (format) filters.format = format;
      if (updated_after) filters.updatedAfter = updated_after;
      if (modality) filters.modality = modality;

      const { results, errors } = await searchDatasets(
        adapters,
        query,
        sources as SearchSource[] | undefined,
        limit,
        Object.keys(filters).length > 0 ? filters : undefined,
      );

      const payload: Record<string, unknown> = { results };
      if (Object.keys(errors).length > 0) {
        payload.errors = errors;
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
      };
    },
  );

  // ─── Tool: get_dataset_details ──────────────────────────────────────────────

  server.tool(
    "get_dataset_details",
    "Get detailed metadata for a specific dataset (columns, row count, files, popularity)",
    {
      source: sourceEnum.describe("The platform the dataset is from"),
      dataset_id: z
        .string()
        .describe("The dataset ID as returned by search_datasets"),
    },
    READ_ONLY,
    async ({ source, dataset_id }) => {
      const details = await getDatasetDetails(adapters, source as SearchSource, dataset_id);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(details, null, 2) }],
      };
    },
  );

  // ─── Tool: preview_dataset ──────────────────────────────────────────────────

  server.tool(
    "preview_dataset",
    "Preview the first N rows of a dataset to inspect its data before downloading",
    {
      source: sourceEnum.describe("The platform the dataset is from"),
      dataset_id: z.string().describe("The dataset ID"),
      rows: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(10)
        .describe("Number of rows to preview (default 10, max 100)"),
    },
    READ_ONLY,
    async ({ source, dataset_id, rows }) => {
      const preview = await previewDataset(adapters, source as SearchSource, dataset_id, rows);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(preview, null, 2) }],
      };
    },
  );

  // ─── Tool: compare_datasets ─────────────────────────────────────────────────

  server.tool(
    "compare_datasets",
    "Compare 2-5 datasets side by side: columns, sizes, licenses, and column overlap",
    {
      datasets: z
        .array(
          z.object({
            source: sourceEnum,
            dataset_id: z.string(),
          }),
        )
        .min(2)
        .max(5)
        .describe("Array of datasets to compare (2-5 items, each with source and dataset_id)"),
    },
    READ_ONLY,
    async ({ datasets }) => {
      const result = await compareDatasets(adapters, datasets as DatasetRef[]);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ─── Tool: check_compatibility ──────────────────────────────────────────────

  server.tool(
    "check_compatibility",
    "Check if a dataset's schema matches your expected columns and types",
    {
      source: sourceEnum.describe("The platform the dataset is from"),
      dataset_id: z.string().describe("The dataset ID"),
      schema: z
        .array(
          z.object({
            name: z.string().describe("Column name"),
            type: z.string().optional().describe("Expected column type"),
          }),
        )
        .min(1)
        .describe("Your expected schema: array of column definitions"),
    },
    READ_ONLY,
    async ({ source, dataset_id, schema }) => {
      const result = await checkCompatibility(
        adapters,
        source as SearchSource,
        dataset_id,
        schema as SchemaColumn[],
      );
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ─── Tool: find_similar ─────────────────────────────────────────────────────

  server.tool(
    "find_similar",
    "Find datasets similar to a given dataset based on tags, name, and description",
    {
      source: sourceEnum.describe("The platform the reference dataset is from"),
      dataset_id: z.string().describe("The reference dataset ID"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .default(5)
        .describe("Maximum similar datasets to return (default 5)"),
    },
    READ_ONLY,
    async ({ source, dataset_id, limit }) => {
      const result = await findSimilar(adapters, source as SearchSource, dataset_id, limit);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ─── Tool: generate_citation ────────────────────────────────────────────────

  server.tool(
    "generate_citation",
    "Generate a formatted citation (BibTeX, APA, or Chicago) for a dataset",
    {
      source: sourceEnum.describe("The platform the dataset is from"),
      dataset_id: z.string().describe("The dataset ID"),
      format: z
        .enum(["bibtex", "apa", "chicago"])
        .optional()
        .default("apa")
        .describe("Citation format: bibtex, apa, or chicago (default apa)"),
    },
    READ_ONLY,
    async ({ source, dataset_id, format }) => {
      const result = await generateCitation(adapters, source as SearchSource, dataset_id, format);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ─── Tool: assess_quality ───────────────────────────────────────────────────

  server.tool(
    "assess_quality",
    "Assess data quality: missing values, duplicates, basic statistics, and date freshness",
    {
      source: sourceEnum.describe("The platform the dataset is from"),
      dataset_id: z.string().describe("The dataset ID"),
      sample_rows: z
        .number()
        .int()
        .min(10)
        .max(500)
        .optional()
        .default(100)
        .describe("Number of rows to sample for analysis (default 100, max 500)"),
    },
    READ_ONLY,
    async ({ source, dataset_id, sample_rows }) => {
      const report = await assessQuality(adapters, source as SearchSource, dataset_id, sample_rows);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }],
      };
    },
  );

  // ─── Tool: check_license ────────────────────────────────────────────────────

  server.tool(
    "check_license",
    "Check if a dataset's license permits a specific use case (commercial, academic, internal, redistribution)",
    {
      source: sourceEnum.describe("The platform the dataset is from"),
      dataset_id: z.string().describe("The dataset ID"),
      use_case: z
        .enum(["commercial", "academic", "internal", "redistribution"])
        .describe("Your intended use case"),
    },
    READ_ONLY,
    async ({ source, dataset_id, use_case }) => {
      const result = await checkLicense(adapters, source as SearchSource, dataset_id, use_case);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // Check ─── Tool: watch_query ──────────────────────────────────────────────────────

  server.tool(
    "watch_query",
    "Save, remove, list, or check dataset search watches for monitoring new datasets",
    {
      action: z
        .enum(["add", "remove", "list", "check"])
        .describe("Action: add a watch, remove a watch, list all watches, or check for new results"),
      query: z
        .string()
        .optional()
        .describe("Search query (required for 'add' action)"),
      sources: z
        .array(sourceEnum)
        .optional()
        .describe("Platforms to watch (optional, defaults to all)"),
      watch_id: z
        .string()
        .optional()
        .describe("Watch ID (required for 'remove' and 'check' actions)"),
    },
    DESTRUCTIVE,
    async ({ action, query, sources, watch_id }) => {
      const result = await watchQuery(adapters, action as WatchAction, {
        query,
        sources: sources as SearchSource[] | undefined,
        watchId: watch_id,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ─── Tool: visualize_dataset ─────────────────────────────────────────────────

  server.tool(
    "visualize_dataset",
    "Generate an interactive ECharts dashboard to explore a dataset visually — charts, filters, table view, and export. In remote mode returns a URL; locally opens in the browser.",
    {
      source: sourceEnum.describe("The platform the dataset is from"),
      dataset_id: z.string().describe("The dataset ID"),
      rows: z
        .number()
        .int()
        .min(10)
        .max(500)
        .optional()
        .default(200)
        .describe("Number of rows to load into the dashboard (default 200, max 500)"),
      open: z
        .boolean()
        .optional()
        .default(true)
        .describe("Auto-open the dashboard in the default browser (default true, ignored in remote mode)"),
    },
    DESTRUCTIVE,
    async ({ source, dataset_id, rows, open: shouldOpen }) => {
      const result = await visualizeDataset(
        adapters,
        source as SearchSource,
        dataset_id,
        rows,
        shouldOpen,
        opts.baseUrl,
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: result.url
                  ? `Interactive dashboard generated. Open in your browser.`
                  : `Interactive dashboard generated and ${shouldOpen ? "opened in browser" : "saved"}.`,
                ...(result.url ? { url: result.url } : { filePath: result.filePath }),
                rowsLoaded: result.rowCount,
                columns: result.columnCount,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ─── Tool: find_research_datasets ────────────────────────────────────────────

  server.tool(
    "find_research_datasets",
    "Find datasets used in academic research for a given topic — searches Semantic Scholar and arXiv for paper metadata, and cross-references against all other sources",
    {
      query: z.string().describe("Research topic or task, e.g. 'sentiment analysis', 'medical image segmentation'"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .default(10)
        .describe("Maximum datasets to return (default 10)"),
      max_papers_per_dataset: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .default(5)
        .describe("Maximum sample papers to show per dataset (default 5)"),
      semantic: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "Use SPECTER v2 embeddings for semantic paper matching (slower but better for conceptual queries like 'detecting sarcasm in social media')",
        ),
    },
    READ_ONLY,
    async ({ query, limit, max_papers_per_dataset, semantic }) => {
      const result = await findResearchDatasets(adapters, query, limit, max_papers_per_dataset, semantic);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ─── Tool: enrich_result ────────────────────────────────────────────────────

  const enrichmentSourceEnum = z.enum(
    ENRICHMENT_SOURCES as unknown as [string, ...string[]],
  );

  server.tool(
    "enrich_result",
    "Enrich a dataset or paper by DOI: resolve open-access links, PDF URLs, citation counts, and reference graphs via Unpaywall, OpenCitations, and NIH iCite",
    {
      doi: z.string().describe("The DOI to enrich (e.g. '10.1234/foo')"),
      sources: z
        .array(enrichmentSourceEnum)
        .optional()
        .describe("Enrichment sources to query. Omit to query all available."),
    },
    READ_ONLY,
    async ({ doi, sources }) => {
      const results = await enrichDoi(enrichers, doi, sources as EnrichmentSource[] | undefined);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
      };
    },
  );

  // ─── Resource: watches://list ───────────────────────────────────────────────

  server.resource(
    "watches-list",
    "watches://list",
    { description: "List all saved dataset search watches", mimeType: "application/json" },
    async () => {
      const watches = await listWatches();
      return {
        contents: [
          {
            uri: "watches://list",
            text: JSON.stringify(watches, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    },
  );

  return { server, adapters };
}
