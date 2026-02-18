import * as cheerio from "cheerio";
import axios from "axios";
import type { EngineName, SearchResultItem } from "./types";

// ─── User-Agent Rotation Pool ──────────────────────────────────────────────

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0",
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function browserHeaders(referer?: string): Record<string, string> {
  const ua = randomUA();
  const h: Record<string, string> = {
    "User-Agent": ua,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": referer ? "same_origin" : "none",
    "Sec-Fetch-User": "?1",
    DNT: "1",
  };
  if (referer) h["Referer"] = referer;
  return h;
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// ─── DuckDuckGo ────────────────────────────────────────────────────────────

export async function searchDuckDuckGo(
  query: string,
  maxResults: number,
  maxPages: number,
  timeout: number,
  delay: number
): Promise<SearchResultItem[]> {
  const results: SearchResultItem[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < maxPages && results.length < maxResults; page++) {
    const params: Record<string, string> = { q: query };
    // DDG uses form-based pagination with "s" offset and "dc" parameters
    if (page > 0) {
      params.s = String(page * 30);
      params.dc = String(page * 30 + 1);
    }

    const url = `https://html.duckduckgo.com/html/`;
    try {
      const res = await axios.post(url, new URLSearchParams(params).toString(), {
        headers: {
          ...browserHeaders("https://html.duckduckgo.com/"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: timeout * 1000,
        maxRedirects: 5,
      });

      const $ = cheerio.load(res.data);

      $(".result").each((_, el) => {
        if (results.length >= maxResults) return false;

        const titleEl = $(el).find(".result__a");
        const snippetEl = $(el).find(".result__snippet");
        const href = titleEl.attr("href") || "";

        let finalUrl = "";
        try {
          const parsed = new URL(href, "https://duckduckgo.com");
          const uddg = parsed.searchParams.get("uddg");
          finalUrl = uddg ? decodeURIComponent(uddg) : href;
        } catch {
          if (href.startsWith("http")) finalUrl = href;
        }

        if (!finalUrl || !finalUrl.startsWith("http")) return;
        if (seen.has(finalUrl)) return;
        seen.add(finalUrl);

        results.push({
          title: clean(titleEl.text()) || finalUrl,
          url: finalUrl,
          snippet: clean(snippetEl.text()),
          engine: "duckduckgo",
        });
      });

      // Also try fallback selectors
      if (results.length === 0 && page === 0) {
        $("a.result__a").each((_, el) => {
          if (results.length >= maxResults) return false;
          const href = $(el).attr("href") || "";
          let finalUrl = "";
          try {
            const parsed = new URL(href, "https://duckduckgo.com");
            const uddg = parsed.searchParams.get("uddg");
            finalUrl = uddg ? decodeURIComponent(uddg) : href;
          } catch {
            if (href.startsWith("http")) finalUrl = href;
          }
          if (!finalUrl || !finalUrl.startsWith("http") || seen.has(finalUrl)) return;
          seen.add(finalUrl);
          results.push({
            title: clean($(el).text()) || finalUrl,
            url: finalUrl,
            snippet: "",
            engine: "duckduckgo",
          });
        });
      }
    } catch {
      break;
    }

    if (page < maxPages - 1 && results.length < maxResults) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return results;
}

// ─── Bing ──────────────────────────────────────────────────────────────────

export async function searchBing(
  query: string,
  maxResults: number,
  maxPages: number,
  timeout: number,
  delay: number
): Promise<SearchResultItem[]> {
  const results: SearchResultItem[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < maxPages && results.length < maxResults; page++) {
    const first = page * 10 + 1;
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${first}`;

    try {
      const res = await axios.get(url, {
        headers: browserHeaders("https://www.bing.com/"),
        timeout: timeout * 1000,
        maxRedirects: 5,
      });

      const $ = cheerio.load(res.data);

      $("li.b_algo").each((_, el) => {
        if (results.length >= maxResults) return false;

        const titleEl = $(el).find("h2 a");
        const snippetEl = $(el).find(".b_caption p, .b_lineclamp2");
        const href = titleEl.attr("href") || "";

        if (!href.startsWith("http") || href.includes("bing.com")) return;
        if (seen.has(href)) return;
        seen.add(href);

        results.push({
          title: clean(titleEl.text()) || href,
          url: href,
          snippet: clean(snippetEl.text()),
          engine: "bing",
        });
      });

      // Fallback: .b_algo h2 a
      if (results.length === 0 && page === 0) {
        $(".b_algo h2 a, .b_title a").each((_, el) => {
          if (results.length >= maxResults) return false;
          const href = $(el).attr("href") || "";
          if (!href.startsWith("http") || href.includes("bing.com") || seen.has(href)) return;
          seen.add(href);
          results.push({
            title: clean($(el).text()) || href,
            url: href,
            snippet: "",
            engine: "bing",
          });
        });
      }
    } catch {
      break;
    }

    if (page < maxPages - 1 && results.length < maxResults) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return results;
}

// ─── Yahoo ─────────────────────────────────────────────────────────────────

export async function searchYahoo(
  query: string,
  maxResults: number,
  maxPages: number,
  timeout: number,
  delay: number
): Promise<SearchResultItem[]> {
  const results: SearchResultItem[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < maxPages && results.length < maxResults; page++) {
    const b = page * 10 + 1;
    const url = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}&b=${b}`;

    try {
      const res = await axios.get(url, {
        headers: browserHeaders("https://search.yahoo.com/"),
        timeout: timeout * 1000,
        maxRedirects: 5,
      });

      const $ = cheerio.load(res.data);

      // Yahoo result items
      $(".algo, .dd.algo").each((_, el) => {
        if (results.length >= maxResults) return false;

        const titleEl = $(el).find("h3 a, .compTitle a");
        const snippetEl = $(el).find(".compText p, .compText");
        const href = titleEl.attr("href") || "";

        let finalUrl = href;
        // Yahoo wraps URLs through r.search.yahoo.com
        const ruMatch = href.match(/\/RU=([^/]+)\//);
        if (ruMatch) {
          try {
            finalUrl = decodeURIComponent(ruMatch[1]);
          } catch {
            finalUrl = href;
          }
        }

        if (!finalUrl.startsWith("http") || finalUrl.includes("yahoo.com") || finalUrl.includes("search.yahoo")) return;
        if (seen.has(finalUrl)) return;
        seen.add(finalUrl);

        results.push({
          title: clean(titleEl.text()) || finalUrl,
          url: finalUrl,
          snippet: clean(snippetEl.text()),
          engine: "yahoo",
        });
      });

      // Fallback: regex for /RU= patterns
      if (results.length === 0 && page === 0) {
        const ruRegex = /\/RU=([^/]+)\//g;
        let match;
        while ((match = ruRegex.exec(res.data)) !== null && results.length < maxResults) {
          try {
            const decoded = decodeURIComponent(match[1]);
            if (decoded.startsWith("http") && !decoded.includes("yahoo.com") && !seen.has(decoded)) {
              seen.add(decoded);
              results.push({
                title: decoded,
                url: decoded,
                snippet: "",
                engine: "yahoo",
              });
            }
          } catch {
            // skip
          }
        }
      }
    } catch {
      break;
    }

    if (page < maxPages - 1 && results.length < maxResults) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return results;
}

// ─── Ask.com ───────────────────────────────────────────────────────────────

export async function searchAsk(
  query: string,
  maxResults: number,
  maxPages: number,
  timeout: number,
  delay: number
): Promise<SearchResultItem[]> {
  const results: SearchResultItem[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < maxPages && results.length < maxResults; page++) {
    const pageNum = page + 1;
    const url = `https://www.ask.com/web?q=${encodeURIComponent(query)}&page=${pageNum}`;

    try {
      const res = await axios.get(url, {
        headers: browserHeaders("https://www.ask.com/"),
        timeout: timeout * 1000,
        maxRedirects: 5,
      });

      const $ = cheerio.load(res.data);

      // Ask.com result selectors
      $(".PartialSearchResults-item, .result, [data-testid='result-title-a']").each((_, el) => {
        if (results.length >= maxResults) return false;

        const titleEl = $(el).find("a[data-testid='result-title-a'], .result-title a, .PartialSearchResults-item-title a");
        const snippetEl = $(el).find("p[data-testid='result-abstract'], .PartialSearchResults-item-abstract, .result-abstract");

        let href = titleEl.attr("href") || "";

        // If no titleEl found, try the element itself as the anchor
        if (!href) {
          const directA = $(el).is("a") ? $(el) : $(el).find("a").first();
          href = directA.attr("href") || "";
        }

        if (!href.startsWith("http") || href.includes("ask.com")) return;
        if (seen.has(href)) return;
        seen.add(href);

        results.push({
          title: clean(titleEl.text() || $(el).find("a").first().text()) || href,
          url: href,
          snippet: clean(snippetEl.text()),
          engine: "ask",
        });
      });

      // Broader fallback
      if (results.length === 0 && page === 0) {
        $("a[href]").each((_, el) => {
          if (results.length >= maxResults) return false;
          const href = $(el).attr("href") || "";
          if (
            href.startsWith("http") &&
            !href.includes("ask.com") &&
            !href.includes("google.com") &&
            !href.includes("facebook.com") &&
            !href.includes("twitter.com") &&
            !seen.has(href)
          ) {
            const parent = $(el).closest("[class*='result'], [class*='Result'], [class*='search']");
            if (parent.length > 0 || $(el).find("h3, h2, span").length > 0) {
              seen.add(href);
              results.push({
                title: clean($(el).text()) || href,
                url: href,
                snippet: "",
                engine: "ask",
              });
            }
          }
        });
      }
    } catch {
      break;
    }

    if (page < maxPages - 1 && results.length < maxResults) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return results;
}

// ─── Yandex ────────────────────────────────────────────────────────────────

export async function searchYandex(
  query: string,
  maxResults: number,
  maxPages: number,
  timeout: number,
  delay: number
): Promise<SearchResultItem[]> {
  const results: SearchResultItem[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < maxPages && results.length < maxResults; page++) {
    const p = page;
    const url = `https://yandex.com/search/?text=${encodeURIComponent(query)}&p=${p}&lang=en`;

    try {
      const res = await axios.get(url, {
        headers: browserHeaders("https://yandex.com/"),
        timeout: timeout * 1000,
        maxRedirects: 5,
      });

      const $ = cheerio.load(res.data);

      // Yandex organic results
      $(".serp-item, .Organic").each((_, el) => {
        if (results.length >= maxResults) return false;

        const titleEl = $(el).find("h2 a, .OrganicTitle-LinkText, .organic__url-text");
        const snippetEl = $(el).find(".OrganicTextContentSpan, .organic__content-wrapper, .text-container");
        let href = titleEl.attr("href") || "";

        // Yandex sometimes uses tracking redirects
        if (href.includes("yandex.com/clck")) {
          // Try to find the actual URL in a data attribute or cite
          const cite = $(el).find(".Path-Item, .organic__path .link, cite, .Organic-Url, b[role='link']");
          const citeText = cite.text().trim();
          if (citeText && !citeText.includes(" ")) {
            href = citeText.startsWith("http") ? citeText : `https://${citeText}`;
          }
        }

        if (!href.startsWith("http") || href.includes("yandex.com") || href.includes("yandex.ru")) return;
        if (seen.has(href)) return;
        seen.add(href);

        results.push({
          title: clean(titleEl.text()) || href,
          url: href,
          snippet: clean(snippetEl.text()),
          engine: "yandex",
        });
      });

      // Fallback: look for links in li.serp-item
      if (results.length === 0 && page === 0) {
        $("li.serp-item a[href^='http'], .serp-item a[href^='http']").each((_, el) => {
          if (results.length >= maxResults) return false;
          const href = $(el).attr("href") || "";
          if (href.includes("yandex.com") || href.includes("yandex.ru") || seen.has(href)) return;
          if (!href.startsWith("http")) return;
          seen.add(href);
          results.push({
            title: clean($(el).text()) || href,
            url: href,
            snippet: "",
            engine: "yandex",
          });
        });
      }
    } catch {
      break;
    }

    if (page < maxPages - 1 && results.length < maxResults) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return results;
}

// ─── Engine Dispatcher ─────────────────────────────────────────────────────

export async function searchEngine(
  engine: EngineName,
  query: string,
  maxResults: number,
  maxPages: number,
  timeout: number,
  delay: number
): Promise<SearchResultItem[]> {
  switch (engine) {
    case "duckduckgo":
      return searchDuckDuckGo(query, maxResults, maxPages, timeout, delay);
    case "bing":
      return searchBing(query, maxResults, maxPages, timeout, delay);
    case "yahoo":
      return searchYahoo(query, maxResults, maxPages, timeout, delay);
    case "ask":
      return searchAsk(query, maxResults, maxPages, timeout, delay);
    case "yandex":
      return searchYandex(query, maxResults, maxPages, timeout, delay);
    default:
      throw new Error(`Unknown engine: ${engine}`);
  }
}
