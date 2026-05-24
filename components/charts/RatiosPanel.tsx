"use client";

import { ChartCard } from "../ChartCard";
import { EmptyState } from "../EmptyState";
import { fmtNum, fmtPct } from "@/lib/format";
import type { RatioReport } from "@/lib/types";

interface Props {
  report: RatioReport | null;
}

export function RatiosPanel({ report }: Props) {
  if (!report) {
    return (
      <ChartCard title="Ratios Sortino & Calmar" narrativeKey="ratios">
        <EmptyState
          title="Necesitas un histórico válido para calcular ratios"
          description="Carga un ticker y vuelve a intentarlo."
        />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Ratios Sortino & Calmar"
      subtitle="Calidad ajustada al riesgo de pérdida real (no a la volatilidad bruta)"
      narrativeKey="ratios"
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Tile label="Sortino" value={fmtNum(report.sortino, 2)} threshold={report.sortino >= 2 ? "ok" : report.sortino >= 1 ? "warn" : "bad"} hint=">= 2.0 institucional" />
        <Tile label="Calmar" value={fmtNum(report.calmar, 2)} threshold={report.calmar >= 1 ? "ok" : report.calmar >= 0.5 ? "warn" : "bad"} hint=">= 1.0 sólido" />
        <Tile label="Sharpe" value={fmtNum(report.sharpe, 2)} threshold={report.sharpe >= 1 ? "ok" : report.sharpe >= 0.5 ? "warn" : "bad"} hint="ref. clásica" />
        <Tile label="CAGR" value={fmtPct(report.cagr, 1)} threshold={report.cagr > 0 ? "ok" : "bad"} hint="crec. anual compuesto" />
        <Tile
          label="Max Drawdown"
          value={fmtPct(report.maxDrawdown, 1)}
          threshold={report.maxDrawdown > -0.2 ? "ok" : report.maxDrawdown > -0.4 ? "warn" : "bad"}
          hint="caída máxima"
        />
      </div>
    </ChartCard>
  );
}

function Tile({
  label,
  value,
  hint,
  threshold
}: {
  label: string;
  value: string;
  hint?: string;
  threshold: "ok" | "warn" | "bad";
}) {
  const color =
    threshold === "ok"
      ? "text-accent-ok"
      : threshold === "warn"
      ? "text-accent-warn"
      : "text-accent-danger";
  return (
    <div className="rounded-lg border border-border-base bg-bg-subtle/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className={`text-2xl font-mono ${color}`}>{value}</div>
      {hint && <div className="text-[10px] text-ink-muted mt-1">{hint}</div>}
    </div>
  );
}
