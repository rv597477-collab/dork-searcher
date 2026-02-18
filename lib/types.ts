// Shared types for the Dork Searcher multi-engine search tool

export type EngineName = "bing" | "duckduckgo" | "yahoo" | "ask" | "yandex";

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  engine: EngineName;
}

export interface EngineResult {
  engine: EngineName;
  results: SearchResultItem[];
  status: "pending" | "searching" | "done" | "error";
  error?: string;
  totalFound: number;
  timeTaken: number; // ms
}

export interface SearchConfig {
  dork: string;
  engines: EngineName[];
  maxResultsPerEngine: number;
  maxPagesPerEngine: number;
  delayBetweenRequests: number; // ms
  timeout: number; // seconds
  proxy?: string;
}

export interface SSEEvent {
  type: "engine_start" | "engine_result" | "engine_done" | "engine_error" | "search_complete";
  engine?: EngineName;
  results?: SearchResultItem[];
  error?: string;
  totalFound?: number;
  timeTaken?: number;
}

export const ENGINE_COLORS: Record<EngineName, string> = {
  bing: "#00809d",
  duckduckgo: "#de5833",
  yahoo: "#6001d2",
  ask: "#db0a2e",
  yandex: "#fc3f1d",
};

export const ENGINE_LABELS: Record<EngineName, string> = {
  bing: "Bing",
  duckduckgo: "DuckDuckGo",
  yahoo: "Yahoo",
  ask: "Ask.com",
  yandex: "Yandex",
};
