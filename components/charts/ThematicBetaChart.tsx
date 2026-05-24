"use client";

import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ChartCard } from "../ChartCard";
import { EmptyState } from "../EmptyState";
import { fmtNum } from "@/lib/format";
import type { ThematicBetaPoint } from "@/lib/types";

interface Props {
  beta: number;
  alpha: number;
  points: ThematicBetaPoint[];
}

export function ThematicBetaChart({ beta, alpha, points }: Props) {
  const valid = points.filter(
    (p) => p && Number.isFinite(p.assetReturn) && Number.isFinite(p.oilReturn)
  );

  // Línea de regresión y = alpha + beta * x sobre rango observado.
  const xs = valid.map((p) => p.oilReturn);
  const xMin = xs.length ? Math.min(...xs) : -0.05;
  const xMax = xs.length ? Math.max(...xs) : 0.05;
  const line = [
    { oilReturn: xMin, predicted: alpha + beta * xMin },
    { oilReturn: xMax, predicted: alpha + beta * xMax }
  ];

  const interpretation =
    beta > 0.3
      ? "Adicta al coste energético: un shock de petróleo le sube los costes."
      : beta < -0.2
      ? "Se beneficia cuando el petróleo sube (típico de petroleras / energía)."
      : "Neutralidad energética: el petróleo casi no la mueve.";

  return (
    <ChartCard
      title="Beta temática · Sensibilidad al petróleo (Brent / BZ=F)"
      subtitle="Pendiente OLS de retornos diarios del activo frente al crudo"
      narrativeKey="oilBeta"
      badge={
        <div className="text-right text-xs font-mono leading-tight">
          <div className="text-ink-muted">β petróleo</div>
          <div className="text-base text-accent-gold">{fmtNum(beta, 2)}</div>
          <div className="text-[10px] text-ink-muted">α ≈ {fmtNum(alpha, 4)}</div>
        </div>
      }
    >
      {valid.length === 0 ? (
        <EmptyState
          title="No hay retornos alineados con el petróleo"
          description="Carga un ticker con histórico suficiente. Se intersectan fechas con BZ=F."
        />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="oilReturn"
                tick={{ fill: "#9aa6b8", fontSize: 10 }}
                tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
                name="Brent diario"
              />
              <YAxis
                type="number"
                dataKey="assetReturn"
                tick={{ fill: "#9aa6b8", fontSize: 10 }}
                tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
                name="Activo diario"
              />
              <Tooltip
                cursor={{ stroke: "#1f2937" }}
                contentStyle={{ background: "#11151f", border: "1px solid #1f2937", borderRadius: 8 }}
                labelStyle={{ color: "#e7ecf3" }}
                formatter={(v: number) => `${(v * 100).toFixed(2)}%`}
              />
              <ReferenceLine x={0} stroke="#5d6678" strokeDasharray="2 2" />
              <ReferenceLine y={0} stroke="#5d6678" strokeDasharray="2 2" />
              <Scatter data={valid} fill="#3b82f6" fillOpacity={0.55} />
              <Scatter
                data={line}
                line={{ stroke: "#d4af37", strokeWidth: 2 }}
                dataKey="predicted"
                shape={() => <g />}
              />
            </ScatterChart>
          </ResponsiveContainer>
          <p className="text-xs text-ink-secondary mt-2">{interpretation}</p>
        </>
      )}
    </ChartCard>
  );
}
