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

const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
  accept: "application/json, text/csv, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "accept-encoding": "gzip, deflate, br"
};

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
        : "Yahoo bloquea IPs de Vercel y los proveedores públicos pueden fallar. Soluciónalo añadiendo TWELVE_DATA_API_KEY (gratis, 1 min en https://twelvedata.com) como variable de entorno en Vercel."
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

  // Cascada por defecto: APIs con key primero (cloud-friendly de verdad),
  // luego públicas como fallback.
  const attempts: Attempt[] = [];
  if (process.env.TWELVE_DATA_API_KEY) {
    attempts.push({ name: "twelvedata", fn: () => fetchFromTwelveData(ticker, range) });
  }
  if (process.env.EODHD_API_KEY) {
    attempts.push({ name: "eodhd", fn: () => fetchFromEODHD(ticker, range) });
  }
  attempts.push({ name: "yahoo", fn: () => fetchFromYahoo(ticker, range) });
  attempts.push({ name: "stooq", fn: () => fetchFromStooq(ticker, range) });
  return attempts;
}

/* ------------------------------ Yahoo ------------------------------ */

async function fetchFromYahoo(ticker: string, range: Range): Promise<PricePoint[]> {
  const base = process.env.YFINANCE_BASE_URL;
  const hosts = base
    ? [base.replace(/^https?:\/\//, "").replace(/\/$/, "")]
    : ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  const { range: r, interval } = YAHOO_RANGE[range];

  let lastErr: string = "sin respuesta";
  for (const host of hosts) {
    const u = `https://${host}/v8/finance/chart/${encodeURIComponent(
      ticker
    )}?range=${r}&interval=${interval}`;
    try {
      const res = await fetch(u, {
        headers: {
          ...BROWSER_HEADERS,
          accept: "application/json, text/plain, */*",
          referer: "https://finance.yahoo.com/",
          origin: "https://finance.yahoo.com"
        },
        cache: "no-store"
      });
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

  // Stooq tiene dos rutas equivalentes: stooq.com y stooq.pl.
  // Probamos ambas; algunas IPs cloud responden mejor en una u otra.
  const urls = [
    `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&d1=${fmt(from)}&d2=${fmt(to)}&i=d`,
    `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`,
    `https://stooq.pl/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`
  ];

  let lastErr = "sin respuesta";
  for (const u of urls) {
    try {
      const res = await fetch(u, {
        headers: {
          ...BROWSER_HEADERS,
          accept: "text/csv, text/plain, */*",
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
      // Stooq devuelve HTML (captcha / rate limit) o cadenas "no data"/"brak danych".
      if (
        head.startsWith("<") ||
        head.includes("no data") ||
        head.includes("brak danych") ||
        head.includes("exceeded")
      ) {
        lastErr = head.startsWith("<") ? "respuesta HTML (posible rate-limit)" : "sin datos";
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
  const u = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
    symbol
  )}&interval=1day&outputsize=${outputsize}&apikey=${encodeURIComponent(key)}`;
  const res = await fetch(u, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    status?: string;
    code?: number;
    message?: string;
    values?: Array<{ datetime: string; close: string }>;
  };
  if (json.status === "error" || !Array.isArray(json.values)) {
    throw new Error(json.message || "sin datos");
  }
  const out = json.values
    .map((row) => ({ date: row.datetime, close: Number(row.close) }))
    .filter((p) => Number.isFinite(p.close) && p.close > 0);
  // Twelve Data devuelve DESC; los charts esperan ASC.
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
  const res = await fetch(u, { cache: "no-store" });
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
