"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ChartCard } from "../ChartCard";
import { EmptyState } from "../EmptyState";
import { fmtNum, percentile } from "@/lib/format";
import type { HistogramBin } from "@/lib/types";

interface Props {
  histogram: HistogramBin[];
  finalPrices: number[];
  spot: number;
}

export function MonteCarloHistogram({ histogram, finalPrices, spot }: Props) {
  const valid = histogram.filter((b) => b && Number.isFinite(b.count));
  const p05 = finalPrices.length ? percentile(finalPrices, 0.05) : NaN;
  const p50 = finalPrices.length ? percentile(finalPrices, 0.5) : NaN;
  const p95 = finalPrices.length ? percentile(finalPrices, 0.95) : NaN;

  return (
    <ChartCard
      title="Histograma Montecarlo · Merton Jump-Diffusion"
      subtitle="Distribución de precios finales tras la mezcla de escenarios configurada"
      narrativeKey="monteCarlo"
      badge={
        <div className="text-right text-xs font-mono text-ink-secondary leading-tight">
          <div>p05: <span className="text-accent-danger">{fmtNum(p05)}</span></div>
          <div>p50: <span className="text-ink-primary">{fmtNum(p50)}</span></div>
          <div>p95: <span className="text-accent-ok">{fmtNum(p95)}</span></div>
        </div>
      }
    >
      {valid.length === 0 ? (
        <EmptyState
          title="Sin datos suficientes para construir el histograma"
          description="Ejecuta una simulación con al menos 500 trayectorias."
        />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={valid} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <XAxis
              dataKey="binLabel"
              tick={{ fill: "#9aa6b8", fontSize: 10 }}
              interval={Math.max(0, Math.floor(valid.length / 8))}
            />
            <YAxis tick={{ fill: "#9aa6b8", fontSize: 10 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "#11151f",
                border: "1px solid #1f2937",
                borderRadius: 8
              }}
              labelStyle={{ color: "#e7ecf3" }}
              formatter={(value: number) => [`${value} simulaciones`, "Conteo"]}
            />
            <ReferenceLine x={findBinFor(valid, spot)} stroke="#d4af37" strokeDasharray="4 2" />
            <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function findBinFor(bins: HistogramBin[], value: number): string | undefined {
  for (let i = 0; i < bins.length; i++) {
    const lo = bins[i].bin;
    const hi = i + 1 < bins.length ? bins[i + 1].bin : Infinity;
    if (value >= lo && value < hi) return bins[i].binLabel;
  }
  return undefined;
}
