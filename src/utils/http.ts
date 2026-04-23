import { apiCache } from "./cache.js";

export interface FetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface CachedFetchOptions extends FetchOptions {
  cacheTtlMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 3;

export class HttpError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: string,
  ) {
    super(`HTTP ${status} ${statusText}`);
    this.name = "HttpError";
  }
}

export async function fetchJSON<T = unknown>(
  url: string,
  options: FetchOptions = {},
): Promise<T> {
  const {
    headers = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const isRateLimit = lastError instanceof HttpError && lastError.status === 429;
      const delay = isRateLimit
        ? Math.min(3000 * 2 ** (attempt - 1), 15000)
        : Math.min(1000 * 2 ** (attempt - 1), 8000);
      await new Promise((r) => setTimeout(r, delay));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", ...headers },
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new HttpError(res.status, res.statusText, body);
      }

      return (await res.json()) as T;
    } catch (err) {
      lastError = err as Error;

      // Retry on 429 (rate limit) with longer backoff; throw immediately on other 4xx
      if (err instanceof HttpError && err.status >= 400 && err.status < 500 && err.status !== 429) {
        throw err;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error(`fetchJSON failed for ${url}`);
}

export async function cachedFetchJSON<T = unknown>(
  url: string,
  options: CachedFetchOptions = {},
): Promise<T> {
  const { cacheTtlMs, ...fetchOpts } = options;
  if (cacheTtlMs) {
    const cached = apiCache.get<T>(url);
    if (cached !== undefined) return cached;
  }
  const result = await fetchJSON<T>(url, fetchOpts);
  if (cacheTtlMs) apiCache.set(url, result, cacheTtlMs);
  return result;
}
