import { NextResponse } from "next/server";
import type { PricePoint } from "@/lib/types";
import type { Range } from "@/lib/datasource";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RANGE_DAYS: Record<Range, number> = {
  "6mo": 180,
  "1y": 365,
  "2y": 730,
  "5y": 1825
};

const YAHOO_RANGE: Record<Range, { range: string; interval: string }> = {
  "6mo": { range: "6mo", interval: "1d" },
  "1y": { range: "1y", interval: "1d" },
  "2y": { range: "2y", interval: "1d" },
  "5y": { range: "5y", interval: "1d" }
};

const STOOQ_MAP: Record<string, string> = {
  "^VIX": "^vix",
  "^GSPC": "^spx",
  "^DJI": "^dji",
  "^IXIC": "^ndx",
  "BZ=F": "cb.f",
  "CL=F": "cl.f",
  "GC=F": "gc.f",
  "GLD": "gld.us",
  "SPY": "spy.us",
  "QQQ": "qqq.us"
};

const TWELVE_DATA_MAP: Record<string, string> = {
  "^VIX": "VIX",
  "^GSPC": "SPX",
  "^DJI": "DJI",
  "^IXIC": "IXIC",
  "BZ=F": "BRENT",
  "CL=F": "WTI",
  "GC=F": "XAU/USD"
};

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const BROWSER_HEADERS: Record<string, string> = {
  "user-agent": BROWSER_UA,
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
  "accept-language": "en-US,en;q=0.9",
  "accept-encoding": "gzip, deflate, br",
  "sec-ch-ua": '"Chromium";v="125", "Not.A/Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1"
};

const FETCH_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init?.signal ? FETCH_TIMEOUT_MS : FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/* =====================================================================
 *                       Yahoo Finance session
 * =====================================================================
 *
 * Yahoo no bloquea por IP: rechaza con 429 a clientes sin sesión válida.
 * Replicamos lo que hace `yfinance` (Python):
 *   1) GET fc.yahoo.com           → cookies anti-bot (A1, A3, B)
 *   2) GET finance.yahoo.com      → cookies del dominio finance
 *   3) GET query2/v1/test/getcrumb → token "crumb" criptográfico
 *   4) Usar cookies + crumb en todas las llamadas de datos.
 *
 * Cacheamos la sesión a nivel de módulo: cada instancia warm del lambda
 * la reutiliza durante 30 min y sólo gasta 3 requests extra en cold start.
 */

interface YahooSession {
  cookies: string;
  crumb: string;
  createdAt: number;
}

let cachedSession: YahooSession | null = null;
let inFlightSession: Promise<YahooSession> | null = null;
const SESSION_TTL_MS = 30 * 60 * 1000;

async function getYahooSession(force = false): Promise<YahooSession> {
  const now = Date.now();
  if (!force && cachedSession && now - cachedSession.createdAt < SESSION_TTL_MS) {
    return cachedSession;
  }
  if (inFlightSession) return inFlightSession;
  inFlightSession = createYahooSession()
    .then((s) => {
      cachedSession = s;
      return s;
    })
    .finally(() => {
      inFlightSession = null;
    });
  return inFlightSession;
}

function parseSetCookies(res: Response): string[] {
  // Node 20+ expone getSetCookie() para devolver cabeceras Set-Cookie sin perder
  // las comas internas. Fallback manual si no está disponible.
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const raw = res.headers.get("set-cookie");
  return raw ? raw.split(/,(?=\s*[A-Za-z0-9_!#$%&'*+\-.^`|~]+=)/) : [];
}

function mergeCookies(jar: Map<string, string>, res: Response) {
  for (const sc of parseSetCookies(res)) {
    const firstPart = sc.split(";")[0];
    const eq = firstPart.indexOf("=");
    if (eq > 0) {
      const name = firstPart.slice(0, eq).trim();
      const value = firstPart.slice(eq + 1).trim();
      if (name) jar.set(name, value);
    }
  }
}

function formatCookies(jar: Map<string, string>): string {
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function createYahooSession(): Promise<YahooSession> {
  const jar = new Map<string, string>();

  // Paso 1: fc.yahoo.com  →  cookies iniciales (A1/A3/B + GUC)
  try {
    const r1 = await fetchWithTimeout("https://fc.yahoo.com/", {
      headers: BROWSER_HEADERS,
      redirect: "manual",
      cache: "no-store"
    });
    mergeCookies(jar, r1);
    // Si redirige a consent.yahoo.com seguimos un nivel para coger más cookies.
    const location = r1.headers.get("location");
    if (location && /consent\.yahoo\.com/i.test(location)) {
      const r1b = await fetchWithTimeout(location, {
        headers: { ...BROWSER_HEADERS, cookie: formatCookies(jar) },
        redirect: "manual",
        cache: "no-store"
      });
      mergeCookies(jar, r1b);
    }
  } catch {
    /* seguir aunque falle, los próximos pasos pueden dar sesión igual */
  }

  // Paso 2: finance.yahoo.com  →  cookies del dominio finance
  try {
    const r2 = await fetchWithTimeout("https://finance.yahoo.com/", {
      headers: { ...BROWSER_HEADERS, cookie: formatCookies(jar) },
      redirect: "follow",
      cache: "no-store"
    });
    mergeCookies(jar, r2);
  } catch {
    /* seguir */
  }

  // Paso 3: crumb. Probamos query1 y query2 por si uno está saturado.
  const crumbHosts = [
    "https://query2.finance.yahoo.com/v1/test/getcrumb",
    "https://query1.finance.yahoo.com/v1/test/getcrumb"
  ];
  let crumb = "";
  let crumbErr = "sin respuesta";
  for (const u of crumbHosts) {
    try {
      const r3 = await fetchWithTimeout(u, {
        headers: {
          ...BROWSER_HEADERS,
          accept: "text/plain, */*",
          cookie: formatCookies(jar),
          referer: "https://finance.yahoo.com/"
        },
        cache: "no-store"
      });
      mergeCookies(jar, r3);
      if (!r3.ok) {
        crumbErr = `HTTP ${r3.status}`;
        continue;
      }
      const text = (await r3.text()).trim();
      if (!text || text.length > 64 || text.includes("<") || text.includes(" ")) {
        crumbErr = "crumb inválido";
        continue;
      }
      crumb = text;
      break;
    } catch (e) {
      crumbErr = e instanceof Error ? e.message : "fetch error";
    }
  }
  if (!crumb) {
    throw new Error(`Yahoo session: ${crumbErr}`);
  }

  return {
    cookies: formatCookies(jar),
    crumb,
    createdAt: Date.now()
  };
}

/* ======================================================================== */

function toStooqSymbol(ticker: string): string {
  if (STOOQ_MAP[ticker]) return STOOQ_MAP[ticker];
  if (ticker.startsWith("^")) return ticker.toLowerCase();
  return `${ticker.toLowerCase()}.us`;
}

function toTwelveDataSymbol(ticker: string): string {
  if (TWELVE_DATA_MAP[ticker]) return TWELVE_DATA_MAP[ticker];
  return ticker;
}

interface Attempt {
  name: string;
  fn: () => Promise<PricePoint[]>;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = (url.searchParams.get("ticker") || "").trim().toUpperCase();
  const range = (url.searchParams.get("range") || "2y") as Range;

  if (!ticker) {
    return NextResponse.json({ error: "Falta el parámetro 'ticker'." }, { status: 400 });
  }
  if (!YAHOO_RANGE[range]) {
    return NextResponse.json({ error: `Rango no soportado: ${range}` }, { status: 400 });
  }

  const forced = (process.env.DATA_PROVIDER || "").toLowerCase();
  const attempts = buildAttempts(ticker, range, forced);

  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      const history = await attempt.fn();
      if (history.length >= 5) {
        return NextResponse.json({
          ticker,
          range,
          provider: attempt.name,
          count: history.length,
          history
        });
      }
      errors.push(`${attempt.name}: sin datos suficientes (${history.length})`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error";
      errors.push(`${attempt.name}: ${msg}`);
    }
  }

  const hasPaidKey = Boolean(process.env.TWELVE_DATA_API_KEY || process.env.EODHD_API_KEY);
  return NextResponse.json(
    {
      error: `No se pudo obtener "${ticker}".`,
      attempts: errors,
      hint: hasPaidKey
        ? "Revisa que las API keys configuradas sean válidas."
        : "Yahoo intentó autenticarse con cookies + crumb pero su servidor sigue rechazando. Como respaldo añade TWELVE_DATA_API_KEY (gratis en https://twelvedata.com) en Vercel."
    },
    { status: 502 }
  );
}

function buildAttempts(ticker: string, range: Range, forced: string): Attempt[] {
  if (forced === "twelvedata" || forced === "twelve_data") {
    return [{ name: "twelvedata", fn: () => fetchFromTwelveData(ticker, range) }];
  }
  if (forced === "eodhd") {
    return [{ name: "eodhd", fn: () => fetchFromEODHD(ticker, range) }];
  }
  if (forced === "stooq") {
    return [{ name: "stooq", fn: () => fetchFromStooq(ticker, range) }];
  }
  if (forced === "yahoo" || forced === "yfinance") {
    return [{ name: "yahoo", fn: () => fetchFromYahoo(ticker, range) }];
  }

  // Cascada por defecto: Yahoo (yfinance auténtico con session) primero,
  // luego Stooq, luego claves premium si las hay.
  const attempts: Attempt[] = [
    { name: "yahoo", fn: () => fetchFromYahoo(ticker, range) },
    { name: "stooq", fn: () => fetchFromStooq(ticker, range) }
  ];
  if (process.env.TWELVE_DATA_API_KEY) {
    attempts.push({ name: "twelvedata", fn: () => fetchFromTwelveData(ticker, range) });
  }
  if (process.env.EODHD_API_KEY) {
    attempts.push({ name: "eodhd", fn: () => fetchFromEODHD(ticker, range) });
  }
  return attempts;
}

/* ------------------------------ Yahoo ------------------------------ */

async function fetchFromYahoo(ticker: string, range: Range): Promise<PricePoint[]> {
  const { range: r, interval } = YAHOO_RANGE[range];
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];

  // Hasta 2 vueltas: si la primera devuelve 401/429 forzamos sesión nueva.
  let lastErr = "sin respuesta";
  for (let pass = 0; pass < 2; pass++) {
    let session: YahooSession;
    try {
      session = await getYahooSession(pass > 0);
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "session error";
      continue;
    }

    let needRefresh = false;
    for (const host of hosts) {
      const u =
        `https://${host}/v8/finance/chart/${encodeURIComponent(ticker)}` +
        `?range=${r}&interval=${interval}` +
        `&includePrePost=false&events=div%7Csplit` +
        `&crumb=${encodeURIComponent(session.crumb)}`;
      try {
        const res = await fetchWithTimeout(u, {
          headers: {
            "user-agent": BROWSER_UA,
            accept: "application/json, text/plain, */*",
            "accept-language": "en-US,en;q=0.9",
            cookie: session.cookies,
            referer: "https://finance.yahoo.com/",
            origin: "https://finance.yahoo.com"
          },
          cache: "no-store"
        });
        if (res.status === 401 || res.status === 429) {
          lastErr = `HTTP ${res.status}`;
          needRefresh = true;
          break;
        }
        if (!res.ok) {
          lastErr = `HTTP ${res.status}`;
          continue;
        }
        const json = await res.json();
        const result = json?.chart?.result?.[0];
        if (!result) {
          lastErr = json?.chart?.error?.description || "sin datos";
          continue;
        }
        const timestamps: number[] = result.timestamp || [];
        const closes: Array<number | null> = result.indicators?.quote?.[0]?.close || [];
        const out: PricePoint[] = [];
        for (let i = 0; i < timestamps.length; i++) {
          const ts = timestamps[i];
          const close = closes[i];
          if (typeof ts !== "number" || typeof close !== "number" || !Number.isFinite(close)) {
            continue;
          }
          out.push({
            date: new Date(ts * 1000).toISOString().slice(0, 10),
            close
          });
        }
        if (out.length > 0) return out;
        lastErr = "respuesta vacía";
      } catch (e) {
        lastErr = e instanceof Error ? e.message : "fetch error";
      }
    }

    if (!needRefresh) break;
    // Invalida sesión y vuelve a intentar
    cachedSession = null;
  }
  throw new Error(lastErr);
}

/* ------------------------------ Stooq ------------------------------ */

async function fetchFromStooq(ticker: string, range: Range): Promise<PricePoint[]> {
  const symbol = toStooqSymbol(ticker);
  const days = RANGE_DAYS[range];
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

  const urls = [
    `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&d1=${fmt(from)}&d2=${fmt(to)}&i=d`,
    `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`,
    `https://stooq.pl/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`
  ];

  let lastErr = "sin respuesta";
  for (const u of urls) {
    try {
      const res = await fetchWithTimeout(u, {
        headers: {
          "user-agent": BROWSER_UA,
          accept: "text/csv, text/plain, */*",
          "accept-language": "en-US,en;q=0.9",
          referer: "https://stooq.com/"
        },
        cache: "no-store",
        redirect: "follow"
      });
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
        continue;
      }
      const text = (await res.text()).trim();
      if (!text) {
        lastErr = "respuesta vacía";
        continue;
      }
      const head = text.slice(0, 200).toLowerCase();
      if (
        head.startsWith("<") ||
        head.includes("no data") ||
        head.includes("brak danych") ||
        head.includes("exceeded")
      ) {
        lastErr = head.startsWith("<") ? "respuesta HTML (rate-limit)" : "sin datos";
        continue;
      }
      const lines = text.split(/\r?\n/);
      if (lines.length < 2) {
        lastErr = "CSV vacío";
        continue;
      }
      const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const dateIdx = header.indexOf("date");
      const closeIdx = header.indexOf("close");
      if (dateIdx < 0 || closeIdx < 0) {
        lastErr = "CSV con cabecera inesperada";
        continue;
      }
      const out: PricePoint[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",");
        const date = cols[dateIdx];
        const close = Number(cols[closeIdx]);
        if (!date || !Number.isFinite(close) || close <= 0) continue;
        out.push({ date, close });
      }
      if (out.length > 0) return out;
      lastErr = "CSV sin filas válidas";
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "fetch error";
    }
  }
  throw new Error(lastErr);
}

/* ---------------------------- Twelve Data ---------------------------- */

async function fetchFromTwelveData(ticker: string, range: Range): Promise<PricePoint[]> {
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) throw new Error("TWELVE_DATA_API_KEY no configurada");
  const symbol = toTwelveDataSymbol(ticker);
  const outputsize = Math.min(5000, RANGE_DAYS[range]);
  const u =
    `https://api.twelvedata.com/time_series` +
    `?symbol=${encodeURIComponent(symbol)}` +
    `&interval=1day&outputsize=${outputsize}` +
    `&apikey=${encodeURIComponent(key)}`;
  const res = await fetchWithTimeout(u, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    status?: string;
    message?: string;
    values?: Array<{ datetime: string; close: string }>;
  };
  if (json.status === "error" || !Array.isArray(json.values)) {
    throw new Error(json.message || "sin datos");
  }
  const out = json.values
    .map((row) => ({ date: row.datetime, close: Number(row.close) }))
    .filter((p) => Number.isFinite(p.close) && p.close > 0);
  out.reverse();
  return out;
}

/* ------------------------------ EODHD ------------------------------ */

async function fetchFromEODHD(ticker: string, range: Range): Promise<PricePoint[]> {
  const key = process.env.EODHD_API_KEY;
  if (!key) throw new Error("EODHD_API_KEY no configurada");
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - RANGE_DAYS[range]);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const symbol = ticker.includes(".") || ticker.startsWith("^") ? ticker : `${ticker}.US`;
  const u = `https://eodhd.com/api/eod/${encodeURIComponent(
    symbol
  )}?from=${fmt(from)}&to=${fmt(to)}&period=d&fmt=json&api_token=${encodeURIComponent(key)}`;
  const res = await fetchWithTimeout(u, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const arr = (await res.json()) as Array<{
    date: string;
    adjusted_close?: number;
    close?: number;
  }>;
  return arr
    .map((row) => ({ date: row.date, close: Number(row.adjusted_close ?? row.close ?? NaN) }))
    .filter((p) => Number.isFinite(p.close) && p.close > 0);
}
