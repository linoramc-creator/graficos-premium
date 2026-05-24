import type {
  HistogramBin,
  Scenario,
  SimulationInputs,
  TrajectoryPoint
} from "./types";
import { gaussian, mulberry32, poisson } from "./rng";

const TRADING_DAYS = 252;

function pickScenario(rand: () => number, scenarios: Scenario[]): Scenario {
  // Normaliza por seguridad (si el usuario suma != 1).
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
 * Merton Jump-Diffusion (versión escolar institucional).
 *
 * dS/S = (mu - lambda * k) dt + sigma dW + (J - 1) dN
 *
 * Implementación discreta diaria con dt = 1/252:
 *   - Drift continuo + difusión gaussiana.
 *   - Saltos: Poisson(lambda * dt) por número de saltos del día;
 *     cada salto es lognormal con media `jumpMean` y desviación `jumpStd`
 *     (en log-retornos).
 *   - Corrección de drift por compensación de salto (-lambda * k * dt),
 *     donde k = E[J-1] = exp(jumpMean + jumpStd^2/2) - 1.
 *
 * El escenario (base/moderado/severo) se sortea por trayectoria, de modo
 * que el ensemble refleja la mezcla geopolítica configurada.
 */
export interface SimulationResult {
  finalPrices: number[];
  histogram: HistogramBin[];
  trajectories: TrajectoryPoint[];
  returns: number[];
}

export function runMonteCarlo(inputs: SimulationInputs, seed = 42): SimulationResult {
  const rand = mulberry32(seed);
  const dt = 1 / TRADING_DAYS;
  const sigma = Math.max(1e-6, inputs.volatility);
  const mu = inputs.drift;
  const horizon = Math.max(1, Math.floor(inputs.horizonDays));
  const totalPaths = Math.max(100, Math.floor(inputs.paths));

  const finalPrices = new Array<number>(totalPaths);
  const sampledTrajectoriesCount = Math.min(50, totalPaths);
  const sampleEvery = Math.max(1, Math.floor(totalPaths / sampledTrajectoriesCount));

  // Estructura para trayectorias: step -> { step, p0..pN }
  // Trabajamos sobre un Record mutable y casteamos al tipo final al devolver.
  const rawTrajectories: Array<Record<string, number>> = Array.from(
    { length: horizon + 1 },
    (_, step) => ({ step })
  );

  let storedPaths = 0;
  for (let i = 0; i < totalPaths; i++) {
    const scenario = pickScenario(rand, inputs.scenarios);
    const lambda = Math.max(0, scenario.jumpIntensity);
    const jMean = scenario.jumpMean;
    const jStd = Math.max(0, scenario.jumpStd);
    const k = Math.exp(jMean + (jStd * jStd) / 2) - 1;

    let price = inputs.spot;
    const recordThisPath = i % sampleEvery === 0 && storedPaths < sampledTrajectoriesCount;
    if (recordThisPath) {
      rawTrajectories[0][`p${storedPaths}`] = price;
    }

    for (let t = 1; t <= horizon; t++) {
      const z = gaussian(rand);
      const drift = (mu - 0.5 * sigma * sigma - lambda * k) * dt;
      const diffusion = sigma * Math.sqrt(dt) * z;

      // Saltos del día
      const n = poisson(rand, lambda * dt);
      let jump = 0;
      for (let j = 0; j < n; j++) {
        jump += jMean + jStd * gaussian(rand);
      }

      price = price * Math.exp(drift + diffusion + jump);
      if (recordThisPath) {
        rawTrajectories[t][`p${storedPaths}`] = price;
      }
    }

    if (recordThisPath) storedPaths += 1;
    finalPrices[i] = price;
  }

  const trajectories = rawTrajectories as unknown as TrajectoryPoint[];

  // Histograma sobre precios finales
  const histogram = buildHistogram(finalPrices, 40);
  // Retornos absolutos para métricas externas
  const returns = finalPrices.map((p) => p / inputs.spot - 1);

  return { finalPrices, histogram, trajectories, returns };
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
