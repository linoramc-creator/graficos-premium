import type { PricePoint } from "./types";

/**
 * Capa modular de datos. Hoy resuelve contra Yahoo Finance (vía nuestro
 * endpoint proxy en /api/quote). Mañana se cambia a EODHD sin tocar los
 * componentes: basta con setear DATA_PROVIDER=eodhd y EODHD_API_KEY.
 */
export type Range = "6mo" | "1y" | "2y" | "5y";

export interface HistoryResponse {
  ticker: string;
  range: Range;
  history: PricePoint[];
}

const RANGE_TO_DAYS: Record<Range, number> = {
  "6mo": 180,
  "1y": 365,
  "2y": 730,
  "5y": 1825
};

export async function fetchHistory(
  ticker: string,
  range: Range = "2y",
  init?: RequestInit
): Promise<HistoryResponse> {
  const params = new URLSearchParams({ ticker, range });
  const res = await fetch(`/api/quote?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
    ...init
  });
  if (!res.ok) {
    const body = await safeJson(res);
    const attempts = Array.isArray(body?.attempts) ? body.attempts.join(" · ") : "";
    const hint = typeof body?.hint === "string" ? ` ${body.hint}` : "";
    throw new DataSourceError(
      `No se pudo obtener "${ticker}".${attempts ? ` Intentos: ${attempts}.` : ""}${hint}`
    );
  }
  const data = (await res.json()) as HistoryResponse;
  if (!data?.history?.length) {
    throw new DataSourceError(`El ticker "${ticker}" no devolvió datos.`);
  }
  return {
    ...data,
    history: cleanSeries(data.history, RANGE_TO_DAYS[range])
  };
}

export class DataSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataSourceError";
  }
}

async function safeJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Limpieza estricta para evitar nulos, fechas inválidas o cierres negativos
 * que rompan Recharts.
 */
export function cleanSeries(points: PricePoint[], maxLookbackDays?: number): PricePoint[] {
  const seen = new Set<string>();
  const cleaned: PricePoint[] = [];
  for (const p of points) {
    if (!p) continue;
    const { date, close } = p;
    if (typeof date !== "string" || !date) continue;
    if (typeof close !== "number" || !Number.isFinite(close) || close <= 0) continue;
    if (seen.has(date)) continue;
    seen.add(date);
    cleaned.push({ date, close });
  }
  cleaned.sort((a, b) => (a.date < b.date ? -1 : 1));
  if (maxLookbackDays && cleaned.length > maxLookbackDays) {
    return cleaned.slice(-maxLookbackDays);
  }
  return cleaned;
}
