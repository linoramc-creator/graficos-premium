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

export interface TrajectoryPoint {
  step: number;
  [path: `p${number}`]: number;
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
