export function Header({ ticker, range }: { ticker: string; range: string }) {
  return (
    <header className="mb-8">
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink-primary">
          Gráficos Premium
        </h1>
        <span className="text-accent-gold text-sm font-mono">/ Riesgo Geopolítico</span>
      </div>
      <p className="text-sm text-ink-secondary mt-2 max-w-3xl">
        Análisis institucional de un activo con un modelo Merton Jump-Diffusion que mezcla
        escenarios geopolíticos. Cada gráfico incluye su narrativa para que entiendas el
        contexto macro de un vistazo. Ticker actual:{" "}
        <span className="font-mono text-ink-primary">{ticker}</span>
        <span className="text-ink-muted"> · ventana</span>{" "}
        <span className="font-mono text-ink-primary">{range}</span>
      </p>
    </header>
  );
}
