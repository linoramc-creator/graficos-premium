import type {
  BandPoint,
  HistogramBin,
  Scenario,
  SimulationInputs
} from "./types";
import { gaussian, mulberry32, poisson } from "./rng";

const TRADING_DAYS = 252;
/** Cuántas trayectorias muestreamos para la "nube" visual del gráfico.
 *  Recharts puede dibujar ~100 lineas SVG con render aceptable. Más allá
 *  el FPS cae y, en cualquier caso, la información se sobresatura.       */
const VISUAL_SAMPLE = 100;

function pickScenario(rand: () => number, scenarios: Scenario[]): Scenario {
  const total = scenarios.reduce((acc, s) => acc + Math.max(0, s.probability), 0) || 1;
  const u = rand() * total;
  let cum = 0;
  for (const s of scenarios) {
    cum += Math.max(0, s.probability);
    if (u <= cum) return s;
  }
  return scenarios[scenarios.length - 1];
}

/**
 * Merton Jump-Diffusion (versión institucional).
 *
 *   dS/S = (mu - lambda * k) dt + sigma dW + (J - 1) dN
 *
 * dt = 1/252. Saltos: Poisson(lambda * dt) por número de saltos del día;
 * cada salto es lognormal con media `jumpMean` y desv. `jumpStd` (log).
 * Corrección de drift: k = exp(jumpMean + jumpStd^2/2) - 1.
 *
 * Outputs:
 *   · finalPrices[]                 — para histograma y métricas escalares
 *   · histogram[]                   — pre-agrupado a 40 bins
 *   · bands[]                       — P5/P25/P50/P75/P95 por step
 *   · sampledPaths[][]              — 100 caminos para nube visual
 *   · probProfit                    — fracción de paths > spot al final
 *   · medianFinal, p05Final, p95Final, medianReturn
 *   · returns[]                     — distribución de retornos finales
 */
export interface SimulationResult {
  finalPrices: number[];
  histogram: HistogramBin[];
  bands: BandPoint[];
  sampledPaths: number[][];
  returns: number[];
  probProfit: number;
  medianFinal: number;
  p05Final: number;
  p95Final: number;
  medianReturn: number;
  pathsCount: number;
  horizon: number;
}

export function runMonteCarlo(inputs: SimulationInputs, seed = 42): SimulationResult {
  const rand = mulberry32(seed);
  const dt = 1 / TRADING_DAYS;
  const sigma = Math.max(1e-6, inputs.volatility);
  const mu = inputs.drift;
  const horizon = Math.max(1, Math.floor(inputs.horizonDays));
  const totalPaths = Math.max(100, Math.floor(inputs.paths));
  const stride = horizon + 1;

  // Almacenamos TODAS las trayectorias en un Float64Array plano
  // (paths * (horizon+1)). Para 10k paths * 252 días son ~20MB,
  // perfectamente viable en navegador moderno.
  const allPaths = new Float64Array(totalPaths * stride);

  for (let i = 0; i < totalPaths; i++) {
    const scenario = pickScenario(rand, inputs.scenarios);
    const lambda = Math.max(0, scenario.jumpIntensity);
    const jMean = scenario.jumpMean;
    const jStd = Math.max(0, scenario.jumpStd);
    const k = Math.exp(jMean + (jStd * jStd) / 2) - 1;

    let price = inputs.spot;
    const base = i * stride;
    allPaths[base] = price;

    for (let t = 1; t <= horizon; t++) {
      const z = gaussian(rand);
      const drift = (mu - 0.5 * sigma * sigma - lambda * k) * dt;
      const diffusion = sigma * Math.sqrt(dt) * z;
      const n = poisson(rand, lambda * dt);
      let jump = 0;
      for (let j = 0; j < n; j++) {
        jump += jMean + jStd * gaussian(rand);
      }
      price = price * Math.exp(drift + diffusion + jump);
      allPaths[base + t] = price;
    }
  }

  // ---------- Percentiles por step (núcleo de la viz institucional) ----------
  const bands: BandPoint[] = new Array(stride);
  const col = new Float64Array(totalPaths);
  for (let t = 0; t < stride; t++) {
    for (let i = 0; i < totalPaths; i++) col[i] = allPaths[i * stride + t];
    // TypedArray.sort en V8 usa TimSort optimizado: O(N log N) muy rápido.
    const sorted = Float64Array.from(col).sort();
    const p05 = percentileFromSorted(sorted, 0.05);
    const p25 = percentileFromSorted(sorted, 0.25);
    const p50 = percentileFromSorted(sorted, 0.5);
    const p75 = percentileFromSorted(sorted, 0.75);
    const p95 = percentileFromSorted(sorted, 0.95);
    bands[t] = {
      step: t,
      p05,
      p25,
      p50,
      p75,
      p95,
      band95: [p05, p95],
      band50: [p25, p75]
    };
  }

  // ---------- Muestreo visual ----------
  const sampleCount = Math.min(VISUAL_SAMPLE, totalPaths);
  const sampleStep = Math.max(1, Math.floor(totalPaths / sampleCount));
  const sampledPaths: number[][] = [];
  for (let i = 0; i < totalPaths && sampledPaths.length < sampleCount; i += sampleStep) {
    const base = i * stride;
    const path = new Array<number>(stride);
    for (let t = 0; t < stride; t++) path[t] = allPaths[base + t];
    sampledPaths.push(path);
  }

  // ---------- Escalares finales ----------
  const finalPrices = new Array<number>(totalPaths);
  let aboveEntry = 0;
  for (let i = 0; i < totalPaths; i++) {
    const fp = allPaths[i * stride + horizon];
    finalPrices[i] = fp;
    if (fp > inputs.spot) aboveEntry += 1;
  }
  const sortedFinal = Float64Array.from(finalPrices).sort();
  const p05Final = percentileFromSorted(sortedFinal, 0.05);
  const medianFinal = percentileFromSorted(sortedFinal, 0.5);
  const p95Final = percentileFromSorted(sortedFinal, 0.95);
  const probProfit = aboveEntry / totalPaths;
  const medianReturn = medianFinal / inputs.spot - 1;
  const returns = finalPrices.map((p) => p / inputs.spot - 1);

  return {
    finalPrices,
    histogram: buildHistogram(finalPrices, 40),
    bands,
    sampledPaths,
    returns,
    probProfit,
    medianFinal,
    p05Final,
    p95Final,
    medianReturn,
    pathsCount: totalPaths,
    horizon
  };
}

function percentileFromSorted(sorted: Float64Array | number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const idx = (n - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function buildHistogram(values: number[], bins: number): HistogramBin[] {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [{ bin: min, binLabel: min.toFixed(2), count: values.length }];
  }
  const width = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    const idx = Math.min(bins - 1, Math.floor((v - min) / width));
    counts[idx] += 1;
  }
  return counts.map((count, i) => {
    const lo = min + i * width;
    const hi = lo + width;
    return {
      bin: lo,
      binLabel: `${lo.toFixed(0)}–${hi.toFixed(0)}`,
      count
    };
  });
}
