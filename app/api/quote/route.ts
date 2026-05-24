import { NextResponse } from "next/server";
import type { PricePoint } from "@/lib/types";
import type { Range } from "@/lib/datasource";

export const dynamic = "force-dynamic";

const RANGE_MAP: Record<Range, { range: string; interval: string }> = {
  "6mo": { range: "6mo", interval: "1d" },
  "1y": { range: "1y", interval: "1d" },
  "2y": { range: "2y", interval: "1d" },
  "5y": { range: "5y", interval: "1d" }
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = (url.searchParams.get("ticker") || "").trim().toUpperCase();
  const range = (url.searchParams.get("range") || "2y") as Range;

  if (!ticker) {
    return NextResponse.json({ error: "Falta el parámetro 'ticker'." }, { status: 400 });
  }
  if (!RANGE_MAP[range]) {
    return NextResponse.json({ error: `Rango no soportado: ${range}` }, { status: 400 });
  }

  const provider = (process.env.DATA_PROVIDER || "yfinance").toLowerCase();
  try {
    const history =
      provider === "eodhd"
        ? await fetchFromEODHD(ticker, range)
        : await fetchFromYahoo(ticker, range);

    if (!history.length) {
      return NextResponse.json(
        { error: `El ticker "${ticker}" no devolvió datos.` },
        { status: 404 }
      );
    }
    return NextResponse.json({ ticker, range, history });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

async function fetchFromYahoo(ticker: string, range: Range): Promise<PricePoint[]> {
  const base = process.env.YFINANCE_BASE_URL || "https://query1.finance.yahoo.com";
  const { range: r, interval } = RANGE_MAP[range];
  const u = `${base}/v8/finance/chart/${encodeURIComponent(ticker)}?range=${r}&interval=${interval}`;
  const res = await fetch(u, {
    headers: {
      // Yahoo bloquea user-agents en blanco desde algunos entornos cloud
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"
    },
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error(`Yahoo respondió HTTP ${res.status}`);
  }
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) {
    const error = json?.chart?.error?.description || "Sin datos";
    throw new Error(error);
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
  return out;
}

async function fetchFromEODHD(ticker: string, range: Range): Promise<PricePoint[]> {
  const key = process.env.EODHD_API_KEY;
  if (!key) throw new Error("EODHD_API_KEY no configurada.");
  const to = new Date();
  const from = new Date();
  const lookback: Record<Range, number> = { "6mo": 180, "1y": 365, "2y": 730, "5y": 1825 };
  from.setDate(from.getDate() - lookback[range]);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const u = `https://eodhd.com/api/eod/${encodeURIComponent(
    ticker
  )}?from=${fmt(from)}&to=${fmt(to)}&period=d&fmt=json&api_token=${key}`;
  const res = await fetch(u, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`EODHD respondió HTTP ${res.status}`);
  }
  const arr = (await res.json()) as Array<{ date: string; adjusted_close?: number; close?: number }>;
  return arr
    .map((row) => ({
      date: row.date,
      close: Number(row.adjusted_close ?? row.close ?? NaN)
    }))
    .filter((p) => Number.isFinite(p.close) && p.close > 0);
}
