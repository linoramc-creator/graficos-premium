"use client";

import { useMemo } from "react";
import type { Scenario, SimulationInputs } from "@/lib/types";
import { NARRATIVES } from "@/lib/narratives";
import { InfoTooltip } from "./InfoTooltip";
import { fmtPct } from "@/lib/format";

interface Props {
  inputs: SimulationInputs;
  onChange: (next: SimulationInputs) => void;
  onRun: () => void;
  onReload: () => void;
  loading: boolean;
}

export function InputPanel({ inputs, onChange, onRun, onReload, loading }: Props) {
  const probSum = useMemo(
    () => inputs.scenarios.reduce((s, sc) => s + sc.probability, 0),
    [inputs.scenarios]
  );
  const probWarn = Math.abs(probSum - 1) > 0.001;

  function updateScenario(key: Scenario["key"], patch: Partial<Scenario>) {
    onChange({
      ...inputs,
      scenarios: inputs.scenarios.map((s) => (s.key === key ? { ...s, ...patch } : s))
    });
  }

  return (
    <aside className="card flex flex-col gap-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-auto">
      <header>
        <h2 className="text-lg font-semibold text-ink-primary">Panel de control</h2>
        <p className="text-xs text-ink-muted mt-1">
          Ajusta las variables y dispara la simulación. El motor recalcula 10.000 trayectorias
          Merton Jump-Diffusion.
        </p>
      </header>

      {/* Ticker */}
      <div>
        <Label>Ticker</Label>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputs.ticker}
            onChange={(e) =>
              onChange({ ...inputs, ticker: e.target.value.toUpperCase().slice(0, 10) })
            }
            placeholder="AAPL"
            className="input flex-1"
          />
          <button
            type="button"
            onClick={onReload}
            disabled={loading}
            className="btn-secondary"
            title="Recargar histórico"
          >
            {loading ? "…" : "Cargar"}
          </button>
        </div>
        <p className="text-[11px] text-ink-muted mt-1">
          Datos vía yfinance (proxy). Ejemplos: <code className="kbd">AAPL</code>{" "}
          <code className="kbd">MSFT</code> <code className="kbd">NVDA</code>
        </p>
      </div>

      {/* Spot, horizonte, paths */}
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Precio actual ($)"
          value={inputs.spot}
          step={0.01}
          onChange={(v) => onChange({ ...inputs, spot: v })}
        />
        <NumberField
          label="Horizonte (días)"
          value={inputs.horizonDays}
          step={1}
          min={5}
          max={504}
          onChange={(v) => onChange({ ...inputs, horizonDays: Math.round(v) })}
        />
        <NumberField
          label="Trayectorias (paths)"
          value={inputs.paths}
          step={500}
          min={500}
          max={50000}
          onChange={(v) => onChange({ ...inputs, paths: Math.round(v) })}
        />
        <NumberField
          label="Drift anual"
          value={inputs.drift}
          step={0.005}
          onChange={(v) => onChange({ ...inputs, drift: v })}
          suffix="μ"
        />
        <NumberField
          label="Volatilidad anual"
          value={inputs.volatility}
          step={0.01}
          onChange={(v) => onChange({ ...inputs, volatility: Math.max(0, v) })}
          suffix="σ"
        />
        <NumberField
          label={
            <span className="inline-flex items-center">
              Tasa libre de riesgo
              <InfoTooltip>{NARRATIVES.riskFree.what}</InfoTooltip>
            </span>
          }
          value={inputs.riskFree}
          step={0.0025}
          onChange={(v) => onChange({ ...inputs, riskFree: v })}
          suffix="Rf"
        />
      </div>

      {/* Escenarios */}
      <div>
        <div className="flex items-baseline justify-between">
          <Label>Mezcla de escenarios</Label>
          <span
            className={
              probWarn
                ? "text-xs text-accent-warn font-mono"
                : "text-xs text-ink-muted font-mono"
            }
          >
            Σ = {fmtPct(probSum, 1)}
          </span>
        </div>
        <div className="space-y-2 mt-1">
          {inputs.scenarios.map((s) => (
            <ScenarioRow key={s.key} scenario={s} onChange={(p) => updateScenario(s.key, p)} />
          ))}
        </div>
        {probWarn && (
          <p className="text-[11px] text-accent-warn mt-2">
            La suma debe ser 100% para que el sorteo de escenarios sea coherente.
          </p>
        )}
      </div>

      <button type="button" onClick={onRun} disabled={loading} className="btn-primary">
        {loading ? "Simulando…" : "Ejecutar simulación"}
      </button>

      <style jsx>{`
        :global(.input) {
          background: #161b27;
          border: 1px solid #1f2937;
          color: #e7ecf3;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          outline: none;
          width: 100%;
        }
        :global(.input:focus) {
          border-color: #d4af37;
        }
        :global(.btn-primary) {
          background: #d4af37;
          color: #0a0d14;
          font-weight: 600;
          padding: 0.6rem 1rem;
          border-radius: 0.5rem;
          transition: opacity 0.15s ease;
        }
        :global(.btn-primary:disabled) {
          opacity: 0.6;
          cursor: not-allowed;
        }
        :global(.btn-secondary) {
          background: #161b27;
          color: #e7ecf3;
          border: 1px solid #1f2937;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
        }
        :global(.btn-secondary:hover) {
          border-color: #d4af37;
        }
      `}</style>
    </aside>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs uppercase tracking-wider text-ink-secondary font-semibold mb-1">
      {children}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix
}: {
  label: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <label className="block">
      <div className="text-[11px] text-ink-secondary mb-1 flex items-center gap-1">
        {label}
        {suffix && <span className="kbd">{suffix}</span>}
      </div>
      <input
        type="number"
        className="input"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </label>
  );
}

function ScenarioRow({
  scenario,
  onChange
}: {
  scenario: Scenario;
  onChange: (p: Partial<Scenario>) => void;
}) {
  const narrativeKey =
    scenario.key === "base"
      ? "scenarioBase"
      : scenario.key === "moderate"
      ? "scenarioModerate"
      : "scenarioSevere";
  const tooltip = NARRATIVES[narrativeKey];

  return (
    <div className="rounded-lg border border-border-base bg-bg-subtle/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-ink-primary flex items-center">
          {scenario.label}
          <InfoTooltip>
            <span className="block font-semibold text-ink-primary mb-1">{tooltip.what}</span>
            <span className="block">{tooltip.geopolitical}</span>
            <span className="block mt-1 text-accent-gold">{tooltip.keyLevel}</span>
          </InfoTooltip>
        </div>
        <span className="font-mono text-xs text-accent-gold">
          {fmtPct(scenario.probability, 1)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={scenario.probability}
        onChange={(e) => onChange({ probability: parseFloat(e.target.value) })}
        className="w-full accent-accent-gold"
      />
      <div className="grid grid-cols-3 gap-2 mt-2">
        <Mini label="μ salto" value={scenario.jumpMean} step={0.005} onChange={(v) => onChange({ jumpMean: v })} />
        <Mini
          label="σ salto"
          value={scenario.jumpStd}
          step={0.005}
          onChange={(v) => onChange({ jumpStd: Math.max(0, v) })}
        />
        <Mini
          label="λ saltos/año"
          value={scenario.jumpIntensity}
          step={0.25}
          onChange={(v) => onChange({ jumpIntensity: Math.max(0, v) })}
        />
      </div>
      <p className="text-[11px] text-ink-muted mt-2">{scenario.description}</p>
    </div>
  );
}

function Mini({
  label,
  value,
  step,
  onChange
}: {
  label: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="text-[10px] text-ink-muted mb-0.5">{label}</div>
      <input
        type="number"
        className="input"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </label>
  );
}
