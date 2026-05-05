import type { DatasetResult, SearchSource, SourceAdapter, WatchEntry } from "../types.js";
import {
  addWatch,
  removeWatch,
  listWatches,
  getWatch,
  updateWatch,
} from "../utils/watch-store.js";

export type WatchAction = "add" | "remove" | "list" | "check";

export interface WatchResult {
  action: WatchAction;
  watches?: WatchEntry[];
  watch?: WatchEntry;
  removed?: boolean;
  newDatasets?: DatasetResult[];
  message: string;
}

export async function watchQuery(
  adapters: Map<SearchSource, SourceAdapter>,
  action: WatchAction,
  options: {
    query?: string;
    sources?: SearchSource[];
    watchId?: string;
  },
): Promise<WatchResult> {
  switch (action) {
    case "add": {
      if (!options.query) throw new Error("A 'query' is required for the 'add' action.");
      const watch = await addWatch(options.query, options.sources);
      return {
        action: "add",
        watch,
        message: `Watch "${watch.id}" created for query "${options.query}".`,
      };
    }

    case "remove": {
      if (!options.watchId) throw new Error("A 'watch_id' is required for the 'remove' action.");
      const removed = await removeWatch(options.watchId);
      return {
        action: "remove",
        removed,
        message: removed
          ? `Watch "${options.watchId}" removed.`
          : `Watch "${options.watchId}" not found.`,
      };
    }

    case "list": {
      const watches = await listWatches();
      return {
        action: "list",
        watches,
        message: `${watches.length} watch(es) found.`,
      };
    }

    case "check": {
      if (!options.watchId) throw new Error("A 'watch_id' is required for the 'check' action.");
      const watch = await getWatch(options.watchId);
      if (!watch) throw new Error(`Watch "${options.watchId}" not found.`);

      const selected = watch.sources ?? [...adapters.keys()];
      const allResults: DatasetResult[] = [];

      const settled = await Promise.allSettled(
        selected.map(async (src) => {
          const adapter = adapters.get(src);
          if (!adapter) return [];
          return adapter.search(watch.query, 10);
        }),
      );

      for (const outcome of settled) {
        if (outcome.status === "fulfilled") {
          allResults.push(...outcome.value);
        }
      }

      const previousIds = new Set(watch.lastResultIds ?? []);
      const currentIds = allResults.map((r) => `${r.source}:${r.id}`);
      const newDatasets = allResults.filter(
        (r) => !previousIds.has(`${r.source}:${r.id}`),
      );

      await updateWatch(watch.id, {
        lastCheckedAt: new Date().toISOString(),
        lastResultIds: currentIds,
      });

      return {
        action: "check",
        watch,
        newDatasets,
        message:
          newDatasets.length > 0
            ? `${newDatasets.length} new dataset(s) found since last check.`
            : "No new datasets since last check.",
      };
    }
  }
}
