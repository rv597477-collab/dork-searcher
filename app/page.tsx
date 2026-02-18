"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { EngineName, SearchResultItem, SSEEvent } from "@/lib/types";
import TemplatesDrawer from "@/components/TemplatesDrawer";

// ─── Constants ──────────────────────────────────────────────────────────────

const ALL_ENGINES: EngineName[] = ["bing", "duckduckgo", "yahoo", "ask", "yandex"];

const ENGINE_META: Record<
  EngineName,
  { label: string; color: string; bg: string; border: string; icon: string }
> = {
  bing: {
    label: "Bing",
    color: "#00809d",
    bg: "rgba(0,128,157,0.12)",
    border: "rgba(0,128,157,0.3)",
    icon: "B",
  },
  duckduckgo: {
    label: "DuckDuckGo",
    color: "#de5833",
    bg: "rgba(222,88,51,0.12)",
    border: "rgba(222,88,51,0.3)",
    icon: "D",
  },
  yahoo: {
    label: "Yahoo",
    color: "#6001d2",
    bg: "rgba(96,1,210,0.12)",
    border: "rgba(96,1,210,0.3)",
    icon: "Y",
  },
  ask: {
    label: "Ask.com",
    color: "#db0a2e",
    bg: "rgba(219,10,46,0.12)",
    border: "rgba(219,10,46,0.3)",
    icon: "A",
  },
  yandex: {
    label: "Yandex",
    color: "#fc3f1d",
    bg: "rgba(252,63,29,0.12)",
    border: "rgba(252,63,29,0.3)",
    icon: "Я",
  },
};

type SortMode = "relevance" | "engine";

interface EngineStatus {
  status: "idle" | "searching" | "done" | "error";
  resultCount: number;
  timeTaken: number;
  error?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function ts() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function DorkSearcher() {
  // Search state
  const [dork, setDork] = useState("");
  const [selectedEngines, setSelectedEngines] = useState<Set<EngineName>>(
    new Set(["duckduckgo", "bing"])
  );
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [engineStatuses, setEngineStatuses] = useState<Record<EngineName, EngineStatus>>(
    Object.fromEntries(
      ALL_ENGINES.map((e) => [e, { status: "idle", resultCount: 0, timeTaken: 0 }])
    ) as Record<EngineName, EngineStatus>
  );

  // Config
  const [maxResultsPerEngine, setMaxResultsPerEngine] = useState(20);
  const [maxPagesPerEngine, setMaxPagesPerEngine] = useState(2);
  const [delayBetweenRequests, setDelayBetweenRequests] = useState(1000);
  const [timeout, setTimeoutVal] = useState(15);
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [showConfig, setShowConfig] = useState(false);
  const [filterEngine, setFilterEngine] = useState<EngineName | "all">("all");

  // Log
  const [logs, setLogs] = useState<{ time: string; msg: string; type: string }[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Templates drawer
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = useCallback((msg: string, type = "info") => {
    setLogs((prev) => [...prev.slice(-200), { time: ts(), msg, type }]);
  }, []);

  // ─── Engine Toggle ──────────────────────────────────────────────────────

  const toggleEngine = (engine: EngineName) => {
    setSelectedEngines((prev) => {
      const next = new Set(prev);
      if (next.has(engine)) {
        if (next.size > 1) next.delete(engine);
      } else {
        next.add(engine);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedEngines(new Set(ALL_ENGINES));

  // ─── Search ─────────────────────────────────────────────────────────────

  const startSearch = useCallback(async () => {
    if (!dork.trim() || isSearching) return;

    setIsSearching(true);
    setResults([]);
    setLogs([]);
    setFilterEngine("all");

    // Reset engine statuses
    const freshStatuses = Object.fromEntries(
      ALL_ENGINES.map((e) => [
        e,
        { status: selectedEngines.has(e) ? "idle" : "idle", resultCount: 0, timeTaken: 0 },
      ])
    ) as Record<EngineName, EngineStatus>;
    setEngineStatuses(freshStatuses);

    const engines = Array.from(selectedEngines);
    addLog(`Starting search: "${dork}" across ${engines.map((e) => ENGINE_META[e].label).join(", ")}`);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dork: dork.trim(),
          engines,
          maxResultsPerEngine,
          maxPagesPerEngine,
          delayBetweenRequests,
          timeout,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        addLog(`Search failed: HTTP ${res.status}`, "error");
        setIsSearching(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const dataMatch = line.match(/^data:\s*(.*)/m);
          if (!dataMatch) continue;

          try {
            const event: SSEEvent = JSON.parse(dataMatch[1]);

            switch (event.type) {
              case "engine_start":
                if (event.engine) {
                  addLog(`${ENGINE_META[event.engine].label} searching...`, "start");
                  setEngineStatuses((prev) => ({
                    ...prev,
                    [event.engine!]: { ...prev[event.engine!], status: "searching" },
                  }));
                }
                break;

              case "engine_result":
                if (event.engine && event.results) {
                  addLog(
                    `${ENGINE_META[event.engine].label} found ${event.results.length} results`,
                    "found"
                  );
                  setResults((prev) => [...prev, ...event.results!]);
                }
                break;

              case "engine_done":
                if (event.engine) {
                  addLog(
                    `${ENGINE_META[event.engine].label} done — ${event.totalFound || 0} results in ${((event.timeTaken || 0) / 1000).toFixed(1)}s`,
                    "done"
                  );
                  setEngineStatuses((prev) => ({
                    ...prev,
                    [event.engine!]: {
                      status: "done",
                      resultCount: event.totalFound || 0,
                      timeTaken: event.timeTaken || 0,
                    },
                  }));
                }
                break;

              case "engine_error":
                if (event.engine) {
                  addLog(
                    `${ENGINE_META[event.engine].label} error: ${event.error}`,
                    "error"
                  );
                  setEngineStatuses((prev) => ({
                    ...prev,
                    [event.engine!]: {
                      status: "error",
                      resultCount: 0,
                      timeTaken: event.timeTaken || 0,
                      error: event.error,
                    },
                  }));
                }
                break;

              case "search_complete":
                addLog("All engines finished", "complete");
                break;
            }
          } catch {
            // skip unparseable
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        addLog(`Search error: ${err.message}`, "error");
      }
    }

    setIsSearching(false);
    abortRef.current = null;
  }, [dork, isSearching, selectedEngines, maxResultsPerEngine, maxPagesPerEngine, delayBetweenRequests, timeout, addLog]);

  const stopSearch = () => {
    abortRef.current?.abort();
    setIsSearching(false);
    addLog("Search stopped by user", "warn");
  };

  // ─── Deduplicated + filtered results ────────────────────────────────────

  const deduped = (() => {
    const seen = new Set<string>();
    const out: (SearchResultItem & { duplicate?: boolean })[] = [];
    for (const r of results) {
      if (seen.has(r.url)) continue;
      seen.add(r.url);
      out.push(r);
    }
    return out;
  })();

  const duplicateCount = results.length - deduped.length;

  const filtered =
    filterEngine === "all" ? deduped : deduped.filter((r) => r.engine === filterEngine);

  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === "engine") {
      return ALL_ENGINES.indexOf(a.engine) - ALL_ENGINES.indexOf(b.engine);
    }
    return 0; // relevance = order returned by engines
  });

  // ─── Stats ──────────────────────────────────────────────────────────────

  const totalResults = deduped.length;
  const activeEngineCount = Array.from(selectedEngines).filter(
    (e) => engineStatuses[e].status === "searching"
  ).length;
  const doneEngineCount = Array.from(selectedEngines).filter(
    (e) => engineStatuses[e].status === "done"
  ).length;
  const errorEngineCount = Array.from(selectedEngines).filter(
    (e) => engineStatuses[e].status === "error"
  ).length;

  // ─── Export ─────────────────────────────────────────────────────────────

  const exportResults = async (format: "csv" | "json" | "txt") => {
    const exportData = sorted.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      engine: r.engine,
    }));

    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: exportData, format }),
      });

      if (!res.ok) return;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dork-results.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      addLog(`Exported ${exportData.length} results as ${format.toUpperCase()}`);
    } catch {
      addLog("Export failed", "error");
    }
  };

  const copyAllUrls = () => {
    const text = sorted.map((r) => r.url).join("\n");
    navigator.clipboard.writeText(text);
    addLog(`Copied ${sorted.length} URLs to clipboard`);
  };

  // ─── Template Selection ─────────────────────────────────────────────

  const handleTemplateSelect = (query: string, mode: "set" | "append") => {
    if (mode === "set") {
      setDork(query);
      addLog(`Template loaded: "${query}"`, "info");
    } else {
      const newDork = dork.trim() ? `${dork.trim()} ${query}` : query;
      setDork(newDork);
      addLog(`Template appended: "${query}"`, "info");
    }
    setShowTemplates(false);
  };

  // Close templates drawer with ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showTemplates) {
        setShowTemplates(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showTemplates]);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#08090c] text-gray-200 font-mono">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        {/* ── Header ──────────────────────────────────────────────── */}
        <header className="text-center py-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-wider">
            <span className="text-gray-400">DORK</span>{" "}
            <span className="text-emerald-400">SEARCHER</span>
          </h1>
          <p className="text-xs text-gray-600 mt-1.5 tracking-wide">
            Multi-Engine Search Tool — Bing · DuckDuckGo · Yahoo · Ask · Yandex
          </p>
        </header>

        {/* ── Search Bar ──────────────────────────────────────────── */}
        <div className="ds-card p-4">
          <div className="flex gap-3">
            <button
              onClick={() => setShowTemplates(true)}
              className="ds-btn-sm h-11 px-4 hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-400 shrink-0"
              title="Open Dork Templates"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <span className="hidden sm:inline">TEMPLATES</span>
            </button>
            <div className="flex-1 relative">
              <input
                type="text"
                value={dork}
                onChange={(e) => setDork(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && startSearch()}
                placeholder='Enter dork query (e.g., site:example.com inurl:admin)'
                className="ds-input w-full pr-10 text-sm h-11"
                spellCheck={false}
              />
              <svg
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            {isSearching ? (
              <button onClick={stopSearch} className="ds-btn-danger h-11 px-6">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h12v12H6z" />
                </svg>
                STOP
              </button>
            ) : (
              <button
                onClick={startSearch}
                disabled={!dork.trim() || selectedEngines.size === 0}
                className="ds-btn-primary h-11 px-6 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                SEARCH
              </button>
            )}
          </div>
        </div>

        {/* ── Engine Selector ─────────────────────────────────────── */}
        <div className="ds-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Search Engines
            </h2>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-[0.65rem] text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-wider"
              >
                Select All
              </button>
              <span className="text-gray-700">|</span>
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="text-[0.65rem] text-gray-500 hover:text-gray-300 transition-colors uppercase tracking-wider flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Settings
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {ALL_ENGINES.map((engine) => {
              const meta = ENGINE_META[engine];
              const selected = selectedEngines.has(engine);
              const status = engineStatuses[engine];

              return (
                <button
                  key={engine}
                  onClick={() => toggleEngine(engine)}
                  className={`relative rounded-lg p-3 transition-all duration-200 text-left border ${
                    selected
                      ? "border-opacity-60 shadow-lg"
                      : "border-gray-800/50 opacity-40 hover:opacity-70"
                  }`}
                  style={{
                    borderColor: selected ? meta.border : undefined,
                    background: selected ? meta.bg : "rgba(17,17,24,0.5)",
                  }}
                >
                  {/* Status indicator */}
                  {status.status !== "idle" && (
                    <div className="absolute top-2 right-2">
                      {status.status === "searching" && (
                        <div
                          className="w-2 h-2 rounded-full animate-pulse"
                          style={{ background: meta.color }}
                        />
                      )}
                      {status.status === "done" && (
                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                      {status.status === "error" && (
                        <svg className="w-3.5 h-3.5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: meta.color }}
                    >
                      {meta.icon}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: selected ? meta.color : "#9ca3af" }}>
                      {meta.label}
                    </span>
                  </div>

                  {status.status === "done" && (
                    <div className="text-[0.6rem] text-gray-500 mt-1">
                      {status.resultCount} results · {(status.timeTaken / 1000).toFixed(1)}s
                    </div>
                  )}
                  {status.status === "error" && (
                    <div className="text-[0.6rem] text-red-400/70 mt-1 truncate">
                      {status.error || "Failed"}
                    </div>
                  )}
                  {status.status === "searching" && (
                    <div className="text-[0.6rem] mt-1" style={{ color: meta.color }}>
                      Searching...
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Configuration Panel ───────────────────────────────── */}
          {showConfig && (
            <div className="mt-4 pt-4 border-t border-gray-800/50 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-[0.65rem] text-gray-500 uppercase tracking-wider block mb-1">
                  Max Results / Engine
                </label>
                <input
                  type="number"
                  value={maxResultsPerEngine}
                  onChange={(e) => setMaxResultsPerEngine(Number(e.target.value))}
                  min={1}
                  max={100}
                  className="ds-input text-sm w-full"
                />
              </div>
              <div>
                <label className="text-[0.65rem] text-gray-500 uppercase tracking-wider block mb-1">
                  Max Pages / Engine
                </label>
                <input
                  type="number"
                  value={maxPagesPerEngine}
                  onChange={(e) => setMaxPagesPerEngine(Number(e.target.value))}
                  min={1}
                  max={10}
                  className="ds-input text-sm w-full"
                />
              </div>
              <div>
                <label className="text-[0.65rem] text-gray-500 uppercase tracking-wider block mb-1">
                  Delay (ms)
                </label>
                <input
                  type="number"
                  value={delayBetweenRequests}
                  onChange={(e) => setDelayBetweenRequests(Number(e.target.value))}
                  min={0}
                  max={10000}
                  step={100}
                  className="ds-input text-sm w-full"
                />
              </div>
              <div>
                <label className="text-[0.65rem] text-gray-500 uppercase tracking-wider block mb-1">
                  Timeout (sec)
                </label>
                <input
                  type="number"
                  value={timeout}
                  onChange={(e) => setTimeoutVal(Number(e.target.value))}
                  min={5}
                  max={120}
                  className="ds-input text-sm w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Progress Bar ────────────────────────────────────────── */}
        {isSearching && (
          <div className="ds-card p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-gray-400">
                Searching {activeEngineCount} engine{activeEngineCount !== 1 ? "s" : ""}
                {doneEngineCount > 0 && ` · ${doneEngineCount} complete`}
                {errorEngineCount > 0 && ` · ${errorEngineCount} failed`}
              </span>
            </div>
            <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-gray-900">
              {Array.from(selectedEngines).map((engine) => {
                const status = engineStatuses[engine];
                const meta = ENGINE_META[engine];
                const pct = 100 / selectedEngines.size;
                return (
                  <div
                    key={engine}
                    className="h-full transition-all duration-500 rounded-full"
                    style={{
                      width: `${pct}%`,
                      background:
                        status.status === "done"
                          ? meta.color
                          : status.status === "searching"
                            ? `${meta.color}60`
                            : status.status === "error"
                              ? "#ef4444"
                              : "#1f2937",
                      opacity: status.status === "searching" ? 0.6 : 1,
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* ── Stats Summary ───────────────────────────────────────── */}
        {(totalResults > 0 || isSearching) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="ds-card p-3 text-center">
              <div className="text-[0.6rem] text-gray-600 uppercase tracking-wider">Total Results</div>
              <div className="text-xl font-bold text-emerald-400 mt-0.5">{totalResults}</div>
            </div>
            <div className="ds-card p-3 text-center">
              <div className="text-[0.6rem] text-gray-600 uppercase tracking-wider">Duplicates Removed</div>
              <div className="text-xl font-bold text-yellow-400 mt-0.5">{duplicateCount}</div>
            </div>
            <div className="ds-card p-3 text-center">
              <div className="text-[0.6rem] text-gray-600 uppercase tracking-wider">Engines Used</div>
              <div className="text-xl font-bold text-gray-300 mt-0.5">{selectedEngines.size}</div>
            </div>
            <div className="ds-card p-3 text-center">
              <div className="text-[0.6rem] text-gray-600 uppercase tracking-wider">Engines Done</div>
              <div className="text-xl font-bold text-gray-300 mt-0.5">
                {doneEngineCount}
                {errorEngineCount > 0 && (
                  <span className="text-red-400 text-sm ml-1">({errorEngineCount} err)</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Engine Summary Badges ───────────────────────────────── */}
        {totalResults > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterEngine("all")}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                filterEngine === "all"
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                  : "border-gray-800 text-gray-500 hover:border-gray-600"
              }`}
            >
              All ({totalResults})
            </button>
            {ALL_ENGINES.filter((e) => engineStatuses[e].status === "done" && engineStatuses[e].resultCount > 0).map(
              (engine) => {
                const meta = ENGINE_META[engine];
                const count = deduped.filter((r) => r.engine === engine).length;
                return (
                  <button
                    key={engine}
                    onClick={() => setFilterEngine(engine)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 ${
                      filterEngine === engine
                        ? "shadow-lg"
                        : "opacity-70 hover:opacity-100"
                    }`}
                    style={{
                      borderColor: filterEngine === engine ? meta.border : "rgba(55,65,81,0.5)",
                      background: filterEngine === engine ? meta.bg : "transparent",
                      color: filterEngine === engine ? meta.color : "#9ca3af",
                    }}
                  >
                    <span
                      className="w-4 h-4 rounded flex items-center justify-center text-[0.5rem] font-bold text-white"
                      style={{ background: meta.color }}
                    >
                      {meta.icon}
                    </span>
                    {meta.label} ({count})
                  </button>
                );
              }
            )}
          </div>
        )}

        {/* ── Results + Controls ───────────────────────────────────── */}
        {totalResults > 0 && (
          <div className="ds-card overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50">
              <div className="flex items-center gap-3">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Results
                </h3>
                <span className="text-[0.65rem] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  {sorted.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Sort */}
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="ds-input text-[0.65rem] py-1 px-2 w-auto"
                >
                  <option value="relevance">By Relevance</option>
                  <option value="engine">By Engine</option>
                </select>

                {/* Copy */}
                <button onClick={copyAllUrls} className="ds-btn-sm" title="Copy all URLs">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Copy
                </button>

                {/* Export dropdown */}
                <div className="relative group">
                  <button className="ds-btn-sm">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Export
                    <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="absolute right-0 top-full mt-1 bg-[#111118] border border-gray-800 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[120px]">
                    <button
                      onClick={() => exportResults("csv")}
                      className="block w-full text-left text-xs px-3 py-2 text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/5 transition-colors rounded-t-lg"
                    >
                      CSV
                    </button>
                    <button
                      onClick={() => exportResults("json")}
                      className="block w-full text-left text-xs px-3 py-2 text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/5 transition-colors"
                    >
                      JSON
                    </button>
                    <button
                      onClick={() => exportResults("txt")}
                      className="block w-full text-left text-xs px-3 py-2 text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/5 transition-colors rounded-b-lg"
                    >
                      TXT (URLs only)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Results List */}
            <div className="max-h-[600px] overflow-y-auto ds-scrollbar">
              {sorted.map((result, idx) => {
                const meta = ENGINE_META[result.engine];
                return (
                  <div
                    key={`${result.url}-${idx}`}
                    className="px-4 py-3 border-b border-gray-800/30 hover:bg-white/[0.015] transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      {/* Index */}
                      <span className="text-[0.65rem] text-gray-700 font-mono mt-0.5 shrink-0 w-6 text-right tabular-nums">
                        {idx + 1}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Title + Badge */}
                        <div className="flex items-center gap-2 mb-0.5">
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium truncate"
                          >
                            {result.title || result.url}
                          </a>
                          <span
                            className="shrink-0 text-[0.55rem] font-bold px-1.5 py-0.5 rounded text-white"
                            style={{ background: meta.color }}
                          >
                            {meta.label}
                          </span>
                        </div>

                        {/* URL */}
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[0.7rem] text-emerald-500/70 hover:text-emerald-400 transition-colors truncate block"
                        >
                          {result.url}
                        </a>

                        {/* Snippet */}
                        {result.snippet && (
                          <p className="text-[0.7rem] text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                            {result.snippet}
                          </p>
                        )}
                      </div>

                      {/* Copy button */}
                      <button
                        onClick={() => navigator.clipboard.writeText(result.url)}
                        className="shrink-0 text-gray-700 hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Copy URL"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Empty state ─────────────────────────────────────────── */}
        {!isSearching && totalResults === 0 && (
          <div className="ds-card p-12 text-center">
            <div className="text-4xl text-gray-800 mb-3">
              <svg className="w-12 h-12 mx-auto opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-600">
              Enter a dork query and select engines to start searching
            </p>
            <p className="text-[0.65rem] text-gray-700 mt-2">
              Example: <code className="text-emerald-500/70">site:github.com inurl:api</code>
            </p>
          </div>
        )}

        {/* ── Live Log ────────────────────────────────────────────── */}
        {logs.length > 0 && (
          <div className="ds-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800/50">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                {isSearching && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
                Activity Log
              </h3>
              <button
                onClick={() => setLogs([])}
                className="text-[0.6rem] text-gray-600 hover:text-gray-400 transition-colors"
              >
                Clear
              </button>
            </div>
            <div
              ref={logRef}
              className="max-h-48 overflow-y-auto p-3 font-mono text-[0.65rem] leading-relaxed ds-scrollbar bg-[#060709]"
            >
              {logs.map((log, i) => (
                <div key={i} className="flex gap-2 py-0.5">
                  <span className="text-gray-700 shrink-0">[{log.time}]</span>
                  <span
                    className={
                      log.type === "found"
                        ? "text-emerald-400"
                        : log.type === "error"
                          ? "text-red-400"
                          : log.type === "warn"
                            ? "text-yellow-400"
                            : log.type === "done" || log.type === "complete"
                              ? "text-blue-400"
                              : log.type === "start"
                                ? "text-gray-400"
                                : "text-gray-500"
                    }
                  >
                    {log.msg}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────── */}
        <footer className="text-center text-[0.6rem] text-gray-800 py-4">
          Dork Searcher v2.0 — Multi-Engine Search Tool
        </footer>
      </div>

      {/* ── Templates Drawer ─────────────────────────────────────── */}
      <TemplatesDrawer
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        onTemplateSelect={handleTemplateSelect}
      />
    </div>
  );
}
