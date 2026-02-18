/**
 * Stealth Headers Generator
 * Generates realistic browser headers including Sec-Ch-* headers to bypass bot detection
 */

type StealthHeaders = Record<string, string> & {
  "User-Agent": string;
  Accept: string;
  "Accept-Language": string;
  "Accept-Encoding": string;
  Connection: string;
  "Cache-Control": string;
  Pragma: string;
  "Sec-Fetch-Dest": string;
  "Sec-Fetch-Mode": string;
  "Sec-Fetch-Site": string;
  "Sec-Fetch-User": string;
  "Upgrade-Insecure-Requests": string;
  DNT: string;
  "Sec-Ch-Ua": string;
  "Sec-Ch-Ua-Mobile": string;
  "Sec-Ch-Ua-Platform": string;
}

interface BrowserProfile {
  brand: string;
  version: string;
  platform: string;
  platformVersion: string;
  arch: string;
  bitness: string;
  mobile: boolean;
}

// Chrome versions pool
const CHROME_VERSIONS = [
  "120.0.6099.109",
  "120.0.6099.130",
  "121.0.6167.85",
  "121.0.6167.160",
  "122.0.6261.94",
  "122.0.6261.112",
];

// Edge versions pool
const EDGE_VERSIONS = [
  "120.0.2210.91",
  "120.0.2210.121",
  "121.0.2277.83",
  "121.0.2277.112",
];

// Platform profiles
const WINDOWS_PROFILES: BrowserProfile[] = [
  {
    brand: "Chromium",
    version: "120",
    platform: "Windows",
    platformVersion: "15.0.0",
    arch: "x86",
    bitness: "64",
    mobile: false,
  },
  {
    brand: "Google Chrome",
    version: "120",
    platform: "Windows",
    platformVersion: "10.0.0",
    arch: "x86",
    bitness: "64",
    mobile: false,
  },
];

const MAC_PROFILES: BrowserProfile[] = [
  {
    brand: "Chromium",
    version: "120",
    platform: "macOS",
    platformVersion: "14.1.0",
    arch: "arm",
    bitness: "64",
    mobile: false,
  },
  {
    brand: "Google Chrome",
    version: "120",
    platform: "macOS",
    platformVersion: "13.5.0",
    arch: "x86",
    bitness: "64",
    mobile: false,
  },
];

const LINUX_PROFILES: BrowserProfile[] = [
  {
    brand: "Chromium",
    version: "120",
    platform: "Linux",
    platformVersion: "",
    arch: "x86",
    bitness: "64",
    mobile: false,
  },
];

/**
 * Generate Sec-Ch-Ua header based on browser profile
 */
function generateSecChUa(profile: BrowserProfile): string {
  const chromeVersion = CHROME_VERSIONS[Math.floor(Math.random() * CHROME_VERSIONS.length)];
  const majorVersion = chromeVersion.split(".")[0];

  return `"Not_A Brand";v="8", "${profile.brand}";v="${majorVersion}", "Google Chrome";v="${majorVersion}"`;
}

/**
 * Generate Sec-Ch-Ua-Full-Version-List header
 */
function generateSecChUaFullVersionList(profile: BrowserProfile): string {
  const chromeVersion = CHROME_VERSIONS[Math.floor(Math.random() * CHROME_VERSIONS.length)];

  return `"Not_A Brand";v="8.0.0.0", "${profile.brand}";v="${chromeVersion}", "Google Chrome";v="${chromeVersion}"`;
}

/**
 * Pick a random browser profile based on user agent
 */
function selectProfile(userAgent: string): BrowserProfile {
  if (userAgent.includes("Windows")) {
    return WINDOWS_PROFILES[Math.floor(Math.random() * WINDOWS_PROFILES.length)];
  } else if (userAgent.includes("Mac OS X") || userAgent.includes("Macintosh")) {
    return MAC_PROFILES[Math.floor(Math.random() * MAC_PROFILES.length)];
  } else if (userAgent.includes("Linux")) {
    return LINUX_PROFILES[Math.floor(Math.random() * LINUX_PROFILES.length)];
  }

  // Default to Windows
  return WINDOWS_PROFILES[0];
}

/**
 * Generate stealth headers with realistic Sec-Ch-* headers
 */
export function generateStealthHeaders(userAgent: string): StealthHeaders {
  const profile = selectProfile(userAgent);

  const headers: StealthHeaders = {
    "User-Agent": userAgent,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    "Cache-Control": "max-age=0",
    Pragma: "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    DNT: "1",
    "Sec-Ch-Ua": generateSecChUa(profile),
    "Sec-Ch-Ua-Mobile": profile.mobile ? "?1" : "?0",
    "Sec-Ch-Ua-Platform": `"${profile.platform}"`,
  };

  // Add optional headers based on platform
  if (profile.platformVersion) {
    headers["Sec-Ch-Ua-Platform-Version"] = `"${profile.platformVersion}"`;
  }

  headers["Sec-Ch-Ua-Arch"] = `"${profile.arch}"`;
  headers["Sec-Ch-Ua-Bitness"] = `"${profile.bitness}"`;
  headers["Sec-Ch-Ua-Full-Version-List"] = generateSecChUaFullVersionList(profile);

  return headers as StealthHeaders;
}

/**
 * Generate a second set of stealth headers (for retry with different fingerprint)
 */
export function generateAlternativeStealthHeaders(userAgent: string): StealthHeaders {
  // For the alternative, we pick a different profile or modify some details
  const headers = generateStealthHeaders(userAgent);

  // Slightly modify some headers to appear as a different browser instance
  headers["Accept-Language"] = Math.random() > 0.5 ? "en-US,en;q=0.9" : "en-GB,en-US;q=0.9,en;q=0.8";
  headers["Cache-Control"] = Math.random() > 0.5 ? "max-age=0" : "no-cache";

  return headers;
}

/**
 * Random delay helper for stealth operations
 */
export function randomDelay(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
