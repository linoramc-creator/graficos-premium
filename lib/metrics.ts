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

/**
 * Inner-join sobre fechas con forward-fill de tolerancia ±1 día hábil.
 *
 * Motivación: cuando dos series vienen de proveedores distintos (p.ej.
 * AMZN vía Yahoo y ^VIX vía Stooq) puede haber huecos sueltos en la
 * serie B porque alguna fecha no existe (festivos diferentes, datos
 * recortados). Para esos casos arrastramos el último cierre conocido de
 * B (carry-forward, una práctica estándar en pandas: `.reindex(...).ffill()`).
 * Si tampoco hay nada previo, descartamos esa fecha.
 */
function alignByDate(a: PricePoint[], b: PricePoint[]): AlignedPoint[] {
  if (!a.length || !b.length) return [];

  const cleanB = b
    .filter((p) => p && Number.isFinite(p.close) && p.close > 0 && typeof p.date === "string")
    .sort((x, y) => (x.date < y.date ? -1 : 1));
  if (!cleanB.length) return [];

  const mapB = new Map<string, number>();
  for (const p of cleanB) mapB.set(p.date, p.close);

  // Para forward-fill: lista ordenada de fechas B, búsqueda binaria.
  const datesB = cleanB.map((p) => p.date);

  function lastKnownB(date: string): number | null {
    const direct = mapB.get(date);
    if (typeof direct === "number") return direct;
    // Búsqueda binaria del mayor date_b <= date.
    let lo = 0;
    let hi = datesB.length - 1;
    let best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (datesB[mid] <= date) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (best < 0) return null;
    // Solo aceptamos forward-fill si la fecha B previa está a 5 días o menos
    // (descartamos arrastres muy lejanos que distorsionan correlaciones).
    const prevDate = new Date(datesB[best]).getTime();
    const targetDate = new Date(date).getTime();
    const gapDays = (targetDate - prevDate) / (1000 * 60 * 60 * 24);
    if (gapDays > 5) return null;
    return mapB.get(datesB[best]) ?? null;
  }

  const out: AlignedPoint[] = [];
  for (const p of a) {
    if (!p || !Number.isFinite(p.close) || p.close <= 0) continue;
    const bv = lastKnownB(p.date);
    if (typeof bv === "number") out.push({ date: p.date, a: p.close, b: bv });
  }
  return out;
}
