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

/**
 * Mapeo de tickers entre proveedores. Yahoo es nuestro estándar interno;
 * cuando caemos a Stooq traducimos. Stooq es gratis, sin API key y NO
 * bloquea IPs de cloud (Vercel, AWS), que es justo lo que rompe yfinance
 * en producción.
 */
const STOOQ_MAP: Record<string, string> = {
  "^VIX": "^vix",
  "^GSPC": "^spx",
  "^DJI": "^dji",
  "^IXIC": "^ndx",
  "BZ=F": "cb.f", // Brent crudo continuo
  "CL=F": "cl.f", // WTI crudo continuo
  "GC=F": "gc.f", // Oro futuro
  "GLD": "gld.us",
  "SPY": "spy.us",
  "QQQ": "qqq.us"
};

function toStooqSymbol(ticker: string): string {
  if (STOOQ_MAP[ticker]) return STOOQ_MAP[ticker];
  if (ticker.startsWith("^")) return ticker.toLowerCase();
  // Acciones US por defecto
  return `${ticker.toLowerCase()}.us`;
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
  const attempts: Array<{ name: string; fn: () => Promise<PricePoint[]> }> = [];

  if (forced === "eodhd") {
    attempts.push({ name: "eodhd", fn: () => fetchFromEODHD(ticker, range) });
  } else if (forced === "stooq") {
    attempts.push({ name: "stooq", fn: () => fetchFromStooq(ticker, range) });
  } else if (forced === "yahoo" || forced === "yfinance") {
    attempts.push({ name: "yahoo", fn: () => fetchFromYahoo(ticker, range) });
  } else {
    // Cascada por defecto: Yahoo (más rico) → Stooq (cloud-friendly) → EODHD.
    attempts.push({ name: "yahoo", fn: () => fetchFromYahoo(ticker, range) });
    attempts.push({ name: "stooq", fn: () => fetchFromStooq(ticker, range) });
    if (process.env.EODHD_API_KEY) {
      attempts.push({ name: "eodhd", fn: () => fetchFromEODHD(ticker, range) });
    }
  }

  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      const history = await attempt.fn();
      if (history.length >= 5) {
        return NextResponse.json({
          ticker,
          range,
          provider: attempt.name,
          history
        });
      }
      errors.push(`${attempt.name}: sin datos suficientes`);
    } catch (e) {
      errors.push(`${attempt.name}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  return NextResponse.json(
    {
      error: `No se pudo obtener "${ticker}". Intentos: ${errors.join(" · ")}`
    },
    { status: 502 }
  );
}

/* ------------------------------ Yahoo ------------------------------ */

async function fetchFromYahoo(ticker: string, range: Range): Promise<PricePoint[]> {
  const base = process.env.YFINANCE_BASE_URL || "https://query1.finance.yahoo.com";
  const { range: r, interval } = YAHOO_RANGE[range];
  const u = `${base}/v8/finance/chart/${encodeURIComponent(
    ticker
  )}?range=${r}&interval=${interval}`;
  const res = await fetch(u, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.9"
    },
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) {
    const description = json?.chart?.error?.description || "sin datos";
    throw new Error(description);
  }
  const timestamps: number[] = result.timestamp || [];
  const closes: Array<number | null> = result.indicators?.quote?.[0]?.close || [];
  const out: PricePoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const close = closes[i];
    if (typeof ts !== "number" || typeof close !== "number" || !Number.isFinite(close)) continue;
    out.push({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      close
    });
  }
  return out;
}

/* ------------------------------ Stooq ------------------------------ */

async function fetchFromStooq(ticker: string, range: Range): Promise<PricePoint[]> {
  const symbol = toStooqSymbol(ticker);
  const u = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`;
  const res = await fetch(u, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
      accept: "text/csv, */*"
    },
    cache: "no-store"
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = (await res.text()).trim();
  if (!text || text.toLowerCase().startsWith("no data")) {
    throw new Error("sin datos");
  }
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV vacío");
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const dateIdx = header.indexOf("date");
  const closeIdx = header.indexOf("close");
  if (dateIdx < 0 || closeIdx < 0) throw new Error("CSV con cabecera inesperada");

  const out: PricePoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const date = cols[dateIdx];
    const close = Number(cols[closeIdx]);
    if (!date || !Number.isFinite(close) || close <= 0) continue;
    out.push({ date, close });
  }
  // Recorta al rango pedido
  const days = RANGE_DAYS[range];
  if (out.length > days) return out.slice(-days);
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
  // EODHD usa sufijo de exchange. Para tickers US sin sufijo añadimos .US.
  const symbol = ticker.includes(".") || ticker.startsWith("^") ? ticker : `${ticker}.US`;
  const u = `https://eodhd.com/api/eod/${encodeURIComponent(
    symbol
  )}?from=${fmt(from)}&to=${fmt(to)}&period=d&fmt=json&api_token=${key}`;
  const res = await fetch(u, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const arr = (await res.json()) as Array<{
    date: string;
    adjusted_close?: number;
    close?: number;
  }>;
  return arr
    .map((row) => ({
      date: row.date,
      close: Number(row.adjusted_close ?? row.close ?? NaN)
    }))
    .filter((p) => Number.isFinite(p.close) && p.close > 0);
}
