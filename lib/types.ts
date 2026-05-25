export type ScenarioKey = "base" | "moderate" | "severe";

export interface Scenario {
  key: ScenarioKey;
  label: string;
  probability: number;
  jumpMean: number;
  jumpStd: number;
  jumpIntensity: number;
  description: string;
}

export interface SimulationInputs {
  ticker: string;
  spot: number;
  drift: number;
  volatility: number;
  riskFree: number;
  horizonDays: number;
  paths: number;
  scenarios: Scenario[];
}

export interface PricePoint {
  date: string;
  close: number;
}

export interface HistogramBin {
  bin: number;
  binLabel: string;
  count: number;
}

/**
 * Banda de percentiles por step temporal. La estructura está pensada para
 * alimentar directamente Recharts: cada elemento representa un día de
 * trading y trae el corte transversal de la distribución simulada.
 */
export interface BandPoint {
  step: number;
  p05: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  band95: [number, number];
  band50: [number, number];
}

export interface UnderwaterPoint {
  date: string;
  drawdown: number;
}

export interface RollingCorrelationPoint {
  date: string;
  correlation: number;
}

export interface RegimeBucket {
  bucket: string;
  calm: number;
  panic: number;
}

export interface ThematicBetaPoint {
  date: string;
  oilReturn: number;
  assetReturn: number;
}

export interface RatioReport {
  sortino: number;
  calmar: number;
  sharpe: number;
  cagr: number;
  maxDrawdown: number;
}
