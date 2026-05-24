"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ChartCard } from "../ChartCard";
import { EmptyState } from "../EmptyState";
import type { UnderwaterPoint } from "@/lib/types";

interface Props {
  data: UnderwaterPoint[];
}

export function UnderwaterChart({ data }: Props) {
  const valid = data.filter(
    (d) => d && Number.isFinite(d.drawdown) && typeof d.date === "string"
  );

  return (
    <ChartCard
      title="Underwater · Drawdown histórico"
      subtitle="Cuánto duele estar comprado: distancia al máximo histórico"
      narrativeKey="underwater"
    >
      {valid.length === 0 ? (
        <EmptyState title="Sin histórico para calcular drawdown" />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={valid} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="ddGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.05} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#9aa6b8", fontSize: 10 }}
              minTickGap={40}
            />
            <YAxis
              tick={{ fill: "#9aa6b8", fontSize: 10 }}
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              domain={["auto", 0]}
            />
            <Tooltip
              contentStyle={{ background: "#11151f", border: "1px solid #1f2937", borderRadius: 8 }}
              labelStyle={{ color: "#e7ecf3" }}
              formatter={(v: number) => [`${(v * 100).toFixed(2)}%`, "Drawdown"]}
            />
            <Area
              type="monotone"
              dataKey="drawdown"
              stroke="#ef4444"
              strokeWidth={1.5}
              fill="url(#ddGradient)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
