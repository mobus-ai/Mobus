# Contributing to Mobus

Thanks for your interest in contributing! Here's how to get started.

## Getting Started

1. Fork the repository
2. Clone your fork and install dependencies:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Mobus.git
   cd Mobus
   npm install
   ```
3. Create a branch for your work:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. Copy `.env.example` to `.env` and add any API keys you have (most sources work without keys).

## Development

```bash
# Type-check
npx tsc --noEmit

# Build
npm run build

# Run locally in stdio mode
npm run dev:stdio
```

## Project Structure

- `src/adapters/` — One file per data platform (Kaggle, HuggingFace, etc.)
- `src/tools/` — One file per MCP tool (search, preview, visualize, etc.)
- `src/utils/` — Shared helpers (caching, HTTP, chart generation, etc.)
- `src/index.ts` — MCP server factory that registers all tools
- `src/main.ts` — Entry point (stdio vs HTTP mode)

## Adding a New Data Platform

1. Create a new adapter in `src/adapters/your-platform.ts`
2. Export functions that match the patterns used by existing adapters (search, details, preview)
3. Register it in `src/index.ts`
4. Add the platform to the supported platforms table in `README.md`

## Adding a New Tool

1. Create `src/tools/your-tool.ts`
2. Define the Zod schema for input validation
3. Register the tool in `src/index.ts`
4. Document it in `README.md`

## Pull Requests

- Keep PRs focused — one feature or fix per PR
- Make sure `npx tsc --noEmit` passes with no errors
- Update the README if you're adding a new tool or platform
- Write a clear PR description explaining what changed and why

## Reporting Issues

Use the GitHub issue templates for [bug reports](.github/ISSUE_TEMPLATE/bug_report.yml) and [feature requests](.github/ISSUE_TEMPLATE/feature_request.yml).

## Code Style

- TypeScript with strict mode
- ES modules (`import`/`export`, not `require`)
- Descriptive variable and function names
- Keep adapters and tools as self-contained as possible
