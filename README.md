<div align="center">

# Mobus

**Dataset search for AI assistants**
Discover, preview, and analyze datasets across **20 platforms** from a single conversation.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-3c873a.svg)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-Compatible-8b5cf6.svg)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178c6.svg)](https://www.typescriptlang.org)

</div>

---

## Connect to Claude

Add Mobus to Claude in under a minute. No install, no API keys, nothing to run.

1. Open **claude.ai** (or Claude Desktop / Mobile)
2. Go to **Settings** from the bottom left → **Connectors**
3. Click **Add custom connector**
4. Name it **Mobus** and paste this URL:

```
https://mcp.mobus.ai/mcp
```

5. Start a new chat and try:

> *"Search for air quality datasets with a commercial license"*

That's it. All 15 tools are available immediately.

---

<p align="center">
  <video src="https://github.com/user-attachments/assets/a034855f-2c52-4691-8686-65ca97fe5d22" width="100%" autoplay loop muted></video>
</p>

---

<p align="center">
  <img alt="Mobus workflow: 5 stages, 15 tools" src="https://github.com/user-attachments/assets/c65b5f0c-fffe-4bd6-aacc-25277ff33aeb" width="100%" />
</p>

## What it does

Just ask your AI assistant.

> *"Search for air-quality datasets with a commercial license"*
> *"Preview the first 20 rows of that Zenodo dataset"*
> *"Find SEC filings mentioning climate risk"*
> *"Generate an APA citation for that Hugging Face dataset"*
> *"Check if this dataset can be used commercially"*
> *"Visualize that dataset"*

Mobus fans requests out to every configured platform **in parallel**, checks licenses, previews data, generates citations, and traces academic lineage — failing gracefully whenever an API key is missing.

---

## Tools

<table>
<tr><td width="50%" valign="top">

#### Discovery
- `search_datasets` — search all 20 platforms at once
- `find_research_datasets` — datasets used in papers
- `find_similar` — datasets similar to one you have

#### Evaluation
- `get_dataset_details` — full metadata
- `preview_dataset` — first N rows
- `compare_datasets` — 2-5 side by side

#### Quality & Compliance
- `assess_quality` — missing values, duplicates, stats
- `check_license` — commercial / academic / internal
- `check_compatibility` — schema match against yours

</td><td width="50%" valign="top">

#### Citation & Output
- `generate_citation` — APA, BibTeX, Chicago
- `visualize_dataset (Only works locally - ask Claude to generate an artifact).` — interactive ECharts dashboard
- `watch_query` — monitor for new datasets

#### Advanced Research
- `get_dataset_provenance` — introducing paper & history
- `get_dataset_lineage` — variants & derivatives
- `trace_citation_graph` — citation chain analysis

</td></tr>
</table>

---

## Supported platforms

<table>
<tr><td valign="top">

**No auth needed**
- data.gov
- Zenodo
- OpenML
- UCI ML Repository
- AWS Open Data
- World Bank
- WHO GHO
- NASA Earthdata
- Eurostat
- arXiv
- Census.gov
- SEC EDGAR
- Crossref
- Harvard Dataverse

</td><td valign="top">

**Optional auth**
- Hugging Face (faster w/ token)
- Socrata (faster w/ token)
- Semantic Scholar

**Requires key**
- Kaggle
- Google Dataset Search

**Degraded**
- Papers with Code *(API shut down)*
- Econdb *(now requires key)*

</td></tr>
</table>

Missing keys automatically skip that platform. The server never crashes.

---

## Run locally (optional)

If you prefer to self-host instead of using the hosted version above:

```bash
git clone https://github.com/hrantvirabyan/Mobus.git
cd Mobus
npm install
cp .env.example .env   # fill in any keys you have (all optional)
npm run build
```

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mobus": {
      "command": "node",
      "args": ["/absolute/path/to/Mobus/dist/main.js"]
    }
  }
}
```

Restart Cursor. All 15 tools appear in the chat.

### Claude Desktop

Same config format, in `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows).

### API keys (all optional)

| Variable | For | Where |
|---|---|---|
| `KAGGLE_USERNAME` / `KAGGLE_KEY` | Kaggle | [kaggle.com/account](https://www.kaggle.com/account) → API |
| `HF_TOKEN` | Hugging Face | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) |
| `GOOGLE_API_KEY` / `GOOGLE_CSE_ID` | Google | [console.cloud.google.com](https://console.cloud.google.com/apis/credentials) |
| `SOCRATA_APP_TOKEN` | Socrata | [dev.socrata.com/register](https://dev.socrata.com/register/) |

---

## Tool reference

<details>
<summary><b>Click to expand full parameter reference</b></summary>

### `search_datasets`
| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | string | required | Search query |
| `sources` | string[] | all | Platforms to include |
| `limit` | number | 5 | Results per source (max 20) |
| `license` | string | — | e.g. `cc-by-4.0` |
| `format` | string | — | e.g. `csv`, `parquet` |
| `updated_after` | string | — | ISO date |
| `modality` | string | — | e.g. `tabular`, `image` |

### `get_dataset_details`
| Parameter | Type | Description |
|---|---|---|
| `source` | string | Platform |
| `dataset_id` | string | Dataset ID |

### `preview_dataset`
| Parameter | Type | Default | Description |
|---|---|---|---|
| `source` / `dataset_id` | string | required | — |
| `rows` | number | 10 | Max 100 |

### `visualize_dataset (Only works locally - ask Claude to generate an artifact)`
Generates an interactive ECharts dashboard with column picker, filter builder, row range selector, 9 chart types, sortable table, and PNG/SVG/CSV/JSON export.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `source` / `dataset_id` | string | required | — |
| `rows` | number | 200 | Max 500 |
| `open` | boolean | true | Auto-open browser |

### `compare_datasets`
| Parameter | Type | Description |
|---|---|---|
| `datasets` | array | 2-5 `{source, dataset_id}` objects |

### `check_compatibility`
| Parameter | Type | Description |
|---|---|---|
| `source` / `dataset_id` | string | — |
| `schema` | array | `[{name, type?}]` |

### `find_similar`
| Parameter | Type | Default | Description |
|---|---|---|---|
| `source` / `dataset_id` | string | required | — |
| `limit` | number | 5 | Max 20 |

### `generate_citation`
| Parameter | Type | Default | Description |
|---|---|---|---|
| `source` / `dataset_id` | string | required | — |
| `format` | string | `apa` | `bibtex`, `apa`, `chicago` |

### `assess_quality`
| Parameter | Type | Default | Description |
|---|---|---|---|
| `source` / `dataset_id` | string | required | — |
| `sample_rows` | number | 100 | Max 500 |

### `check_license`
| Parameter | Type | Description |
|---|---|---|
| `source` / `dataset_id` | string | — |
| `use_case` | string | `commercial` / `academic` / `internal` / `redistribution` |

### `watch_query`
| Parameter | Type | Description |
|---|---|---|
| `action` | string | `add` / `remove` / `list` / `check` |
| `query` / `sources` / `watch_id` | — | See action |

### `find_research_datasets`
| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | string | required | Research topic |
| `limit` | number | 10 | Max 20 |
| `semantic` | boolean | false | SPECTER v2 embeddings |

### `get_dataset_provenance` / `trace_citation_graph` / `get_dataset_lineage`
> Currently degraded — depend on the Papers with Code API which has shut down.

</details>

---

## Known issues

- **Papers with Code API** shut down post-HuggingFace acquisition — lineage/provenance/citation-graph tools return errors
- **Econdb** now requires a key — returns empty until support is added
- **arXiv** rate-limits under heavy parallel load (adapter uses 3s throttle)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). If Mobus saves you time, a GitHub star helps others find it.

## License

MIT — see [LICENSE](LICENSE).
