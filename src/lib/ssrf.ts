// LeadPulse — SSRF protection for outbound website fetches
// Blocks localhost, private IP ranges, cloud metadata endpoints, link-local, etc.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface ParsedUrl {
  protocol: string;
  hostname: string;
  port: number | null;
  pathname: string;
  search: string;
  href: string;
  origin: string;
}

export function parseUrl(raw: string): ParsedUrl | null {
  try {
    let urlStr = raw.trim();
    if (!/^https?:\/\//i.test(urlStr)) {
      urlStr = "https://" + urlStr;
    }
    const u = new URL(urlStr);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return {
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port ? Number(u.port) : u.protocol === "https:" ? 443 : 80,
      pathname: u.pathname,
      search: u.search,
      href: u.href,
      origin: u.origin,
    };
  } catch {
    return null;
  }
}

export function parseDomain(raw: string): string | null {
  const u = parseUrl(raw);
  if (!u) {
    // maybe it's already a bare domain
    const cleaned = raw.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(cleaned)) return cleaned;
    return null;
  }
  return u.hostname.replace(/^www\./, "").toLowerCase();
}

// Check a hostname literal against SSRF blocklist rules (without DNS resolution).
function isBlockedLiteral(hostname: string): boolean {
  const h = hostname.toLowerCase();
  // localhost variants
  if (h === "localhost" || h === "localhost." || h.endsWith(".localhost")) return true;
  // metadata endpoints
  if (h === "169.254.169.254" || h === "metadata.google.internal") return true;
  if (h === "metadata.azure.com" || h === "169.254.169.253") return true;
  if (h === "fd00:ec2::254" || h === "instance-data") return true;

  // IPv4
  const ip = isIP(hostname);
  if (ip === 4) {
    const parts = hostname.split(".").map(Number);
    if (parts.length !== 4) return true;
    const [a, b] = parts;
    if (a === 10) return true;                       // 10.0.0.0/8
    if (a === 127) return true;                      // 127.0.0.0/8 loopback
    if (a === 0) return true;                        // 0.0.0.0/8
    if (a === 169 && b === 254) return true;         // 169.254.0.0/16 link-local + metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true;         // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a >= 224) return true;                       // multicast / reserved
    if (a === 255) return true;                      // broadcast
  }
  if (ip === 6) {
    const hl = h.replace(/\[|\]/g, "");
    if (hl === "::1" || hl === "::") return true;     // loopback / unspecified
    if (hl.startsWith("fe80")) return true;            // link-local
    if (hl.startsWith("fc") || hl.startsWith("fd")) return true; // ULA
    if (hl.startsWith("ff")) return true;              // multicast
  }
  return false;
}

export class SsrfBlockedError extends Error {
  constructor(hostname: string) {
    super(`SSRF protection: blocked hostname ${hostname}`);
    this.name = "SsrfBlockedError";
  }
}

// Resolve hostname and verify NO resolved address is private/internal.
// Returns the list of resolved IPv4 addresses (so the fetcher can pin them).
export async function assertSafeTarget(hostname: string): Promise<string[]> {
  // First check the literal hostname (covers IP literals & localhost).
  if (isBlockedLiteral(hostname)) {
    throw new SsrfBlockedError(hostname);
  }
  // DNS resolution: reject if any A record resolves to a private/blocked range.
  let addrs: string[];
  try {
    const result = await lookup(hostname, { all: true, family: 4 });
    addrs = result.map((r) => r.address);
  } catch {
    // If DNS fails we cannot proceed safely.
    throw new SsrfBlockedError(`${hostname} (dns-resolution-failed)`);
  }
  if (addrs.length === 0) {
    throw new SsrfBlockedError(`${hostname} (no-ipv4)`);
  }
  for (const a of addrs) {
    if (isBlockedLiteral(a)) {
      throw new SsrfBlockedError(`${hostname} -> ${a}`);
    }
  }
  return addrs;
}

// Build safe fetch options that pin the resolved IP and set the Host header,
// preventing DNS rebinding between resolution and connection.
export async function safeFetch(
  rawUrl: string,
  opts: { method?: string; headers?: Record<string, string>; timeoutMs?: number; maxBytes?: number } = {}
): Promise<{ url: string; status: number; html: string; contentType: string; finalUrl: string }> {
  const parsed = parseUrl(rawUrl);
  if (!parsed) throw new Error("INVALID_URL");

  const addrs = await assertSafeTarget(parsed.hostname);

  // Pin to first resolved IP, set Host header to original hostname.
  const portPart = parsed.port ? `:${parsed.port}` : "";
  const pinnedUrl = `${parsed.protocol}//${addrs[0]}${portPart}${parsed.pathname}${parsed.search}`;
  const headers: Record<string, string> = {
    Host: parsed.hostname,
    "User-Agent": "LeadPulseBot/1.0 (+https://leadpulse.app/bot)",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en;q=0.9",
    ...(opts.headers || {}),
  };

  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 15000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(pinnedUrl, {
      method: opts.method ?? "GET",
      headers,
      signal: controller.signal,
      redirect: "follow",
      // @ts-ignore - Node fetch supports this for DNS pinning via custom lookup
    });

    const contentType = res.headers.get("content-type") || "text/html";
    if (!contentType.includes("text/html") && !contentType.includes("xml") && !contentType.includes("text/plain")) {
      return { url: rawUrl, status: res.status, html: "", contentType, finalUrl: rawUrl };
    }

    // Limit response size to prevent memory exhaustion
    const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024; // 2 MB
    const reader = res.body?.getReader();
    if (!reader) {
      const text = await res.text();
      return { url: rawUrl, status: res.status, html: text.slice(0, maxBytes), contentType, finalUrl: rawUrl };
    }
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        chunks.push(value.subarray(0, maxBytes - (received - value.byteLength)));
        break;
      }
      chunks.push(value);
    }
    const buf = Buffer.concat(chunks);
    const html = buf.toString("utf8");
    return { url: rawUrl, status: res.status, html, contentType, finalUrl: rawUrl };
  } finally {
    clearTimeout(timer);
  }
}
