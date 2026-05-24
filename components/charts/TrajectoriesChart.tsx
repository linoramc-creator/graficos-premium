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
import type { TrajectoryPoint } from "@/lib/types";

interface Props {
  trajectories: TrajectoryPoint[];
  spot: number;
}

export function TrajectoriesChart({ trajectories, spot }: Props) {
  const valid = trajectories.filter(
    (p) => p && Number.isFinite(p.step)
  );
  const pathKeys = valid.length ? Object.keys(valid[0]).filter((k) => k.startsWith("p")) : [];

  return (
    <ChartCard
      title="50 trayectorias simuladas"
      subtitle="Cada línea es un futuro plausible; los cortes verticales son shocks políticos"
      narrativeKey="trajectories"
    >
      {pathKeys.length === 0 ? (
        <EmptyState title="Aún no hay trayectorias generadas" />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={valid} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <XAxis dataKey="step" tick={{ fill: "#9aa6b8", fontSize: 10 }} />
            <YAxis tick={{ fill: "#9aa6b8", fontSize: 10 }} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ background: "#11151f", border: "1px solid #1f2937", borderRadius: 8 }}
              labelStyle={{ color: "#e7ecf3" }}
              formatter={(value: number) => value.toFixed(2)}
            />
            <ReferenceLine y={spot} stroke="#d4af37" strokeDasharray="4 2" />
            {pathKeys.map((k, i) => (
              <Line
                key={k}
                dataKey={k}
                type="monotone"
                stroke={`hsla(${(i * 360) / pathKeys.length}, 70%, 60%, 0.55)`}
                strokeWidth={1}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
