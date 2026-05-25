"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ChartCard } from "../ChartCard";
import { EmptyState } from "../EmptyState";
import { InfoTooltip } from "../InfoTooltip";
import { TILE_TOOLTIPS } from "@/lib/narratives";
import { cn, fmtNum, fmtPct } from "@/lib/format";
import type { BandPoint } from "@/lib/types";

interface Props {
  bands: BandPoint[];
  sampledPaths: number[][];
  spot: number;
  medianFinal: number;
  p05Final: number;
  p95Final: number;
  medianReturn: number;
  probProfit: number;
  pathsCount: number;
  horizon: number;
}

/**
 * Paleta institucional: rojos para riesgo de cola, azul para mediana,
 * verdes para potencial alcista. Se replica en línea y en las áreas
 * sombreadas (bandas P5-P95 y P25-P75).
 */
const COLORS = {
  p05: "#ef4444",
  p25: "#f59e0b",
  p50: "#3b82f6",
  p75: "#10b981",
  p95: "#22c55e",
  band95: "#3b82f6",
  band50: "#3b82f6",
  spot: "#d4af37",
  paths: "#94a3b8"
};

interface ViewState {
  showPaths: boolean;
  showBand95: boolean;
  showBand50: boolean;
  showP05: boolean;
  showP25: boolean;
  showP50: boolean;
  showP75: boolean;
  showP95: boolean;
}

const VIEW_FULL: ViewState = {
  showPaths: true,
  showBand95: true,
  showBand50: true,
  showP05: true,
  showP25: true,
  showP50: true,
  showP75: true,
  showP95: true
};

const VIEW_CLEAN: ViewState = {
  showPaths: false,
  showBand95: true,
  showBand50: true,
  showP05: true,
  showP25: false,
  showP50: true,
  showP75: false,
  showP95: true
};

const VIEW_PERCENTILES_ONLY: ViewState = {
  showPaths: false,
  showBand95: false,
  showBand50: false,
  showP05: true,
  showP25: true,
  showP50: true,
  showP75: true,
  showP95: true
};

type Preset = "full" | "clean" | "lines";

export function MonteCarloPaths({
  bands,
  sampledPaths,
  spot,
  medianFinal,
  p05Final,
  p95Final,
  medianReturn,
  probProfit,
  pathsCount,
  horizon
}: Props) {
  const [preset, setPreset] = useState<Preset>("clean");
  const view = preset === "full" ? VIEW_FULL : preset === "clean" ? VIEW_CLEAN : VIEW_PERCENTILES_ONLY;

  const data = useMemo(() => {
    if (!bands.length) return [];
    // Mezclamos las trayectorias muestreadas dentro de cada punto step.
    // El payload por punto contiene: step, bandas, percentiles y path_N.
    return bands.map((b, i) => {
      const point: Record<string, number | [number, number]> = {
        step: b.step,
        p05: b.p05,
        p25: b.p25,
        p50: b.p50,
        p75: b.p75,
        p95: b.p95,
        band95: b.band95,
        band50: b.band50
      };
      if (view.showPaths) {
        for (let j = 0; j < sampledPaths.length; j++) {
          point[`path_${j}`] = sampledPaths[j][i];
        }
      }
      return point;
    });
  }, [bands, sampledPaths, view.showPaths]);

  if (!bands.length) {
    return (
      <ChartCard
        title="Trayectorias Monte Carlo · Nube de densidad + percentiles"
        subtitle="Distribución completa de precios futuros con bandas de confianza"
        narrativeKey="monteCarlo"
      >
        <EmptyState
          title="Aún no hay simulación"
          description="Ajusta el panel y pulsa 'Ejecutar simulación' para generar la nube."
        />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Trayectorias Monte Carlo · Nube de densidad + percentiles"
      subtitle={`${pathsCount.toLocaleString("es-ES")} simulaciones · ${horizon} días de trading · modelo Merton Jump-Diffusion`}
      narrativeKey="monteCarlo"
      badge={<PresetSwitcher preset={preset} onChange={setPreset} />}
    >
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
          <XAxis
            dataKey="step"
            tick={{ fill: "#9aa6b8", fontSize: 10 }}
            label={{
              value: "Días de trading",
              position: "insideBottom",
              offset: -2,
              fill: "#5d6678",
              fontSize: 10
            }}
          />
          <YAxis
            tick={{ fill: "#9aa6b8", fontSize: 10 }}
            tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            domain={["auto", "auto"]}
            label={{
              value: "Precio de cierre proyectado (USD)",
              angle: -90,
              position: "insideLeft",
              offset: 10,
              style: { fill: "#5d6678", fontSize: 10, textAnchor: "middle" }
            }}
          />
          <Tooltip
            contentStyle={{
              background: "#11151f",
              border: "1px solid #1f2937",
              borderRadius: 8
            }}
            labelStyle={{ color: "#e7ecf3" }}
            labelFormatter={(step) => `Día ${step}`}
            formatter={(value: number | [number, number], name: string) => {
              if (Array.isArray(value)) {
                return [`$${value[0].toFixed(2)} – $${value[1].toFixed(2)}`, name];
              }
              if (typeof name === "string" && name.startsWith("path_")) {
                return [null, null] as unknown as [string, string];
              }
              return [`$${Number(value).toFixed(2)}`, name];
            }}
            filterNull
          />

          {/* Banda P5-P95 (ancho de la distribución) */}
          {view.showBand95 && (
            <Area
              type="monotone"
              dataKey="band95"
              fill={COLORS.band95}
              fillOpacity={0.07}
              stroke="none"
              isAnimationActive={false}
              activeDot={false}
              name="Banda P5–P95"
            />
          )}
          {/* Banda P25-P75 (rango intercuartílico) */}
          {view.showBand50 && (
            <Area
              type="monotone"
              dataKey="band50"
              fill={COLORS.band50}
              fillOpacity={0.18}
              stroke="none"
              isAnimationActive={false}
              activeDot={false}
              name="Banda P25–P75"
            />
          )}

          {/* Nube de trayectorias (debajo de las líneas de percentiles) */}
          {view.showPaths &&
            sampledPaths.map((_, idx) => (
              <Line
                key={`path_${idx}`}
                dataKey={`path_${idx}`}
                type="monotone"
                stroke={COLORS.paths}
                strokeOpacity={0.07}
                strokeWidth={1}
                dot={false}
                isAnimationActive={false}
                activeDot={false}
                legendType="none"
              />
            ))}

          {/* Líneas de percentiles superpuestas */}
          {view.showP05 && (
            <Line
              dataKey="p05"
              type="monotone"
              stroke={COLORS.p05}
              strokeWidth={1.75}
              strokeDasharray="4 2"
              dot={false}
              isAnimationActive={false}
              name="P5"
            />
          )}
          {view.showP25 && (
            <Line
              dataKey="p25"
              type="monotone"
              stroke={COLORS.p25}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              name="P25"
            />
          )}
          {view.showP50 && (
            <Line
              dataKey="p50"
              type="monotone"
              stroke={COLORS.p50}
              strokeWidth={2.75}
              dot={false}
              isAnimationActive={false}
              name="P50 (Mediana)"
            />
          )}
          {view.showP75 && (
            <Line
              dataKey="p75"
              type="monotone"
              stroke={COLORS.p75}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              name="P75"
            />
          )}
          {view.showP95 && (
            <Line
              dataKey="p95"
              type="monotone"
              stroke={COLORS.p95}
              strokeWidth={1.75}
              strokeDasharray="4 2"
              dot={false}
              isAnimationActive={false}
              name="P95"
            />
          )}

          {/* Precio actual (referencia) */}
          <ReferenceLine
            y={spot}
            stroke={COLORS.spot}
            strokeDasharray="2 4"
            label={{
              value: `Spot $${spot.toFixed(2)}`,
              fill: COLORS.spot,
              fontSize: 10,
              position: "right"
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <Legend view={view} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
        <Tile
          label="Mediana"
          value={`$${fmtNum(medianFinal)}`}
          delta={fmtPct(medianReturn, 1)}
          tone={medianReturn >= 0 ? "ok" : "bad"}
          tooltip={TILE_TOOLTIPS.median}
        />
        <Tile
          label="Prob. profit"
          value={fmtPct(probProfit, 1)}
          delta="above entry"
          tone={probProfit >= 0.6 ? "ok" : probProfit >= 0.5 ? "warn" : "bad"}
          tooltip={TILE_TOOLTIPS.probProfit}
        />
        <Tile
          label="P5"
          value={`$${fmtNum(p05Final)}`}
          delta="worst 95%"
          tone="bad"
          tooltip={TILE_TOOLTIPS.p05}
        />
        <Tile
          label="P95"
          value={`$${fmtNum(p95Final)}`}
          delta="best 95%"
          tone="ok"
          tooltip={TILE_TOOLTIPS.p95}
        />
      </div>
    </ChartCard>
  );
}

/* ---------------------------- Subcomponentes ---------------------------- */

function PresetSwitcher({ preset, onChange }: { preset: Preset; onChange: (p: Preset) => void }) {
  const options: Array<{ key: Preset; label: string; hint: string }> = [
    { key: "full", label: "Completo", hint: "Nube + bandas + todos los percentiles" },
    { key: "clean", label: "Limpio", hint: "Bandas + P5/P50/P95" },
    { key: "lines", label: "Solo percentiles", hint: "Sin bandas, sin nube" }
  ];
  return (
    <div className="inline-flex rounded-md border border-border-base bg-bg-subtle overflow-hidden text-[11px]">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          title={o.hint}
          onClick={() => onChange(o.key)}
          className={cn(
            "px-2.5 py-1 transition",
            preset === o.key
              ? "bg-accent-gold text-bg-base font-semibold"
              : "text-ink-secondary hover:text-ink-primary"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Legend({ view }: { view: ViewState }) {
  const items: Array<{ visible: boolean; color: string; label: string; dashed?: boolean }> = [
    { visible: view.showP05, color: COLORS.p05, label: "P5 · cola izquierda", dashed: true },
    { visible: view.showP25, color: COLORS.p25, label: "P25" },
    { visible: view.showP50, color: COLORS.p50, label: "P50 · mediana" },
    { visible: view.showP75, color: COLORS.p75, label: "P75" },
    { visible: view.showP95, color: COLORS.p95, label: "P95 · cola derecha", dashed: true },
    { visible: view.showBand50, color: COLORS.band50, label: "Banda P25–P75" },
    { visible: view.showBand95, color: COLORS.band95, label: "Banda P5–P95" },
    { visible: view.showPaths, color: COLORS.paths, label: "Trayectorias individuales" }
  ];
  const visible = items.filter((i) => i.visible);
  if (!visible.length) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-ink-secondary">
      {visible.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-[2px] w-4 rounded"
            style={{
              background: i.color,
              opacity: i.label.startsWith("Banda") ? 0.3 : 1,
              backgroundImage: i.dashed
                ? `repeating-linear-gradient(to right, ${i.color} 0 4px, transparent 4px 6px)`
                : undefined
            }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function Tile({
  label,
  value,
  delta,
  tone,
  tooltip
}: {
  label: string;
  value: string;
  delta?: string;
  tone: "ok" | "warn" | "bad";
  tooltip: { title: string; body: string };
}) {
  const toneClass =
    tone === "ok" ? "text-accent-ok" : tone === "warn" ? "text-accent-warn" : "text-accent-danger";
  return (
    <div className="rounded-lg border border-border-base bg-bg-subtle/40 p-3 relative">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
        <InfoTooltip>
          <span className="block font-semibold text-ink-primary mb-1">{tooltip.title}</span>
          <span className="block text-ink-secondary">{tooltip.body}</span>
        </InfoTooltip>
      </div>
      <div className={cn("text-2xl font-mono", toneClass)}>{value}</div>
      {delta && <div className="text-[10px] text-ink-muted mt-0.5">{delta}</div>}
    </div>
  );
}
