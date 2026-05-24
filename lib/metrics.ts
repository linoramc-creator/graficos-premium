import type {
  PricePoint,
  RatioReport,
  RegimeBucket,
  RollingCorrelationPoint,
  ThematicBetaPoint,
  UnderwaterPoint
} from "./types";

const TRADING_DAYS = 252;

/** Retornos logarítmicos diarios. */
export function logReturns(prices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const a = prices[i - 1];
    const b = prices[i];
    if (a > 0 && b > 0 && Number.isFinite(a) && Number.isFinite(b)) {
      out.push(Math.log(b / a));
    }
  }
  return out;
}

/** Retornos simples diarios. */
export function simpleReturns(prices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const a = prices[i - 1];
    const b = prices[i];
    if (a > 0 && Number.isFinite(a) && Number.isFinite(b)) {
      out.push(b / a - 1);
    }
  }
  return out;
}

export function mean(xs: number[]): number {
  if (!xs.length) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let acc = 0;
  for (const x of xs) acc += (x - m) ** 2;
  return Math.sqrt(acc / (xs.length - 1));
}

export function downsideDeviation(xs: number[], target = 0): number {
  if (xs.length < 2) return 0;
  let acc = 0;
  let n = 0;
  for (const x of xs) {
    const d = x - target;
    if (d < 0) {
      acc += d * d;
      n += 1;
    }
  }
  if (!n) return 0;
  return Math.sqrt(acc / n);
}

/** Equity curve a partir de retornos simples diarios. */
export function equityCurve(returns: number[], start = 1): number[] {
  const out = new Array(returns.length + 1);
  out[0] = start;
  for (let i = 0; i < returns.length; i++) {
    const r = returns[i];
    out[i + 1] = out[i] * (1 + (Number.isFinite(r) ? r : 0));
  }
  return out;
}

/** Drawdown serie (proporcional, negativa). */
export function drawdownSeries(prices: number[]): number[] {
  const out: number[] = [];
  let peak = -Infinity;
  for (const p of prices) {
    if (p > peak) peak = p;
    out.push(peak > 0 ? p / peak - 1 : 0);
  }
  return out;
}

export function underwaterPoints(history: PricePoint[]): UnderwaterPoint[] {
  const cleaned = history.filter(
    (h) => h && Number.isFinite(h.close) && h.close > 0 && typeof h.date === "string"
  );
  const dd = drawdownSeries(cleaned.map((h) => h.close));
  return cleaned.map((h, i) => ({ date: h.date, drawdown: dd[i] }));
}

export function maxDrawdown(prices: number[]): number {
  const dd = drawdownSeries(prices);
  return dd.length ? Math.min(...dd) : 0;
}

/** CAGR a partir de equity curve y horizonte en años. */
export function cagrFromEquity(equity: number[], years: number): number {
  if (equity.length < 2 || years <= 0) return 0;
  const last = equity[equity.length - 1];
  const first = equity[0];
  if (first <= 0) return 0;
  return Math.pow(last / first, 1 / years) - 1;
}

/**
 * Ratios Sortino, Calmar y Sharpe a partir de un histórico de precios.
 * - Sortino = (CAGR - Rf) / downsideDev_anualizado
 * - Calmar  = CAGR / |maxDrawdown|
 * - Sharpe  = (CAGR - Rf) / stdDev_anualizado    (referencia)
 */
export function computeRatios(prices: number[], riskFree: number): RatioReport {
  const rets = simpleReturns(prices);
  const eq = equityCurve(rets);
  const years = rets.length / TRADING_DAYS;
  const cagr = cagrFromEquity(eq, years);
  const dailyRf = riskFree / TRADING_DAYS;
  const excess = rets.map((r) => r - dailyRf);

  const annVol = stdDev(rets) * Math.sqrt(TRADING_DAYS);
  const annDownside = downsideDeviation(excess, 0) * Math.sqrt(TRADING_DAYS);
  const mdd = maxDrawdown(prices);

  return {
    cagr,
    sortino: annDownside > 0 ? (cagr - riskFree) / annDownside : 0,
    calmar: mdd < 0 ? cagr / Math.abs(mdd) : 0,
    sharpe: annVol > 0 ? (cagr - riskFree) / annVol : 0,
    maxDrawdown: mdd
  };
}

/** Correlación de Pearson entre dos series alineadas. */
export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ax = a.slice(0, n);
  const bx = b.slice(0, n);
  const ma = mean(ax);
  const mb = mean(bx);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const va = ax[i] - ma;
    const vb = bx[i] - mb;
    num += va * vb;
    da += va * va;
    db += vb * vb;
  }
  const denom = Math.sqrt(da * db);
  return denom > 0 ? num / denom : 0;
}

/**
 * Correlación móvil entre el activo y un refugio (típicamente oro - GLD)
 * sobre una ventana en días de trading.
 */
export function rollingCorrelation(
  asset: PricePoint[],
  hedge: PricePoint[],
  window = 60
): RollingCorrelationPoint[] {
  const aligned = alignByDate(asset, hedge);
  if (aligned.length < window + 2) return [];
  const a = simpleReturns(aligned.map((p) => p.a));
  const h = simpleReturns(aligned.map((p) => p.b));
  const dates = aligned.slice(1).map((p) => p.date);
  const out: RollingCorrelationPoint[] = [];
  for (let i = window - 1; i < a.length; i++) {
    const slice = (arr: number[]) => arr.slice(i - window + 1, i + 1);
    out.push({ date: dates[i], correlation: pearson(slice(a), slice(h)) });
  }
  return out;
}

/**
 * Histograma de regímenes según VIX:
 *  - "calm"  : días con VIX <= 25
 *  - "panic" : días con VIX > 25
 * Devuelve cubetas por rango de retorno diario.
 */
export function regimeHistogram(
  asset: PricePoint[],
  vix: PricePoint[],
  threshold = 25,
  bins = 12
): RegimeBucket[] {
  const aligned = alignByDate(asset, vix);
  if (aligned.length < 3) return [];

  const ret = simpleReturns(aligned.map((p) => p.a));
  // El VIX se alinea con cada retorno: usamos el VIX del día t.
  const vixSeries = aligned.slice(1).map((p) => p.b);

  const min = Math.min(...ret);
  const max = Math.max(...ret);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [];

  const width = (max - min) / bins;
  const calm = new Array(bins).fill(0);
  const panic = new Array(bins).fill(0);

  for (let i = 0; i < ret.length; i++) {
    const r = ret[i];
    const v = vixSeries[i];
    if (!Number.isFinite(r) || !Number.isFinite(v)) continue;
    const idx = Math.min(bins - 1, Math.floor((r - min) / width));
    if (v > threshold) panic[idx] += 1;
    else calm[idx] += 1;
  }

  return calm.map((_, i) => {
    const lo = (min + i * width) * 100;
    const hi = lo + width * 100;
    return {
      bucket: `${lo.toFixed(1)}%–${hi.toFixed(1)}%`,
      calm: calm[i],
      panic: panic[i]
    };
  });
}

/**
 * Beta temática: pendiente de OLS asset_return = alpha + beta * factor_return.
 * Devuelve además la nube de puntos para scatter.
 */
export function thematicBeta(
  asset: PricePoint[],
  factor: PricePoint[]
): { beta: number; alpha: number; points: ThematicBetaPoint[] } {
  const aligned = alignByDate(asset, factor);
  if (aligned.length < 5) return { beta: 0, alpha: 0, points: [] };
  const a = simpleReturns(aligned.map((p) => p.a));
  const f = simpleReturns(aligned.map((p) => p.b));
  const dates = aligned.slice(1).map((p) => p.date);
  const ma = mean(a);
  const mf = mean(f);
  let cov = 0;
  let varf = 0;
  for (let i = 0; i < a.length; i++) {
    cov += (a[i] - ma) * (f[i] - mf);
    varf += (f[i] - mf) ** 2;
  }
  const beta = varf > 0 ? cov / varf : 0;
  const alpha = ma - beta * mf;
  const points: ThematicBetaPoint[] = dates.map((date, i) => ({
    date,
    oilReturn: f[i],
    assetReturn: a[i]
  }));
  return { beta, alpha, points };
}

interface AlignedPoint {
  date: string;
  a: number;
  b: number;
}

function alignByDate(a: PricePoint[], b: PricePoint[]): AlignedPoint[] {
  const mapB = new Map<string, number>();
  for (const p of b) {
    if (p && Number.isFinite(p.close) && p.close > 0) mapB.set(p.date, p.close);
  }
  const out: AlignedPoint[] = [];
  for (const p of a) {
    if (!p || !Number.isFinite(p.close) || p.close <= 0) continue;
    const bv = mapB.get(p.date);
    if (typeof bv === "number") out.push({ date: p.date, a: p.close, b: bv });
  }
  return out;
}
