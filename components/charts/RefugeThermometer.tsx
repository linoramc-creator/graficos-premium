"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ChartCard } from "../ChartCard";
import { EmptyState } from "../EmptyState";
import type { RollingCorrelationPoint } from "@/lib/types";

interface Props {
  data: RollingCorrelationPoint[];
}

export function RefugeThermometer({ data }: Props) {
  const valid = data.filter(
    (d) => d && Number.isFinite(d.correlation) && typeof d.date === "string"
  );
  const last = valid.length ? valid[valid.length - 1].correlation : NaN;
  const tone = !Number.isFinite(last)
    ? "text-ink-muted"
    : last > 0.4
    ? "text-accent-ok"
    : last < -0.4
    ? "text-accent-danger"
    : "text-accent-warn";

  return (
    <ChartCard
      title="Termómetro de refugio · Correlación móvil 60d vs. GLD"
      subtitle="¿Esta acción se comporta como búnker financiero cuando el mundo se incendia?"
      narrativeKey="refuge"
      badge={
        <div className="text-right text-xs font-mono leading-tight">
          <div className="text-ink-muted">corr actual</div>
          <div className={`text-base ${tone}`}>
            {Number.isFinite(last) ? last.toFixed(2) : "—"}
          </div>
        </div>
      }
    >
      {valid.length === 0 ? (
        <EmptyState
          title="Sin datos suficientes para la correlación móvil"
          description="Se necesita histórico tanto del ticker como de GLD."
        />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={valid} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#9aa6b8", fontSize: 10 }}
              minTickGap={40}
            />
            <YAxis
              tick={{ fill: "#9aa6b8", fontSize: 10 }}
              domain={[-1, 1]}
              tickFormatter={(v: number) => v.toFixed(1)}
            />
            <Tooltip
              contentStyle={{ background: "#11151f", border: "1px solid #1f2937", borderRadius: 8 }}
              labelStyle={{ color: "#e7ecf3" }}
              formatter={(v: number) => v.toFixed(3)}
            />
            <ReferenceLine y={0} stroke="#5d6678" strokeDasharray="2 2" />
            <ReferenceLine y={0.4} stroke="#22c55e" strokeDasharray="4 4" />
            <ReferenceLine y={-0.4} stroke="#ef4444" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="correlation"
              stroke="#d4af37"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
