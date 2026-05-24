"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ChartCard } from "../ChartCard";
import { EmptyState } from "../EmptyState";
import type { RegimeBucket } from "@/lib/types";

interface Props {
  data: RegimeBucket[];
}

export function RegimeHistogram({ data }: Props) {
  const valid = data.filter(
    (d) => d && typeof d.bucket === "string" && Number.isFinite(d.calm) && Number.isFinite(d.panic)
  );

  return (
    <ChartCard
      title="Régimen de mercado · Retornos en calma vs. pánico (VIX > 25)"
      subtitle="¿Cómo se comporta la acción cuando Wall Street tiembla?"
      narrativeKey="regime"
    >
      {valid.length === 0 ? (
        <EmptyState
          title="No hay datos VIX alineados para clasificar regímenes"
          description="Necesitamos histórico del ticker y del ^VIX en las mismas fechas."
        />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={valid} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <XAxis
              dataKey="bucket"
              tick={{ fill: "#9aa6b8", fontSize: 10 }}
              interval={Math.max(0, Math.floor(valid.length / 8))}
            />
            <YAxis tick={{ fill: "#9aa6b8", fontSize: 10 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "#11151f", border: "1px solid #1f2937", borderRadius: 8 }}
              labelStyle={{ color: "#e7ecf3" }}
            />
            <Legend wrapperStyle={{ color: "#9aa6b8", fontSize: 11 }} />
            <Bar dataKey="calm" name="Calma (VIX ≤ 25)" fill="#22c55e" radius={[2, 2, 0, 0]} />
            <Bar dataKey="panic" name="Pánico (VIX > 25)" fill="#ef4444" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
