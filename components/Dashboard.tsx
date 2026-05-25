"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "./Header";
import { InputPanel } from "./InputPanel";
import { MonteCarloPaths } from "./charts/MonteCarloPaths";
import { MonteCarloHistogram } from "./charts/MonteCarloHistogram";
import { RatiosPanel } from "./charts/RatiosPanel";
import { UnderwaterChart } from "./charts/UnderwaterChart";
import { RefugeThermometer } from "./charts/RefugeThermometer";
import { RegimeHistogram } from "./charts/RegimeHistogram";
import { ThematicBetaChart } from "./charts/ThematicBetaChart";
import { DEFAULT_SCENARIOS } from "@/lib/scenarios";
import { fetchHistory, type Range } from "@/lib/datasource";
import { runMonteCarlo, type SimulationResult } from "@/lib/montecarlo";
import {
  computeRatios,
  logReturns,
  regimeHistogram,
  rollingCorrelation,
  stdDev,
  thematicBeta,
  underwaterPoints
} from "@/lib/metrics";
import type {
  PricePoint,
  RatioReport,
  RegimeBucket,
  RollingCorrelationPoint,
  SimulationInputs,
  ThematicBetaPoint,
  UnderwaterPoint
} from "@/lib/types";

const RANGE: Range = "2y";

const DEFAULT_INPUTS: SimulationInputs = {
  ticker: "AAPL",
  spot: 220,
  drift: 0.07,
  volatility: 0.28,
  riskFree: 0.04,
  horizonDays: 252,
  paths: 10000,
  scenarios: DEFAULT_SCENARIOS
};

interface HistoryBundle {
  asset: PricePoint[];
  gld: PricePoint[];
  vix: PricePoint[];
  oil: PricePoint[];
}

interface Derived {
  ratios: RatioReport | null;
  underwater: UnderwaterPoint[];
  refuge: RollingCorrelationPoint[];
  regime: RegimeBucket[];
  beta: { beta: number; alpha: number; points: ThematicBetaPoint[] };
}

const EMPTY_DERIVED: Derived = {
  ratios: null,
  underwater: [],
  refuge: [],
  regime: [],
  beta: { beta: 0, alpha: 0, points: [] }
};

export function Dashboard() {
  const [inputs, setInputs] = useState<SimulationInputs>(DEFAULT_INPUTS);
  const [bundle, setBundle] = useState<HistoryBundle | null>(null);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async (ticker: string) => {
    setLoading(true);
    setError(null);
    try {
      const [asset, gld, vix, oil] = await Promise.allSettled([
        fetchHistory(ticker, RANGE),
        fetchHistory("GLD", RANGE),
        fetchHistory("^VIX", RANGE),
        fetchHistory("BZ=F", RANGE)
      ]);

      if (asset.status !== "fulfilled") {
        throw new Error(
          asset.reason instanceof Error
            ? asset.reason.message
            : `No se pudo cargar "${ticker}".`
        );
      }

      const next: HistoryBundle = {
        asset: asset.value.history,
        gld: gld.status === "fulfilled" ? gld.value.history : [],
        vix: vix.status === "fulfilled" ? vix.value.history : [],
        oil: oil.status === "fulfilled" ? oil.value.history : []
      };
      setBundle(next);

      const last = next.asset[next.asset.length - 1];
      const rets = logReturns(next.asset.map((p) => p.close));
      const annVol = stdDev(rets) * Math.sqrt(252);
      setInputs((prev) => ({
        ...prev,
        ticker,
        spot: last?.close ?? prev.spot,
        volatility:
          Number.isFinite(annVol) && annVol > 0 ? Number(annVol.toFixed(3)) : prev.volatility
      }));
    } catch (e) {
      setBundle(null);
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(DEFAULT_INPUTS.ticker);
  }, [loadHistory]);

  const derived: Derived = useMemo(() => {
    if (!bundle) return EMPTY_DERIVED;
    const { asset, gld, vix, oil } = bundle;
    if (asset.length < 30) return EMPTY_DERIVED;

    const prices = asset.map((p) => p.close);
    return {
      ratios: computeRatios(prices, inputs.riskFree),
      underwater: underwaterPoints(asset),
      refuge: gld.length ? rollingCorrelation(asset, gld, 60) : [],
      regime: vix.length ? regimeHistogram(asset, vix, 25, 12) : [],
      beta: oil.length ? thematicBeta(asset, oil) : EMPTY_DERIVED.beta
    };
  }, [bundle, inputs.riskFree]);

  const handleRun = useCallback(() => {
    setLoading(true);
    // Cede el hilo principal antes de quemar 10k paths sintéticos.
    setTimeout(() => {
      try {
        const sim = runMonteCarlo(inputs);
        setSimulation(sim);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al simular");
      } finally {
        setLoading(false);
      }
    }, 0);
  }, [inputs]);

  return (
    <>
      <Header ticker={inputs.ticker} range={RANGE} />

      {error && (
        <div className="mb-6 rounded-lg border border-accent-danger/40 bg-accent-danger/10 p-4 text-sm text-ink-primary">
          <strong className="text-accent-danger">No se pudo cargar el activo:</strong> {error}
          <p className="text-ink-muted mt-1 text-xs">
            Puede que el ticker no exista, que el proveedor esté limitando peticiones desde el
            hosting, o que la red del entorno no permita salir a Internet. La UI permanece estable:
            sólo los gráficos dependientes de datos quedan vacíos.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <InputPanel
          inputs={inputs}
          onChange={setInputs}
          onRun={handleRun}
          onReload={() => loadHistory(inputs.ticker)}
          loading={loading}
        />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Monte Carlo institucional ocupa todo el ancho */}
          <div className="xl:col-span-2">
            <MonteCarloPaths
              bands={simulation?.bands ?? []}
              sampledPaths={simulation?.sampledPaths ?? []}
              spot={inputs.spot}
              medianFinal={simulation?.medianFinal ?? 0}
              p05Final={simulation?.p05Final ?? 0}
              p95Final={simulation?.p95Final ?? 0}
              medianReturn={simulation?.medianReturn ?? 0}
              probProfit={simulation?.probProfit ?? 0}
              pathsCount={simulation?.pathsCount ?? 0}
              horizon={simulation?.horizon ?? inputs.horizonDays}
            />
          </div>

          <MonteCarloHistogram
            histogram={simulation?.histogram ?? []}
            p05={simulation?.p05Final ?? NaN}
            p50={simulation?.medianFinal ?? NaN}
            p95={simulation?.p95Final ?? NaN}
            spot={inputs.spot}
          />
          <RatiosPanel report={derived.ratios} />
          <UnderwaterChart data={derived.underwater} />
          <RefugeThermometer data={derived.refuge} />
          <RegimeHistogram data={derived.regime} />
          <div className="xl:col-span-2">
            <ThematicBetaChart
              beta={derived.beta.beta}
              alpha={derived.beta.alpha}
              points={derived.beta.points}
            />
          </div>
        </div>
      </div>
    </>
  );
}
